# Soma Resources — Educational Marketplace MVP

Next.js 14 (App Router) + Prisma/Postgres (Neon) + Cloudflare R2 + M-Pesa STK Push + Resend.

## ⚠️ Verification status — read this first

This codebase was written and reviewed for correctness but **could not be
run end-to-end in the environment it was built in** — that sandbox has no
network access to `binaries.prisma.sh` (blocks `prisma generate`), Neon,
Cloudflare, Safaricom, or Resend. What *was* verified:

- `npm install` succeeds cleanly (Next.js pinned to 14.2.35, a patched version).
- `npx tsc --noEmit` produces only errors caused by the missing generated
  Prisma client (implicit `any` on query results) — no other type errors,
  no broken imports, no syntax errors.

What still needs a real pass before launch:
1. `npx prisma generate && npx prisma migrate dev` against an actual Neon database.
2. `npm run seed`, then `npm run dev` and click through the full customer flow.
3. M-Pesa **sandbox** integration test (see below) — the Daraja request/response
   shapes in `lib/mpesa.ts` match the published docs but have not been fired
   against Safaricom's servers.
4. A real R2 bucket + credentials, to confirm signed upload/download URLs work.
5. `npm audit` currently flags Next.js/postcss advisories with no fix in the
   14.x line (`npm audit fix --force` jumps to Next 16, a breaking change).
   Worth a deliberate upgrade decision before going to production rather than
   picking it up silently.

## Setup

```bash
npm install
cp .env.example .env   # fill in every value — see comments in the file
npx prisma migrate dev --name init
npm run seed            # creates admin@example.com / changeme123 — change this password immediately
npm run dev
```

### M-Pesa sandbox

1. Register at https://developer.safaricom.co.ke/, create an app, get your
   sandbox Consumer Key/Secret.
2. Use the published sandbox shortcode (174379) and passkey from Daraja's docs.
3. Safaricom needs a **public HTTPS** callback URL — it can't reach `localhost`.
   Use `ngrok http 3000` (or `cloudflared tunnel`) and set `MPESA_CALLBACK_URL`
   to `https://<your-tunnel>.ngrok-free.app/api/mpesa/callback`.
4. Test with Safaricom's sandbox test phone numbers (see their docs) — sandbox
   simulates PIN entry, no real money moves.

### Cloudflare R2

Create a bucket, then an R2 API token scoped to that bucket
(Account → R2 → Manage API Tokens). Files are private; the app only ever
hands out short-lived signed URLs, never public links.

### Resend

Verify a sending domain (or use their onboarding test domain while developing)
and set `RESEND_FROM_EMAIL` to an address on that domain.

## Architecture notes / where things live

- `prisma/schema.prisma` — the whole data model, heavily commented.
- `lib/mpesa.ts` — Daraja OAuth + STK Push + callback payload parsing.
- `lib/r2.ts` — signed upload URLs (admin) and signed download URLs (customer).
- `lib/email.ts` — Resend integration; failures are logged to `EmailLog`,
  never thrown, so a Resend outage can't turn a successful payment into an error.
- `app/api/mpesa/callback/route.ts` — the payment webhook. Idempotent by
  design: every callback is logged to `PaymentEvent`, and an order already
  marked `PAID` short-circuits before doing anything else, even if Safaricom
  sends the same callback twice.
- `app/api/orders/lookup/route.ts` + `app/orders/lookup/page.tsx` — the
  no-account redownload flow (email + phone → fresh download links).
- `components/PaymentWaiting.tsx` — polls `/api/orders/:id/status` every 3s;
  after 90s with no resolution it offers a retry that re-fires STK Push
  against the *same* order instead of creating a duplicate.

## Known gaps not yet built (from the original plan review)

- **Stale PENDING order sweep.** Orders that never get a callback (customer
  closed the tab) just sit as `PENDING` forever right now. Add a cron job or
  a scheduled Vercel function that marks orders `EXPIRED` after ~30 minutes
  with no callback.
- **Rate limiting** on `/api/orders` (order creation) and `/api/orders/lookup`
  (email+phone lookup) — both are public, unauthenticated, and could be
  abused (spam STK pushes to a phone number, or brute-force the lookup).
  Recommend a simple IP-based limiter (e.g. Upstash Ratelimit) before launch.
- **Callback authenticity.** Daraja doesn't sign callbacks by default. The
  current handler trusts any POST that references a known
  `CheckoutRequestID`. Consider IP-allowlisting Safaricom's published ranges
  as defense in depth.
- **VAT/e-receipt compliance** for digital goods in Kenya — flagged in the
  original plan review, not something code can resolve. Confirm with an
  accountant before finalizing pricing/receipts.
- No automated tests.
