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

## Beta free-access mode

Set `BETA_FREE_MODE="true"` in your environment (both locally and in Vercel's
project settings) to let real users browse and download resources for free
while M-Pesa credentials are still pending. This skips the STK Push call
entirely — checkout goes straight to "paid," a download token is issued
immediately, and the receipt email still sends normally. A visible banner
appears site-wide so testers know it's temporary, and every beta order is
tagged `mpesaResultDesc: "BETA_FREE_MODE"` in the database so you can tell
them apart from real revenue once payments go live.

M-Pesa env vars (`MPESA_CONSUMER_KEY`, etc.) can stay blank while this is on
— `lib/mpesa.ts` is never called in beta mode. Flip `BETA_FREE_MODE="false"`
the moment Daraja credentials are ready; no other code changes needed.

## Hardening pass: rate limiting, callback security, cron, cart prep

1. **Rate limiting** — `lib/ratelimit.ts`. `/api/orders` (5/min/IP) and
   `/api/orders/lookup` (3/min/IP, tighter since it's an enumeration
   target) are now limited. Uses Upstash Redis when `UPSTASH_REDIS_REST_URL`
   / `UPSTASH_REDIS_REST_TOKEN` are set (correct across Vercel's multiple
   serverless instances); falls back to an in-memory limiter otherwise,
   which only works correctly single-instance — fine for dev, not a real
   guarantee in production. Get a free Upstash database before real launch
   traffic.

2. **No more hardcoded admin credentials.** `prisma/seed.ts` now requires
   `ADMIN_INITIAL_EMAIL` / `ADMIN_INITIAL_PASSWORD` env vars and refuses to
   run without them. **If you already seeded the old `admin@example.com` /
   `changeme123` account in production, change that account's password now**
   — this fix only prevents future re-seeds from using weak defaults, it
   doesn't retroactively touch an already-seeded database.

3. **M-Pesa callback hardening**, `app/api/mpesa/callback/route.ts`:
   - Optional shared-secret verification (`MPESA_CALLBACK_SECRET`) —
     `lib/mpesa.ts` appends it to the callback URL automatically, the
     webhook checks it. Without this, the endpoint trusts any POST
     referencing a known `CheckoutRequestID`.
   - Idempotency is now a genuinely atomic claim (`updateMany` with a
     `status: { not: "PAID" }` guard) instead of a read-then-write check —
     closes a real race-condition window where two concurrent duplicate
     callbacks could both pass a status check and both try to create a
     `DownloadToken`.

4. **Stale order cleanup** — `app/api/cron/expire-orders/route.ts`, protected
   by a `CRON_SECRET` bearer token, flips `PENDING` orders older than 30
   minutes to `EXPIRED`. Wired up two ways:
   - `vercel.json` — Vercel's built-in Cron. **Note: Vercel's Hobby (free)
     plan only allows daily schedules** — anything more frequent fails at
     deploy time — so this runs once a day by default.
   - `.github/workflows/expire-orders.yml` — a free GitHub Actions
     alternative that can run every 30 minutes instead, if once-daily
     cleanup isn't tight enough for you. Pick one; running both is
     harmless (idempotent) but redundant. Needs `SITE_URL` and
     `CRON_SECRET` added as GitHub Actions repo secrets.

5. **Cart-prep schema** — an additive `OrderItem` model (see
   `prisma/schema.prisma` for the full reasoning). Every order now writes
   one matching `OrderItem` row snapshotting the price at purchase time,
   alongside the existing `Order.resourceId`/`amountKsh` fields, which
   remain the source of truth for everything that exists today. This is
   pure groundwork — no cart UI exists yet — but means a future cart
   feature won't need a data migration for historical orders.

**New migration needed** (combines this and the previous preview-feature
column, since neither has been applied yet):
```bash
npx prisma migrate dev --name hardening_and_cart_prep
```

## Updates: thumbnails, PDF previews, curriculum dropdowns

Three things changed since the initial build, all in response to reviewing
the live deployed site:

1. **Thumbnails are now auto-generated** — `app/api/resources/[id]/thumbnail/route.ts`
   renders a branded SVG cover on the fly from each resource's title/subject/
   grade/type. No storage cost, no admin upload step, no schema change needed.

2. **PDF previews.** Uploading a PDF in the admin dashboard now automatically
   generates a watermarked, single-page preview (via `pdf-lib`, entirely
   client-side in the browser before upload) that customers can view before
   paying. This added a `previewFileKey` column to `Resource` — see the
   "Hardening pass" section below for the migration command (it's combined
   with a later schema change into one migration).
   Non-PDF uploads (pptx, docx) don't get a preview yet — silently skipped,
   not an error.

3. **Subject/grade are now dropdowns**, not free text — `lib/curriculum.ts`
   is the single canonical list (CBC + secondary: PP1–Grade 9, Form 1–4;
   full subject list) used by both the admin form and the homepage filters.
   This fixes a real bug: free-text fields had produced inconsistent casing
   ("CREATIVE ARTS" vs "Creative Arts") that fragmented the filter dropdown.
   Existing resources created before this change aren't automatically fixed —
   the homepage filter matches case-insensitively so old data still filters
   correctly, but re-editing old resources to use the canonical dropdown
   values is worth doing when you have a moment.

Also added: a favicon (`app/icon.svg`) and an Open Graph share image
(`app/opengraph-image.tsx`) so links shared on WhatsApp/Facebook render with
a proper preview instead of a blank card.

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
