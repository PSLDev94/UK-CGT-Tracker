# CGT Tracker relaunch implementation plan

Updated 16 November 2026. Work branch: `codex/relaunch`.

## Decisions

Build fresh application, database and authentication. Preserve the existing Stripe account, product and annual price. Serve the finished product at https://www.cgttracker.com using Cloudflare DNS. Keep the previous implementation in Git history and as a reference during the transition; do not redeploy it as the relaunch.

Selected architecture: Next.js and TypeScript, PostgreSQL, Better Auth, Stripe Checkout and Customer Portal, Resend transactional email, Railway application hosting. Deployment must be portable through a container. PostgreSQL is private; the browser never receives database credentials. Authentication and billing use separate permissions.

The first increment added isolated financial modules to `src/domain`; the second added authentication and transaction services in `src/server`, with versioned `/api/v2` routes. The third replaces the active frontend with the new API-driven workspace and removes legacy Supabase routes and dependencies. The previous application remains recoverable at commit `9ded8c0`. This preview is not yet a qualified customer release.

## Delivery sequence and acceptance criteria

| Stage | Deliverable | Exit condition | Status |
| --- | --- | --- | --- |
| 1 | Access and repository setup | GitHub checkout, service logins verified, private staging project | Management access verified; Resend and sandbox Stripe keys applied to staging |
| 2 | Calculation core | Reproduced matching defects corrected; deterministic decimal arithmetic; missing history blocks totals | Implemented and tested; independent tax review still required |
| 3 | Import safety foundation | Every data record classified; conflicts block commit; FX provenance retained | Strict classification, full-file rejection and supporting details implemented; six explicit broker paths covered by synthetic fixtures |
| 4 | Fresh data model | Ownership constraints, immutable calculation runs, separate billing writes, rollback tests | Nine migrations qualified on PostgreSQL 18 in CI and applied to Railway staging; four runtime logins verified; logical backup/restore rehearsal passed |
| 5 | Application and authentication | Signup, verification, reset, sessions, account ownership and secure runtime setup verified | Original UI restored over the new backend; hosted verification delivery, password reset and session revocation verified |
| 6 | Native broker adapters | Every named export variant passes representative anonymised fixtures and reconciliation checks | Explicit six-broker layouts implemented; genuine export certification remains open, especially AJ Bell's candidate layout |
| 7 | Import and review workspace | Preview, repair, retry, correction, reversal, history and report-readiness flows | Persisted supporting details, stale-edit protection, source provenance, paginated review/history and reversal implemented in original UI |
| 8 | Billing and reporting | Sandbox lifecycle tests; year-specific report checks; existing Stripe entitlements reconciled | CSV/PDF reports and server-side paid enforcement implemented; hourly reconciliation job prepared. Hosted checkout/webhook/portal/cancellation/refund checks passed previously; renewal/3DS/dispute/recovery and legacy ownership remain |
| 9 | Release qualification | Browser/security/accessibility/load/recovery tests; tax review; user acceptance | CI passed: 232 tests, 33 browser checks, PostgreSQL 18 concurrency/permissions/restore and portable build. Independent tax review, real-export qualification and user acceptance remain |
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

Import commits and reversals now run in database transactions. A portfolio row lock and revision checks serialise writes, and partial unique indexes guard active source IDs. Commit re-parses the saved server-side CSV against current records. A changed portfolio requires another confirmation. The draft UUID is the import UUID, making commit retries idempotent. Reversal retains transactions and receipts as history, deactivates their financial effect, and invalidates published results without altering old calculation snapshots. A replacement import and recalculation then produce a new snapshot. The service loads the full active history; the UI provides paginated navigation for the full receipt history.

The fresh database roles are `cgt_app`, `cgt_auth`, `cgt_billing` and `cgt_maintenance`. Use distinct login credentials and a separate migration owner. Runtime startup rejects owner/superuser/bypass-RLS credentials and mixed role memberships. Set `cgt.owner_id` transaction-locally only after verifying a server-side session and email verification. RLS is defence in depth: never expose SQL or let requests choose owner IDs. Financial owners now reference auth users; deletion is restricted until the account-retention workflow is implemented. Raw CSV drafts expire after 24 hours, with hourly cleanup required in staging/production; committed drafts are removed immediately. The maintenance role cannot read CSV contents or delete unexpired drafts.

## Stripe continuity

The existing live account is UK CGT Tracker. Its active recurring price is GBP 49 annually. It was inspected read-only. Preserve product/price IDs and customer/subscription records. The connected cgt sandbox is for development; production and sandbox credentials, IDs, webhook secrets and events must stay separate.

