import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';
import type { CheckoutResponse, PaymentMethod, VerifyPaymentRequest } from '@barit/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService, type SessionFull } from '../sessions/sessions.service';

/**
 * Razorpay in test mode when RAZORPAY_KEY_ID/SECRET are set; otherwise "stub mode":
 * the guest app shows a fake UPI sheet and verification accepts stub_* ids.
 */
@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);
  private readonly keyId = process.env.RAZORPAY_KEY_ID || null;
  private readonly keySecret = process.env.RAZORPAY_KEY_SECRET || null;
  private readonly razorpay = this.keyId && this.keySecret ? new Razorpay({ key_id: this.keyId, key_secret: this.keySecret }) : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {
    if (!this.razorpay) this.log.warn('Razorpay keys not set — payments run in STUB mode');
  }

  get stubMode(): boolean {
    return this.razorpay === null;
  }

  private assertPayable(s: SessionFull) {
    if (s.status === 'CLOSED') throw new ConflictException('This table bill is already settled');
    if (!s.orders.some((o) => o.status !== 'CANCELLED')) throw new BadRequestException('Nothing to pay for yet');
  }

  private validateTip(tipPaise: number, subtotalPaise: number) {
    if (tipPaise > subtotalPaise) throw new BadRequestException('Tip cannot exceed the bill subtotal');
  }

  async checkout(sessionId: string, tipPaise: number): Promise<CheckoutResponse> {
    const s = await this.sessions.load(sessionId);
    this.assertPayable(s);
    const bill = this.sessions.billFor(s, tipPaise);
    this.validateTip(tipPaise, bill.subtotalPaise);

    let razorpayOrderId: string;
    if (this.razorpay) {
      const order = await this.razorpay.orders.create({
        amount: bill.totalPaise,
        currency: 'INR',
        receipt: `sess_${s.id}`.slice(0, 40),
        notes: { sessionId: s.id, venue: s.table.venue.slug, table: String(s.table.number) },
      });
      razorpayOrderId = order.id;
    } else {
      razorpayOrderId = `stub_order_${randomUUID()}`;
    }

    const [, payment] = await this.prisma.$transaction([
      this.prisma.payment.updateMany({ where: { sessionId: s.id, status: 'CREATED' }, data: { status: 'FAILED' } }),
      this.prisma.payment.create({
        data: {
          sessionId: s.id,
          subtotalPaise: bill.subtotalPaise,
          gstPaise: bill.gstPaise,
          tipPaise,
          totalPaise: bill.totalPaise,
          method: 'RAZORPAY',
          razorpayOrderId,
        },
      }),
      this.prisma.tableSession.update({ where: { id: s.id }, data: { status: 'PAYING' } }),
    ]);

    return {
      paymentId: payment.id,
      stub: this.stubMode,
      amountPaise: bill.totalPaise,
      currency: 'INR',
      razorpayOrderId,
      razorpayKeyId: this.keyId,
      bill,
    };
  }

  async verify(req: VerifyPaymentRequest): Promise<string> {
    const payment = await this.prisma.payment.findUnique({ where: { id: req.paymentId } });
    if (!payment || payment.razorpayOrderId !== req.razorpayOrderId) throw new NotFoundException('Payment not found');
    if (payment.status === 'PAID') return payment.sessionId; // idempotent
    if (payment.status !== 'CREATED') throw new ConflictException('This payment attempt is no longer valid — please check out again');

    if (!this.signatureValid(req)) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw new ForbiddenException('Payment signature verification failed');
    }

    await this.markPaid(payment.sessionId, payment.id, req.razorpayPaymentId);
    return payment.sessionId;
  }

  private signatureValid(req: VerifyPaymentRequest): boolean {
    if (this.stubMode) {
      return req.razorpayOrderId.startsWith('stub_order_') && req.razorpaySignature === 'stub';
    }
    const expected = createHmac('sha256', this.keySecret!)
      .update(`${req.razorpayOrderId}|${req.razorpayPaymentId}`)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(req.razorpaySignature ?? '');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async markPaid(sessionId: string, paymentId: string, razorpayPaymentId: string | null) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'PAID', paidAt: now, razorpayPaymentId },
      }),
      this.prisma.tableSession.update({ where: { id: sessionId }, data: { status: 'CLOSED', closedAt: now } }),
    ]);
  }

  /** Staff "Mark Paid" for cash / card at reception (stand-in for POS integration). */
  async markPaidAtCounter(venueId: string, sessionId: string, method: Exclude<PaymentMethod, 'RAZORPAY'>, tipPaise: number) {
    const s = await this.sessions.load(sessionId);
    if (s.table.venueId !== venueId) throw new ForbiddenException('Session belongs to another venue');
    this.assertPayable(s);
    const bill = this.sessions.billFor(s, tipPaise);
    this.validateTip(tipPaise, bill.subtotalPaise);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.payment.updateMany({ where: { sessionId, status: 'CREATED' }, data: { status: 'FAILED' } }),
      this.prisma.payment.create({
        data: {
          sessionId,
          subtotalPaise: bill.subtotalPaise,
          gstPaise: bill.gstPaise,
          tipPaise,
          totalPaise: bill.totalPaise,
          method,
          status: 'PAID',
          paidAt: now,
        },
      }),
      this.prisma.tableSession.update({ where: { id: sessionId }, data: { status: 'CLOSED', closedAt: now } }),
    ]);
  }
}
