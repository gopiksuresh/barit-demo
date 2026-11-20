import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { TOKEN_VERIFIER, type TokenVerifier } from '../src/auth/firebase';
import { PrismaService } from '../src/prisma/prisma.service';

/** Fake verifier: bearer token "uid|+91phone". */
const fakeVerifier: TokenVerifier = {
  async verify(token: string) {
    const [uid, phone] = token.split('|');
    if (!uid || !phone) throw new Error('bad token');
    return { uid, phone };
  },
};
/** Unique per run so fixtures never collide and the test DB never needs wiping. */
const R = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const BASE = String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
/** E.164 Indian mobile unique to this run: +91 <n>00<7 random digits>. */
const phone = (n: number) => `+91${n}00${BASE}`;
const as = (uid: string, phoneNo: string) => ({ Authorization: `Bearer ${uid}-${R}|${phoneNo}` });

const PHONES = { restoOwner: phone(1), barOwner: phone(2), kitchen: phone(3), guestA: phone(6), guestB: phone(7) };
const RESTO_OWNER = as('owner-r', PHONES.restoOwner);
const BAR_OWNER = as('owner-b', PHONES.barOwner);
const KITCHEN = as('kitchen-r', PHONES.kitchen);
const GUEST_A = as('guest-a', PHONES.guestA);
const GUEST_B = as('guest-b', PHONES.guestB);
const RESTO = `e2e-resto-${R}`;
const BAR = `e2e-bar-${R}`;
const T1 = `${R}-t1`;
const T2 = `${R}-t2`;