Before launch, reconcile any existing active subscriptions into the fresh account model through verified ownership; do not create duplicate subscriptions or silently discard paid entitlements. Verify raw-body signatures, persist processed event IDs, and reconcile the latest Stripe subscription state so late events cannot regress entitlements. Test checkout, renewal, cancellation, failed/async payments, refunds and disputes. Keep billing endpoints separate from ordinary profile updates.

The current live price has unspecified tax behaviour. Confirm the business's VAT/tax-registration treatment before production checkout configuration; do not enable automatic tax or change the existing price based on an assumption.

## Release gates

- All advertised broker variants have reviewed fixtures; every input record is reconciled.
- No open incorrect-calculation, data-loss, cross-user-access or payment-entitlement defects.
- An independent UK tax reviewer validates representative matches, limitations, rounding and report mappings.
- Authentication, email, billing and import-to-report journeys pass in staging and production smoke tests.
- Dependency audit and production build pass for the fresh application. The new standalone production build and dependency audit pass. Controlled browser tests pass; hosted integration qualification remains open.
- Database migration, backup restoration and deployment rollback are rehearsed.
- Privacy, supported-scope, retention, pricing and cancellation information match actual behaviour.
- Domain, TLS, canonical redirects, callbacks, webhooks, cache bypass for private routes and monitoring are verified.

## Verification of the first increment

Commands: `npm run check:core`, `npx eslint src/domain tests vitest.config.mts`, `npx tsc --noEmit`, `git diff --check`.

The tests cover matching regressions, repeatability, order invariance, 300 generated invariant examples, date boundaries, incomplete histories, CSV safety, FX evidence, duplicate/conflicting source IDs, account wrappers, PostgreSQL row isolation, billing permissions, immutable snapshots and transactional rollback. PGlite executes real embedded PostgreSQL; it does not replace verification against the hosted PostgreSQL configuration.

The GitHub workflow now checks the application build, financial and auth integration suite, schema drift, types, lint, dependency audit, design-token consistency and controlled browser journeys. Deployed authentication, native broker certification, Stripe lifecycle integration and report generation remain release gates.

## Verification of the second increment

Node 24, Next 16.4.6, React 19.3.1, Better Auth 1.7.25 and Kysely 0.29.9 are pinned or constrained in the lockfile/runtime configuration. The existing Stripe SDK is pinned to its original 22.0.0; the live integration's API version, account, products and prices were not changed.

The suite now tests actual Better Auth HTTP handlers against embedded PostgreSQL with captured email, including verification, password hashing, reset-token reuse, session revocation, foreign-origin/redirect rejection and database-backed rate limits. Application tests cover request size/encoding, private cache headers, owner forgery, preview pagination, server-side commit validation, rollback, duplicate retries, stale revisions, reversal, retained snapshots, completeness attestation, expiry cleanup and least-privilege runtime credentials. These are application integration tests, not hosted/browser end-to-end evidence.

Full TypeScript and targeted lint pass. The new API also returns a controlled setup-unavailable response when required runtime configuration is absent. The full inherited Next build compiles and typechecks, but fails during page-data collection at the legacy Resend contact route. No substitute credentials were supplied to make that build appear deployment-ready.

The third increment below resolves the inherited frontend/build blocker. Hosted PostgreSQL, provider delivery, trusted ingress IP handling and live browser integration still require qualification. All six native broker families remain in scope and require representative exports before certification.


## Verification of the third increment

Fresh pages cover account signup/sign-in/recovery/reset, account setup, explicit-format CSV upload, row reconciliation, stale-review confirmation, calculation evidence and import reversal/history. Public pages state the current scope and native-verification status. Financial display uses decimal strings even for values beyond JavaScript's safe integer range. All active Supabase, AI parsing and old payment/report routes are retired; their behaviour is not advertised in the preview. Existing Stripe account, products, prices and customer records remain unchanged. Checkout, portal, signed webhook handling and entitlement reconciliation must be rebuilt before accepting payments.

Local evidence: 111 financial/auth/API/display tests, seven production-build Chromium journeys, full lint/typecheck, production dependency audit (zero vulnerabilities), and the standalone Next build pass. Browser tests include automated WCAG A/AA scans, 375px layout, keyboard controls, modal focus restoration, interrupted upload recovery, pending-action controls and explicit leave confirmation. They use controlled API responses and synthetic data; they do not prove hosted database/email/payment operation. Docker packaging is prepared but has not been container-built locally because no Docker engine is available. Manual zoom, additional browsers and hosted load/recovery tests remain open.

The migration/login job and staging web deployment are now applied. Hosted readiness, private-route boundaries and forged-header rate limiting pass. Hosted auth → import → calculation/reversal is verified. Complete sandbox lifecycle, reports and recovery qualification next. Keep www.cgttracker.com unchanged until the production release gates pass.


