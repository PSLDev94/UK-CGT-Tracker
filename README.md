# CGT Tracker relaunch

A fresh UK share-gains workspace: Next.js 16, React 19, TypeScript, PostgreSQL, Better Auth, Resend and the existing Stripe account. The working branch is `codex/relaunch`. This is a development preview, not a qualified tax-filing product.

## Run locally

Use Node 24, then `npm ci --ignore-scripts` and `npm run dev`. Public pages render without provider secrets. The private workspace requires the separate database logins and runtime configuration documented in [Access and operations](docs/relaunch/ACCESS_AND_OPERATIONS.md). Never put credentials in source control.

`npm run build && npm start` runs the standalone production bundle. The Dockerfile packages the same bundle as an unprivileged Node service. Build-time provider credentials are unnecessary. `/api/health` checks process liveness; `/api/ready` checks runtime configuration and the app/auth database connections. Neither proves email or payment provider readiness.

The [Railway staging preview](https://web-staging-e003bc3b.up.railway.app) is deployed with private PostgreSQL 18 and hourly expired-draft cleanup. Production DNS has not changed.

## Verify

```bash
npm run check:core
npm run lint
npm run check:design
npx tsc --noEmit --incremental false
npm run db:generate-auth
git diff --exit-code -- db/migrations/0003_auth.generated.sql
npm audit --omit=dev --audit-level=high
npm run build
npx playwright install chromium
npm run test:ui
```

The main financial/auth suite runs against embedded PostgreSQL with captured email. A separate `npm run test:postgres` suite requires a fresh local PostgreSQL 18 database named `cgt_qualification`, supplied through `POSTGRES_TEST_DATABASE_URL`; CI provisions this disposable database and tests real role logins and concurrent transactions. Browser tests use the real production frontend with controlled API responses and synthetic trades. They do not replace hosted end-to-end testing, native broker certification or live provider qualification.

Run `STAGING_ORIGIN=https://web-staging-e003bc3b.up.railway.app node scripts/smoke-staging.mjs` to check the deployed pages/assets, readiness, anonymous-session boundary, foreign-origin rejection and sign-in rate limiting with forged forwarding headers. It creates no accounts and sends no email. It uses the sign-in rate-limit window for the caller's IP; allow a minute before another sign-in test. This is a limited hosted smoke test, not an authenticated import-to-report journey.

## Scope and release gates

- [Implementation plan](docs/relaunch/IMPLEMENTATION_PLAN.md)
- [API contract](docs/relaunch/API_CONTRACT.md)
- [Broker certification matrix](docs/relaunch/BROKER_SUPPORT.md)
- [UI contract](UX-CONTRACT.md) and [design system](DESIGN.md)

Ordinary shares in taxable accounts are the initial calculation scope. All six advertised broker families remain in scope, with limited GBP preview readers for specific Trading 212 and Freetrade layouts. Other native variants stay in review. The synthetic corpus documents observed schemas separately from unverified illustrations; it is not broad broker certification. The explicit CSV template supports controlled import testing. Unsupported or unresolved records prevent saving. Results distinguish missing history, provisional coverage and calculation completion; gains are not tax owed.

The live Stripe account, products, prices and customer records are preserved. Sandbox Checkout, customer portal and signed webhook reconciliation are deployed. Hosted tests verified paid access, duplicate prevention, portal cancellation and persistent refund review holds. Overdue/3DS/dispute recovery and paid report enforcement remain release gates. See [billing contract](docs/relaunch/BILLING.md). Legacy Supabase screens and routes were retired from active routing and remain recoverable in Git at `9ded8c0`. Production DNS has not been switched.

Hosted email delivery, verification, password reset/session revocation and the authenticated template import → calculation → duplicate → reversal journey were verified on 16 November 2026. Native Freetrade and Trading 212 GBP fixture journeys subsequently matched independently expected gains (£74.37 and £5.25). Corporate-action and duplicate files were blocked by the server without partial writes. Evidence and limits are recorded in the operations document.
