# CGT Tracker relaunch implementation plan

Updated 16 November 2026. Work branch: `codex/relaunch`.

## Decisions

Build fresh application, database and authentication. Preserve the existing Stripe account, product and annual price. Serve the finished product at https://www.cgttracker.com using Cloudflare DNS. Keep the previous implementation in Git history and as a reference during the transition; do not redeploy it as the relaunch.

Selected architecture: Next.js and TypeScript, PostgreSQL, Better Auth, Stripe Checkout and Customer Portal, Resend transactional email, Railway application hosting. Deployment must be portable through a container. PostgreSQL is private; the browser never receives database credentials. Authentication and billing use separate permissions.

The first increment adds isolated financial modules to `src/domain` and a new database migration. The old routes still call the old engine. Wiring the new modules into the old routes without replacing their persistence and failure handling is deliberately not part of this increment.

## Delivery sequence and acceptance criteria

| Stage | Deliverable | Exit condition | Status |
| --- | --- | --- | --- |
| 1 | Access and repository setup | GitHub checkout, service logins verified, private staging project | Done; runtime API keys requested |
| 2 | Calculation core | Reproduced matching defects corrected; deterministic decimal arithmetic; missing history blocks totals | Implemented and tested; independent tax review still required |
| 3 | Import safety foundation | Every data record classified; conflicts block commit; FX provenance retained | Canonical interchange format implemented; native adapters pending |
| 4 | Fresh data model | Ownership constraints, immutable calculation runs, separate billing writes, rollback tests | SQL migration tested in embedded PostgreSQL; not applied to Railway |
| 5 | New application and authentication | Signup, verification, reset, sessions, account ownership and secure runtime setup verified | Next |
| 6 | Native broker adapters | Every named export variant passes representative anonymised fixtures and reconciliation checks | Pending verified fixtures; all six brokers remain in scope |
| 7 | Import and review workspace | Preview, repair, retry, correction, reversal, history and report-readiness flows | Pending |
| 8 | Billing and reporting | Sandbox lifecycle tests; year-specific report checks; existing Stripe entitlements reconciled | Pending |
| 9 | Release qualification | Browser/security/accessibility/load/recovery tests; tax review; user acceptance | Pending |
| 10 | Production release | Domain, TLS, callbacks, webhooks, email, monitoring, backup restoration and rollback verified | Pending |

Proceed through this sequence autonomously within the user's requested rebuild. Do not interpret a green core test suite as production readiness. Use staging and sandbox payments until release qualification passes.

## Financial scope and safeguards

The core accepts ordinary share acquisitions/disposals for one taxpayer in one legal capacity, across that taxpayer's taxable accounts. It uses stable security IDs and aggregates same-day acquisitions and disposals before matching. All same-day matches are reserved globally before applying 30-day matching, then Section 104 pooling. Inputs and outputs use decimal strings. Calendar arithmetic uses UTC date-only values.

Tax years 2021–22 through 2026–27 are configured centrally. Imported earlier acquisitions can establish the pool. Verified opening pools are explicit, with overlap checks. Pre-April-1982 acquisitions, corporate actions, funds/ETFs needing adjustments, employee share schemes, derivatives, crypto and non-resident cases require additional work or explicit exclusion before release. This is an initial engine scope, not permission to silently drop unsupported records.

Missing acquisition history produces blocking issues and no aggregate gain summary. Incomplete year/look-ahead history produces provisional results. A declaration that history extends to a date is a customer attestation, not evidence that every broker has been imported; the application must obtain account coverage and completeness confirmation. A complete engine result is not HMRC approval or a final personal tax liability.

The engine calculates gains and losses. Application of personal allowances, losses brought forward, reliefs, other gains, income bands and mid-year tax rates belongs in a separately verified liability calculation. Do not label taxable gains as tax owed.

Sources reviewed on 16 November 2026:

- [HMRC same-day and 30-day identification rules](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560)
- [HMRC Section 104 holdings](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51575)
- [HMRC rates and allowances](https://www.gov.uk/guidance/capital-gains-tax-rates-and-allowances)
- [SA108 forms and year-specific notes](https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108)

## Architecture boundaries

`src/domain/cgt` is independent of Next.js, authentication, AI, payment providers and the database. `src/domain/imports` runs on the server and returns a preview, not writes. Always regenerate the preview server-side on commit against current database state; never trust a posted preview or accepted-row count.

Commit imports, normalised transactions and publication changes in database transactions. Use source-ID uniqueness as the final concurrent-import guard, with per-portfolio serialisation/revision checks. Load full histories with explicit paging; no reliance on provider row limits. Corrections/reversals create a new calculation run and invalidate prior report readiness without rewriting old snapshots. These application services are still to be implemented.

The fresh database roles are `cgt_app` and `cgt_billing`. Use a distinct migration owner; production application connections must not be owners or superusers. Set `cgt.owner_id` transaction-locally only after verifying a server-side session. RLS is defence in depth, not authentication: never expose SQL or let a request choose its owner context. Attach the eventual auth-user lifecycle to portfolio/data deletion, including a tested retention policy.

## Stripe continuity

The existing live account is UK CGT Tracker. Its active recurring price is GBP 49 annually. It was inspected read-only. Preserve product/price IDs and customer/subscription records. The connected cgt sandbox is for development; production and sandbox credentials, IDs, webhook secrets and events must stay separate.

Before launch, reconcile any existing active subscriptions into the fresh account model through verified ownership; do not create duplicate subscriptions or silently discard paid entitlements. Verify raw-body signatures, persist processed event IDs, and reconcile the latest Stripe subscription state so late events cannot regress entitlements. Test checkout, renewal, cancellation, failed/async payments, refunds and disputes. Keep billing endpoints separate from ordinary profile updates.

The current live price has unspecified tax behaviour. Confirm the business's VAT/tax-registration treatment before production checkout configuration; do not enable automatic tax or change the existing price based on an assumption.

## Release gates

- All advertised broker variants have reviewed fixtures; every input record is reconciled.
- No open incorrect-calculation, data-loss, cross-user-access or payment-entitlement defects.
- An independent UK tax reviewer validates representative matches, limitations, rounding and report mappings.
- Authentication, email, billing and import-to-report journeys pass in staging and production smoke tests.
- Dependency audit and production build pass for the fresh application. The inherited web dependencies currently contain security advisories and are not release-qualified.
- Database migration, backup restoration and deployment rollback are rehearsed.
- Privacy, supported-scope, retention, pricing and cancellation information match actual behaviour.
- Domain, TLS, canonical redirects, callbacks, webhooks, cache bypass for private routes and monitoring are verified.

## Verification of the first increment

Commands: `npm run check:core`, `npx eslint src/domain tests vitest.config.ts`, `npx tsc --noEmit`, `git diff --check`.

The tests cover matching regressions, repeatability, order invariance, 300 generated invariant examples, date boundaries, incomplete histories, CSV safety, FX evidence, duplicate/conflicting source IDs, account wrappers, PostgreSQL row isolation, billing permissions, immutable snapshots and transactional rollback. PGlite executes real embedded PostgreSQL; it does not replace verification against the hosted PostgreSQL configuration.

The GitHub workflow checks this core increment only. It is not yet the application's end-to-end release workflow. Browser QA, deployed authentication, native broker certification, Stripe lifecycle integration and report generation remain pending.
