# Deploying BARit to Firebase

Everything is configured. These are the one-time steps that need your accounts. Nothing here has been run yet.

## 1. Firebase / GCP project

1. Create a Firebase project (e.g. `barit-prod`) on the **Blaze** plan, which Cloud Functions and Cloud SQL require.
2. `npx firebase login`, then replace `demo-barit` in `.firebaserc` with your project id (both places).
3. Create the two Hosting sites and bind them to the targets:
   ```powershell
   npx firebase hosting:sites:create barit-guest
   npx firebase hosting:sites:create barit-admin
   npx firebase target:apply hosting guest barit-guest
   npx firebase target:apply hosting admin barit-admin
   ```

## 2. Authentication

Firebase console → Authentication → Sign-in method → enable **Phone**. Add your domains (`app.barit.in`,
`admin.barit.in`) under *Authorized domains*.

Register a **Web app** (Project settings → Your apps) and copy its config into
`apps/guest/src/environments/environment.prod.ts` and `apps/admin/src/environments/environment.prod.ts`.

## 3. Cloud SQL (PostgreSQL 16)

```bash
gcloud sql instances create barit-db --database-version=POSTGRES_16 --region=asia-south1 --tier=db-f1-micro
gcloud sql databases create barit --instance=barit-db
gcloud sql users create barit --instance=barit-db --password=<strong-password>
```

Run migrations and the seed from your machine through the Cloud SQL Auth Proxy:
```bash
cloud-sql-proxy <project>:asia-south1:barit-db --port 6543
# in api/: DATABASE_URL=postgresql://barit:<pw>@localhost:6543/barit npx prisma migrate deploy
#          DATABASE_URL=...                                        npx prisma db seed   (demo data)
```

## 4. Function configuration

The function reads its config from env. Put non-secret values in `.deploy/functions/.env.<projectId>`
(the build script keeps the folder; `.env.local` is emulator-only and never deployed):

```
GUEST_URL=https://app.barit.in
ADMIN_URL=https://admin.barit.in
STORAGE_DRIVER=firebase
```

Secrets go in Secret Manager:
```bash
npx firebase functions:secrets:set DATABASE_URL
#   postgresql://barit:<pw>@localhost/barit?host=/cloudsql/<project>:asia-south1:barit-db
npx firebase functions:secrets:set RAZORPAY_KEY_ID       # rzp_test_...
npx firebase functions:secrets:set RAZORPAY_KEY_SECRET
```
Then add `secrets: ['DATABASE_URL', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']` to the `onRequest` options in
`api/src/function.ts`.

Attach the Cloud SQL instance to the function's underlying Cloud Run service (once, after the first deploy):
```bash
gcloud run services update api --region asia-south1 --add-cloudsql-instances <project>:asia-south1:barit-db
```

## 5. Build & deploy

```powershell
npm run build                 # shared → bundled function (.deploy/functions) → both Angular apps (prod)
npx firebase deploy --only functions,hosting
```

`scripts/build-functions.mjs` compiles the API with `tsc` (Nest's DI needs decorator metadata, which esbuild
can't emit), then bundles it with esbuild. `@barit/shared` and the Prisma client are inlined, and
`.deploy/functions/package.json` lists only public npm packages, so Cloud Build can install it outside the monorepo.

## 6. Domains

Firebase console → Hosting → each site → **Add custom domain**: `app.barit.in` → guest, `admin.barit.in` → admin.
SSL certificates are issued automatically. The API needs no subdomain: each site serves it at `/api/**`
through the Hosting rewrite. A separate `api.barit.in` is optional.

## Before a public demo

- Razorpay: switch the keys from `rzp_test_` to live keys only after KYC; the demo stays in test mode.
- Set Firebase Auth **SMS region policy** to India, and enable App Check if the demo URL will be public.
- Rotate the seeded table QR tokens (Admin → Tables → ⟳) so the predictable `kk-t3`-style tokens aren't used.
