# BARit — demo build (Milestones 1–5)

Order-from-your-table for Kerala restaurants and bars. The core loop is complete:
**phone OTP login → live menu → order → kitchen display → bill with GST & tip → UPI payment**.

| Part | Path | Stack | Dev URL |
|---|---|---|---|
| Guest app | `apps/guest` | Angular 21, standalone + signals, no UI lib (mobile-first) | http://localhost:4200 |
| Venue admin + KDS | `apps/admin` | Angular 21 + Angular Material (KDS at `/kds`) | http://localhost:4300 |
| API | `api` | NestJS 11 + Prisma 7 + PostgreSQL 16 → Firebase Cloud Function `api` | http://localhost:3000/api/v1 |
| Shared types | `packages/shared` | DTOs, order-status transitions, money helpers | — |

Auth is Firebase Phone Auth (the **Auth emulator** locally, so no SMS is sent). Payments use Razorpay test mode,
or a built-in **stub mode** when no keys are set.

## One-time setup (this machine)

Node 22 and PostgreSQL 16 are installed portably in `%LOCALAPPDATA%\BARit-tools` (no admin rights needed).
The system still has Node 16 on its PATH, so **start each PowerShell session with**:

```powershell
. .\scripts\env.ps1      # puts Node 22 + Postgres 16 first on PATH for this window
Start-BaritDb            # starts Postgres on :5432 (Stop-BaritDb to stop)
```

First time only (already done here): `npm install`, `copy api\.env.example api\.env`,
`npm run db:migrate`, `npm run db:seed`.

## Run it

```powershell
npm run dev
```

This starts the Auth emulator (:9099, UI at :4000), the API with hot reload (:3000), and both Angular
dev servers (:4200, :4300) with `/api` proxied to the API.

To run the deploy-shaped stack instead (bundled Cloud Function behind Firebase Hosting, Node-only emulators):

```powershell
npm run emulators       # builds everything, then: firebase emulators:start --only auth,functions,hosting
```

The guest site is then at http://127.0.0.1:5005 and admin at http://127.0.0.1:5010. Both call the API through
the Hosting rewrite `/api/** → function api`, the same as production.

## Demo script

| Who | Phone (+91) | Lands on |
|---|---|---|
| Kayal Kitchen owner | `9999900001` | Live orders, menu, tables |
| Toddy & Tide owner | `9999900002` | (bar venue) |
| Kayal Kitchen kitchen | `9999900003` | KDS only |
| Any guest | any other valid mobile, e.g. `9876500001` | — |

OTPs come from the Auth emulator. On both login screens, tap **“Dev: fill code from Auth emulator”**,
or read the code in the emulator UI / terminal.

1. **Admin** (http://localhost:4300): sign in as `9999900001`. Under **Menu**, edit a price, toggle a special
   or mark a dish sold out, or upload a photo. Under **Tables & QR**, open table 3's QR code.
2. **Guest** (phone-size window): open http://localhost:4200/table/kk-t3, which is what that QR encodes.
   Add *Appam & Vegetable Stew* and *Beef Fry (Full)*, then place the order and verify your phone.
3. **Kitchen**: open http://localhost:4300/kds in another window, or sign in as `9999900003`.
   The ticket appears within ~4 s; tap through *Start cooking → Ready to serve → Served*.
   The guest's status tracker follows along.
4. **Guest pays**: pick a 10% tip, tap **Pay**, then **Pay with UPI (test)** in the stub sheet.
   The bill shows CGST/SGST, and the session closes.
5. **Admin → Live orders** shows table 3 settled. **Mark paid (cash/card)** covers counter payments.

Venues sort by distance from a fixed simulated location (MG Road, Kochi). The browse-only menu is at `/v/<slug>`.
Reset the demo data at any time with `npm run db:seed`.

## Tests

```powershell
npm test            # unit: bill/GST maths, KDS transitions, distance sort
npm run test:e2e    # API e2e against the barit_test database (22 scenarios)
```

The e2e suite covers venue scoping (a bar owner can't touch restaurant items), rejection of a portion from another venue,
price snapshots (later menu edits don't change bills), one session per table under concurrent first orders,
KDS transition rules, forged-signature rejection, idempotent payment verification and cash mark-paid.
It never wipes the test DB: each run uses uniquely-named fixtures.

## Key design decisions

- **Money is integer paise** everywhere. Prices are ex-GST; GST is computed per line from the category's rate,
  snapshotted onto each order item at order time. Liquor categories are seeded at 0% (outside GST).
- **One active session per table**, enforced by a partial unique index, so concurrent first orders join the same session.
- **Deleting a dish or portion archives it**, so past bills keep their history.
- **KDS realtime = 4–5 s polling.** Express's automatic ETag makes unchanged polls cheap. Firestore listeners
  can replace this later behind the same service.
- **KDS is a route in the admin app** (full-screen, kitchen role lands there), not a third app.
- **Payments**: if `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set, real Razorpay test checkout with HMAC
  signature verification. Otherwise stub mode, so the full loop is demoable with no account.
- **Images**: `STORAGE_DRIVER=local` stores uploads in `api/uploads` (dev). `firebase` uses Firebase Storage
  (prod). There's no Storage emulator because it needs Java.

See [DEPLOY.md](DEPLOY.md) for going live on Firebase.
