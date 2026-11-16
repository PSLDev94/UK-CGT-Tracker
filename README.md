# CGT Tracker relaunch

A fresh UK share-gains workspace: Next.js 16, React 19, TypeScript, PostgreSQL, Better Auth, Resend and the existing Stripe account. The working branch is `codex/relaunch`. This is a development preview, not a qualified tax-filing product.

## Run locally

Use Node 24, then `npm ci --ignore-scripts` and `npm run dev`. Public pages render without provider secrets. The private workspace requires the separate database logins and runtime configuration documented in [Access and operations](docs/relaunch/ACCESS_AND_OPERATIONS.md). Never put credentials in source control.

`npm run build && npm start` runs the standalone production bundle. The Dockerfile packages the same bundle as an unprivileged Node service. Build-time provider credentials are unnecessary. `/api/health` checks process liveness only; it does not prove database or provider readiness.

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

Financial, database and auth integration tests run against embedded PostgreSQL with captured email. Browser tests use the real production frontend with controlled API responses and synthetic trades. They do not replace hosted end-to-end testing, native broker certification or live provider qualification.

## Scope and release gates

- [Implementation plan](docs/relaunch/IMPLEMENTATION_PLAN.md)
- [API contract](docs/relaunch/API_CONTRACT.md)
- [Broker certification matrix](docs/relaunch/BROKER_SUPPORT.md)
- [UI contract](UX-CONTRACT.md) and [design system](DESIGN.md)

Ordinary shares in taxable accounts are the initial calculation scope. All six advertised broker families remain in scope, but native CSV support awaits verified export fixtures. The explicit CSV template supports controlled import testing. Unsupported or unresolved records prevent saving. Results distinguish missing history, provisional coverage and calculation completion; gains are not tax owed.

The live Stripe account, products, prices and customer records are preserved. Fresh checkout, portal, webhook reconciliation and report entitlements are pending. Legacy Supabase screens and routes were retired from active routing and remain recoverable in Git at `9ded8c0`. Production DNS has not been switched.