describe('BARit API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    const resto = await prisma.venue.create({
      data: { slug: RESTO, name: 'E2E Resto', type: 'RESTAURANT', address: 'x', lat: 9.96, lng: 76.24 },
    });
    const bar = await prisma.venue.create({
      data: { slug: BAR, name: 'E2E Bar', type: 'BAR', address: 'y', lat: 9.95, lng: 76.29 },
    });
    await prisma.staffUser.createMany({
      data: [
        { phone: PHONES.restoOwner, role: 'OWNER', venueId: resto.id },
        { phone: PHONES.barOwner, role: 'OWNER', venueId: bar.id },
        { phone: PHONES.kitchen, role: 'KITCHEN', venueId: resto.id },
      ],
    });
    const food = await prisma.category.create({ data: { venueId: resto.id, name: 'Mains', gstRatePct: 5 } });
    const drinks = await prisma.category.create({ data: { venueId: bar.id, name: 'Cocktails', gstRatePct: 0 } });
    const beef = await prisma.menuItem.create({
      data: { categoryId: food.id, name: 'Beef Fry', portions: { create: [{ label: 'Full', pricePaise: 34000 }] } },
      include: { portions: true },
    });
    const mule = await prisma.menuItem.create({
      data: { categoryId: drinks.id, name: 'Kochi Mule', portions: { create: [{ label: 'Glass', pricePaise: 42000 }] } },
      include: { portions: true },
    });
    await prisma.diningTable.create({ data: { venueId: resto.id, number: 1, qrToken: T1 } });
    await prisma.diningTable.create({ data: { venueId: resto.id, number: 2, qrToken: T2 } });
    Object.assign(ids, {
      resto: resto.id,
      bar: bar.id,
      beef: beef.id,
      beefFull: beef.portions[0].id,
      mule: mule.id,
      muleGlass: mule.portions[0].id,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('auth & venue scoping', () => {
    it('rejects admin calls without a token', async () => {
      await http.get('/api/v1/admin/me').expect(401);
    });

    it('rejects a phone number that is not staff', async () => {
      await http.get('/api/v1/admin/me').set(GUEST_A).expect(403);
    });

    it('returns the staff member and their venue', async () => {
      const res = await http.get('/api/v1/admin/me').set(RESTO_OWNER).expect(200);
      expect(res.body.venue.slug).toBe(RESTO);
      expect(res.body.role).toBe('OWNER');
    });

    it('forbids the bar owner from editing a restaurant item', async () => {
      await http.patch(`/api/v1/admin/items/${ids.beef}`).set(BAR_OWNER).send({ isSpecial: true }).expect(403);
    });

    it('forbids kitchen staff from editing the menu', async () => {
      await http.patch(`/api/v1/admin/items/${ids.beef}`).set(KITCHEN).send({ isSpecial: true }).expect(403);
    });

    it('lets the owner edit their own item and validates input', async () => {
      await http.patch(`/api/v1/admin/items/${ids.beef}`).set(RESTO_OWNER).send({ isSpecial: true }).expect(200);
      await http.patch(`/api/v1/admin/items/${ids.beef}`).set(RESTO_OWNER).send({ hacked: 1 }).expect(400);
    });
  });

  describe('ordering', () => {
    it('rejects an order containing a portion from another venue', async () => {
      const res = await http
        .post(`/api/v1/tables/${T1}/orders`)
        .set(GUEST_A)
        .send({ items: [{ portionId: ids.muleGlass, qty: 1 }] })
        .expect(400);
      expect(res.body.message).toMatch(/not on this venue/);
    });

    it('rejects an unavailable item', async () => {
      await prisma.menuItem.update({ where: { id: ids.beef }, data: { isAvailable: false } });
      await http
        .post(`/api/v1/tables/${T1}/orders`)
        .set(GUEST_A)
        .send({ items: [{ portionId: ids.beefFull, qty: 1 }] })
        .expect(400);
      await prisma.menuItem.update({ where: { id: ids.beef }, data: { isAvailable: true } });
    });

    it('opens one shared session per table and snapshots prices', async () => {
      const a = await http
        .post(`/api/v1/tables/${T1}/orders`)
        .set(GUEST_A)
        .send({ items: [{ portionId: ids.beefFull, qty: 2 }], guestName: 'Asha' })
        .expect(201);
      const b = await http
        .post(`/api/v1/tables/${T1}/orders`)
        .set(GUEST_B)
        .send({ items: [{ portionId: ids.beefFull, qty: 1 }] })
        .expect(201);
      expect(b.body.sessionId).toBe(a.body.sessionId);
      expect(a.body.order.items[0].unitPricePaise).toBe(34000);
      ids.session = a.body.sessionId;
      ids.orderA = a.body.order.id;

      // A later price change must not alter the bill.
      await prisma.portion.update({ where: { id: ids.beefFull }, data: { pricePaise: 99900 } });
      const s = await http.get(`/api/v1/sessions/${ids.session}`).set(GUEST_A).expect(200);
      expect(s.body.bill.subtotalPaise).toBe(3 * 34000);
      expect(s.body.bill.gstPaise).toBe(Math.round(3 * 34000 * 0.05));
    });

    it('keeps concurrent first orders on different tables in separate sessions, same table in one', async () => {
      const send = () =>
        http.post(`/api/v1/tables/${T2}/orders`).set(GUEST_A).send({ items: [{ portionId: ids.beefFull, qty: 1 }] });
      const results = await Promise.all([send(), send(), send()]);
      for (const r of results) expect(r.status).toBe(201);
      expect(new Set(results.map((r) => r.body.sessionId)).size).toBe(1);
      expect(results[0].body.sessionId).not.toBe(ids.session);
    });

    it('hides a session bill from a guest who has not ordered in it', async () => {
      await http.get(`/api/v1/sessions/${ids.session}`).set(as('stranger', '+917777700000')).expect(403);
    });
  });

  describe('KDS', () => {
    it('shows the venue’s active orders to kitchen staff only', async () => {
      const res = await http.get('/api/v1/kds/orders').set(KITCHEN).expect(200);
      expect(res.body.some((o: { id: string }) => o.id === ids.orderA)).toBe(true);
      const bar = await http.get('/api/v1/kds/orders').set(BAR_OWNER).expect(200);
      expect(bar.body).toHaveLength(0);
    });

    it('rejects skipped transitions and another venue’s staff', async () => {
      await http.patch(`/api/v1/kds/orders/${ids.orderA}/status`).set(KITCHEN).send({ status: 'READY' }).expect(409);
      await http.patch(`/api/v1/kds/orders/${ids.orderA}/status`).set(BAR_OWNER).send({ status: 'COOKING' }).expect(403);
    });

    it('advances Ordered → Cooking → Ready → Served', async () => {
      for (const status of ['COOKING', 'READY', 'SERVED']) {
        const res = await http.patch(`/api/v1/kds/orders/${ids.orderA}/status`).set(KITCHEN).send({ status }).expect(200);
        expect(res.body.status).toBe(status);
      }
      const res = await http.get('/api/v1/kds/orders').set(KITCHEN).expect(200);
      expect(res.body.some((o: { id: string }) => o.id === ids.orderA)).toBe(false);
    });
  });

  describe('checkout (stub payments)', () => {
    it('rejects a tip larger than the subtotal', async () => {
      await http.post(`/api/v1/sessions/${ids.session}/checkout`).set(GUEST_A).send({ tipPaise: 10_000_00 }).expect(400);
    });

    it('rejects a forged signature', async () => {
      const co = await http.post(`/api/v1/sessions/${ids.session}/checkout`).set(GUEST_A).send({ tipPaise: 0 }).expect(201);
      await http
        .post('/api/v1/payments/verify')
        .set(GUEST_A)
        .send({ paymentId: co.body.paymentId, razorpayOrderId: co.body.razorpayOrderId, razorpayPaymentId: 'x', razorpaySignature: 'forged' })
        .expect(403);
    });

    it('pays with tip, closes the session, and is idempotent', async () => {
      const co = await http.post(`/api/v1/sessions/${ids.session}/checkout`).set(GUEST_A).send({ tipPaise: 5000 }).expect(201);
      expect(co.body.stub).toBe(true);
      const sub = 3 * 34000;
      expect(co.body.amountPaise).toBe(sub + Math.round(sub * 0.05) + 5000);

      const verify = {
        paymentId: co.body.paymentId,
        razorpayOrderId: co.body.razorpayOrderId,
        razorpayPaymentId: 'stub_pay_1',
        razorpaySignature: 'stub',
      };
      const res = await http.post('/api/v1/payments/verify').set(GUEST_A).send(verify).expect(200);
      expect(res.body.status).toBe('CLOSED');
      expect(res.body.payment.status).toBe('PAID');
      expect(res.body.bill.tipPaise).toBe(5000);
      await http.post('/api/v1/payments/verify').set(GUEST_A).send(verify).expect(200);

      await http.post(`/api/v1/sessions/${ids.session}/checkout`).set(GUEST_A).send({}).expect(409);
    });

    it('starts a fresh session for the next guests at that table', async () => {
      const r = await http
        .post(`/api/v1/tables/${T1}/orders`)
        .set(GUEST_B)
        .send({ items: [{ portionId: ids.beefFull, qty: 1 }] })
        .expect(201);
      expect(r.body.sessionId).not.toBe(ids.session);
    });

    it('lets staff mark a session paid by cash', async () => {
      const live = await http.get('/api/v1/admin/sessions/live').set(RESTO_OWNER).expect(200);
      const open = live.body.find((s: { status: string; tableNumber: number }) => s.status === 'OPEN' && s.tableNumber === 2);
      const res = await http.post(`/api/v1/admin/sessions/${open.id}/mark-paid`).set(RESTO_OWNER).send({ method: 'CASH' }).expect(200);
      expect(res.body.status).toBe('CLOSED');
      expect(res.body.payment.method).toBe('CASH');
      await http.post(`/api/v1/admin/sessions/${open.id}/mark-paid`).set(BAR_OWNER).send({ method: 'CASH' }).expect(403);
    });
  });

  describe('public endpoints', () => {
    it('lists venues sorted by distance from the simulated location', async () => {
      const res = await http.get('/api/v1/venues').expect(200);
      const ours = res.body.filter((v: { slug: string }) => v.slug.endsWith(R));
      expect(ours.map((v: { slug: string }) => v.slug)).toEqual([BAR, RESTO]);
      expect(typeof ours[0].distanceKm).toBe('number');
    });

    it('returns the public menu with only available items', async () => {
      await prisma.menuItem.update({ where: { id: ids.beef }, data: { isAvailable: false } });
      const res = await http.get(`/api/v1/venues/${RESTO}/menu`).expect(200);
      expect(res.body.categories).toHaveLength(0);
      await prisma.menuItem.update({ where: { id: ids.beef }, data: { isAvailable: true } });
    });

    it('resolves a table QR token', async () => {
      const res = await http.get(`/api/v1/tables/${T1}`).expect(200);
      expect(res.body.table.number).toBe(1);
      expect(res.body.venue.slug).toBe(RESTO);
      await http.get('/api/v1/tables/nope').expect(404);
    });
  });
});