## PostgreSQL deployment qualification

PostgreSQL 18 is now running in Railway staging (Europe West, one replica, 1 GiB volume). The user applied the initial deployment in the dashboard after connector cancellation. Resend delivery and Stripe hosted Checkout/Portal operations have runtime evidence in ACCESS_AND_OPERATIONS.md.

The container now includes database migration, role-provisioning and expiry-cleanup commands. Eight added configuration tests reject wrong destinations, owner logins, weak/shared passwords and unexpected URL options before connecting. A separate PostgreSQL 18 CI suite tests actual migrations, idempotent setup, role restrictions, concurrent writes and verification/session revocation with captured mail. The one-time setup job completed separately from the web service; migration-owner credentials are not provided to the web runtime.

Concurrency review identified a retry edge case: another request can commit and remove a draft between the retry's first receipt query and draft query. Commit now rechecks for the saved receipt before reporting an expired draft. A deterministic PostgreSQL test interleaves the two requests at that exact point. Further qualification checks that mismatched supplied credentials fail without replacing an existing login password.


## Hosted preview milestone

The initial [staging preview](https://web-staging-e003bc3b.up.railway.app) launched at commit `cd660f0`; see ACCESS_AND_OPERATIONS.md for subsequent billing deployments and actual source revisions. Readiness checks its actual private database connections. Hourly draft cleanup is deployed; its manual staging execution succeeded with zero expired drafts. No production DNS or live Stripe changes were made.

Verification now includes 119 core/configuration tests, 10 real PostgreSQL 18 qualification tests and seven controlled Chromium journeys in green CI, plus a repeatable hosted smoke probe and rendered-page inspection. The probe validates anonymous access rejection, foreign origins and resistance to forged IP rate-limit headers without creating accounts or sending email. This does not complete hosted authentication/email, native broker certification, billing, reports or recovery qualification. See access/operations for deployment IDs and evidence.


## Next release work

1. Expand representative broker evidence and implement qualified fee/FX/report variants; keep unsupported formats blocked. Add clearer assisted recovery without encouraging deletion or invented data.
2. Build auditable year-specific reports and server-side paid-report entitlement enforcement, then commission independent UK tax review.
3. Qualify renewal failure/recovery, 3DS, delayed webhook replay and disputes; implement periodic billing reconciliation, alerts and audited review/recovery tools.
4. Exercise PostgreSQL backup restoration, load/security checks and immutable artifact rollback. Finish privacy/retention/account deletion and operator runbooks.
5. Resolve VAT/Stripe Tax and existing-customer ownership policy, then obtain production launch approval for Cloudflare DNS and live billing.


## November 2026 interface redesign

At the user's request, replaced the rejected initial visual system using inspected Mobbin examples (Stripe balance summaries and Monarch account/CSV import) and the Frontend Design Premium workflow. The app now has a compact branded rail without the duplicate marketing header, real account/import/preview counts, side-by-side account setup and account records, and a prominent net gain beside calculation settings. Public pages, authentication and billing share self-hosted Manrope/DM Sans and the new slate/indigo tokens. The home example explicitly labels its synthetic £795 − £404 = £391 calculation.

Code revision: `5e6324994b1e65c8bf027614ef14630055412f24`. Local checks pass: 203 core tests, 10 Chromium journeys, WCAG A/AA scans in the exercised journeys, full TypeScript, lint, production build and all 15 design-token matches. Strict premium audit returns zero findings. The design.md CLI reports zero errors and five documentation-only orphan-token warnings; runtime CSS and the project's token contract verify those colours are consumed. Production dependency audit reports zero vulnerabilities. CI run [44054838414](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44054838414) also passes the real PostgreSQL 18 and portable-container jobs.

Visual inspection covered the public home, account overview, import review, calculation evidence and the 375px mobile import form. A mobile-only broker-support navigation regression was found and fixed before release. The earlier side-tab accent finding is absent from the final stylesheet; no suppressions were added and no side accent border was retained. Before/after captures and an embedded comparison board are kept in `.private/redesign/` outside Git. Business rules, supported broker formats and production launch gates remain as documented above.

## Review increment — 17 November 2026

See [current review scope and gates](REVIEW_READY.md), which supersedes the earlier two-broker/PDF-placeholder status above. Implemented explicit additional broker readers, persisted supporting-details recovery with stale-edit protection, saved-result PDF and CSV reports with server-side paid access, durable contact throttling/email submission, a portable reconciliation job, per-request script CSP nonces, and a CI logical PostgreSQL backup/restore rehearsal. Original UI remains the visual authority.

This is review preparation. It does not claim universal CSV compatibility, independent tax approval, finalized legal/retention policy or production deployment approval.
