# Relaunch access and operations

Verified 16 November 2026:

- GitHub source: https://github.com/PSLDev94/UK-CGT-Tracker
- Railway: new private [CGT Tracker project](https://railway.com/project/cb6c0af0-18e8-401f-aafd-9edad5956df9), `staging` environment with the [web preview](https://web-staging-e003bc3b.up.railway.app) online. PostgreSQL 18 has one healthy Europe West replica and its 1 GiB private volume. Seven migrations and four separate runtime logins are applied. The web service has separate app/auth/billing access; maintenance remains a separate job. The hourly cleanup service is deployed and its first manual execution succeeded.
- Stripe: existing UK CGT Tracker live account and cgt sandbox accessible. Live annual GBP 49 price inspected without changes.
- Cloudflare: cgttracker.com zone active. The www record still points to the previous Vercel target. Hosting DNS has not been changed during this increment; existing mail records remain intact.
- Resend: signed-in account already shows cgttracker.com as Verified. Verification and reset test messages were delivered to the owner-authorised mailbox; see qualification below.

## Runtime configuration

Connected management tools are not runtime application credentials. The user added `RESEND_API_KEY` and sandbox `STRIPE_SECRET_KEY` directly in Railway. Both names are confirmed in applied staging web variables, with values withheld. Sending, verification/reset, sandbox customer/Checkout/Portal creation and billing reconciliation have now succeeded at runtime. Check names/sealed status without printing values. Prefer sending-only/domain-scoped Resend access and a restricted Stripe key with only the operations needed for the implemented checkout/portal flow. Verify permissions with actual sandbox tests before calling access complete.

App/auth database references, an independently generated session secret and the staging application origin are configured. A dedicated sandbox webhook signing secret is configured directly in Railway for the implemented endpoint. Generate application secrets with a cryptographic random source. Use separate production values and separate webhook endpoints. Never place keys in chat, source control, shell arguments, logs, browser-exposed variables or documentation.

The second increment implements these runtime names (none are browser-public):

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact HTTPS origin in production, no path or trailing slash. Use the staging hostname before domain cutover. |
| `APP_DATABASE_URL` | Dedicated login with membership only in `cgt_app`; must not own tables or bypass RLS. |
| `AUTH_DATABASE_URL` | Separate login with membership only in `cgt_auth`. |
| `BETTER_AUTH_SECRET` | Independently generated high-entropy secret, at least 32 characters. |
| `AUTH_CLIENT_IP_HEADER` | Header demonstrably overwritten by the trusted ingress. Verify against forged headers and direct-origin access before choosing a value. |
| `RESEND_API_KEY` | Domain-scoped runtime sending key; applied to staging web and runtime-qualified. |
| `AUTH_EMAIL_FROM` | Verified plain sender address under `@cgttracker.com`, for example `accounts@cgttracker.com`. |
| `STRIPE_SECRET_KEY` | Restricted sandbox key for hosted Checkout, Portal and reconciliation; applied to staging web and runtime-qualified. |

The application creates pools lazily and checks effective roles before use. Do not put a migration-owner URL in either runtime variable. The legacy Supabase connection is not a fallback for the new API.

Use `MIGRATION_DATABASE_URL` only in the migration job with `npm run db:migrate`. The runner applies ordered SQL migrations with a session lock, recorded SHA-256 checksums and an atomic migration-plus-record transaction. Changed already-applied migrations fail; add a new numbered migration instead. The five fresh migrations include the schema generated from pinned Better Auth. CI compares regenerated SQL and tests schema drift against the actual auth options.

Run `npm run db:expire-drafts` hourly with `MAINTENANCE_DATABASE_URL` on a separate job whose login has only `cgt_maintenance` membership. Drafts become unusable at 24 hours; scheduled deletion should remove their raw contents by the next hourly run. Alert on cleanup failure. The hourly schedule is deployed. A manual execution on 16 November 2026 at 18:05 UTC succeeded and removed zero expired drafts. Cleanup failure alerting remains a release task. Committed drafts are deleted within the import transaction; record classifications, provenance and historical calculations are retained. The complete financial-data retention/account-deletion policy remains a release requirement.

## Before deployment

1. The fresh app builds as a standalone Node 24 service, with a Dockerfile and no build-time provider credentials. Deploy a tested commit; do not connect Railway to the legacy application entry point.
2. Provision private PostgreSQL, select a suitable region, configure backups and test restoration.
3. Apply versioned migrations using the migration owner. Configure separate web/auth/billing/maintenance credentials with limited role membership. Run hosted migration, concurrency, role-isolation, backup/restore and auth lifecycle checks.
4. Set all required runtime variables and register a sandbox Stripe webhook. Validate retries, signatures and event reconciliation.
5. Deploy staging, exercise browser journeys and verify email delivery without disclosing real customer data.
6. Only after release gates pass, connect www.cgttracker.com and redirect the apex domain. Preserve existing mail/DKIM/SPF/MX records. Do not cache authenticated routes or tax data at Cloudflare.
7. Verify HTTPS, callbacks, billing, reports, monitoring and rollback against the actual production origin.

## Current staging status and setup job

PostgreSQL and the web service are running. Existing-plan usage charges apply. The public staging URL is https://web-staging-e003bc3b.up.railway.app. Production DNS is unchanged. Provider delivery/payment evidence is recorded in the dated qualification sections below.

`database-setup` completed as a one-time Europe West job, with restart policy NEVER. Its command is `sh -c 'node scripts/migrate.ts && node scripts/provision-runtime-logins.ts'`. It has the migration-owner URL through a private Railway reference and four separate, independently generated runtime URLs. The web service receives its separate app/auth/billing references, a separate generated session secret and the verified-domain sender. No credentials were written to Git or displayed in the conversation. The setup job completed successfully on 16 November 2026 at 17:54 UTC. Its logs confirm all five migrations and four independent runtime connections.

The provisioning script creates fixed `cgt_runtime_app`, `cgt_runtime_auth`, `cgt_runtime_billing` and `cgt_runtime_maintenance` logins with distinct 32–128-character base64url passwords. Each has NOINHERIT and can SET ROLE only to its single expected NOLOGIN group. It validates existing memberships/ownership and never silently rotates a password. All four runtime URLs must target the same database and connection settings as the migration URL. Configure them together in the job, then reference each from its corresponding service. Keep the migration-owner reference out of the web/worker services. Do not delete the setup service while other services reference its variables; move credentials deliberately if retiring it.

The container includes migration, provisioning and cleanup scripts. Run them with Node 24 directly; no development tooling is needed in the runtime image. CI qualifies all migrations, login provisioning, permission boundaries, real concurrent imports/reversals and verified auth sessions against a disposable PostgreSQL 18 service. These checks complement, rather than replace, tests of Railway networking, backups, role configuration and provider delivery.

The connector's `accept-deploy` calls were cancelled with “the user did not approve this action,” despite chat approval. The user applied the database and setup job through Railway. The user then explicitly approved the 28 prepared web/cleanup changes, which were applied through the signed-in browser. There are no pending changes from this deployment. The public website remains gated on hosted integration, verified broker formats, billing and reporting qualification.


## Hosted staging verification — 16 November 2026

Web deployment `202d5880-4968-40c8-a8ef-473d06a8d3e5` and cleanup deployment `703cac89-7703-425f-801a-abf8fc9e4270` use tested commit `cd660f01a7df28530242996957475cea466c43cb`. Web readiness is `/api/ready`; it validates the runtime and checks both app/auth database connections before returning 200. It returns a generic 503 on failure. The database remains private; no TCP proxy was opened.

The repeatable `scripts/smoke-staging.mjs` probe passed: home, packaged CSS, broker support, workspace shell, signup and liveness/readiness routes; no-index/frame-denial headers; anonymous session returned null; private API rejected anonymous requests with 401 and foreign origins with 403. Seven nonexistent-user sign-in requests with different forged `x-real-ip` and `x-forwarded-for` headers returned 401 five times, then 429 twice. This validates the configured Railway `x-real-ip` trust boundary for the current direct staging ingress; repeat after any proxy/topology change. No account was created or email sent.

Browser inspection confirmed the rendered home page and the workspace sign-in/verified-email gate. The cleanup execution emitted `expired_import_drafts_removed` with count 0 and completed. Node emitted a non-fatal module-type detection warning for its TypeScript script; the command itself succeeded.

CI at this deployed commit passed 119 core/configuration tests, 10 real PostgreSQL 18 qualification tests and seven controlled Chromium journeys, plus types, lint, schema drift, design tokens, dependency audit, build and container startup. See [run 43923822197](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/43923822197).

At this initial deployment, email, authenticated imports and Stripe were unverified. Later qualification is recorded below. Native broker certification, reports, monitoring alerts and backup restoration remain release gates. The preview is not ready to accept paying customers.

## Hosted authentication and import qualification — 16 November 2026, 18:20–18:23 UTC

The owner explicitly authorised a test mailbox. Signup returned 200; Resend recorded delivery of the verification email from accounts@cgttracker.com. Following the real link verified the user and the browser signed in. No mail credentials, passwords, cookies or tokens were logged or committed.

In the actual hosted browser: created a labelled synthetic taxable account; uploaded `tests/fixtures/canonical-trades.csv`; reconciled 3 records as 2 accepted trades and 1 excluded dividend; saved the trades and calculated 2024–25 gains. Independent arithmetic: purchase cost `(1000 + 10) × 0.8 = £808`; half the pool costs £404; sale proceeds `800 − 5 = £795`; gain £391. The displayed pool match and totals agreed. A second upload classified both trades as duplicates and offered no Save action. Reversal retained the import/reason in history and invalidated the published calculation.

Password-reset mail was delivered. The real reset link worked; API checks confirmed that the old session returned null, the old password returned 401, reusing the reset token returned 400 and the new password signed in successfully. Test credentials are local-only in an ignored, mode-0600 file pending further staging tests. The synthetic duplicate draft will expire under the existing cleanup schedule.

Email delivery/verification/reset and the canonical hosted import-to-calculation/reversal journey now have runtime evidence. Native broker certification, sandbox billing lifecycle, reports and operational recovery remain open. A modal focus issue observed in the hosted browser was corrected in the following development increment by explicitly focusing Cancel when opening a modal.


## Billing deployment and release control — 16 November 2026

The owner approved the 14-change sandbox billing deployment. Railway applied the runtime variables and billing migration. The staged source reported commit `01e60a0`, but the actual deployment metadata showed branch HEAD `5913043`; the setup job also applied additive migration 0007. A corrective deployment from dedicated branch `codex/staging-billing-01e60a0` restored the approved billing code. The additional column remains backward compatible and was retained. No production DNS or live Stripe resources changed.

Do not treat the staged `commitSha` display as proof of the deployed revision. Keep the release branch at the reviewed commit, check the deployment's actual `meta.commitHash`, then check readiness and the affected journey. For production, establish immutable artifact promotion and test rollback before launch. The observed correction restored web deployment `449592c3-5c69-482b-96a3-50dd65504079` to `01e60a0`; setup deployment `32b243af-e791-4f33-b56c-cda0844cea91` succeeded against the compatible seven-migration database.

The sandbox webhook was enabled only after unsigned requests returned 400. Hosted Checkout completed a £49 test-card payment; Stripe reported `complete`, `paid`, `livemode=false`. Railway recorded three successful signed webhook requests before the return-page status refresh. The application returned `active`, `entitled=true`. The customer portal loaded the expected subscription, invoice and test card. Portal cancellation scheduled the end of the paid period, but exposed a gateway bug: flexible billing sets `cancel_at` while `cancel_at_period_end` stays false. Regression coverage now checks both billing modes, an earlier end, cancellation removal and a later cancellation that must not extend paid access. The correction deployed successfully as `3149ad8`, web deployment `8fc91ffa-19d4-4b60-a755-c8cc81df4527`. Its [release CI](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/43976857744) passed all three jobs; the [development CI](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/43976869274) also passed (202 core tests, 10 browser journeys and PostgreSQL 18 qualification).

Hosted recheck showed “Scheduled to end 16 November 2027” with `entitled=true`, `cancelAtPeriodEnd=true`. A second checkout attempt returned 409 `SUBSCRIPTION_EXISTS`. A full sandbox refund succeeded; the signed refund webhook returned 200 and the application persisted `needs_review=true`, `entitled=false`. After immediate cancellation of this newly created test subscription (without another invoice or proration), refresh retained the review hold. The investment workspace and existing synthetic account remained accessible. This is intentional test-account state, not an unresolved live customer incident.

No real card or funds were used. The test subscription was cancelled to avoid future test renewal; the existing live account is untouched. Hosted overdue renewal, 3DS recovery, delayed-event replay, disputes and operational recovery still need qualification; automated fixtures cover those supported state rules but are not provider journey evidence.


## Native CSV qualification — 16 November 2026

The tested native-reader development revision `933f945` deployed to staging as `8cb5bf80-674f-4f15-b242-2a6a5247141c`, from a dedicated release branch. Migration 0007 was already applied; no new database permission or production resource was required.

Using only the independently constructed fixtures in `tests/fixtures/brokers`, the browser imported the Freetrade GBP sample: 3 records, 2 accepted and 1 excluded cash dividend. Saving and calculating 2024–25 gave £200 proceeds, £125.63 displayed allowable costs and £74.37 gain, matching the documented rounding convention. Reversal retained the receipt and reason and invalidated the calculation. The Trading 212 fractional GBP sample then independently gave £10.50 proceeds, £5.25 cost and £5.25 gain after 2 accepted trades and 1 excluded interest record.

A foreign-currency Trading 212 sample stayed in review with a specific mapping explanation and no Save action. Direct API attempts to commit a Trading 212 corporate-action file, a mixed valid/unsupported Freetrade file and an all-duplicate Trading 212 upload each returned 409 `needs_review`. Before/after import history was unchanged, proving the mixed file could not partially commit. Disposable test drafts were discarded; the valid Trading 212 example and historical reversals were retained. This qualifies those synthetic cases, not all exports from those brokers.

Review also found two usability defects: history completeness validated “today” in UTC instead of London, and a resumed preview could appear beneath an upload form selecting another account. The follow-up uses London calendar dates on both sides and includes the server-bound account ID in every preview response, showing its account label beside the confirmation. Tests cover BST midnight, tomorrow rejection and a resumed preview with a different form selection.


Final staging revision for this increment is `4a4dec7a0f4b1ddce89b925a5cb74dec435c4d4f`, web deployment `8c13d6b5-0f49-47bf-9794-872488e7f8f3`, branch `codex/staging-native-4a4dec7`. Actual deployment metadata confirms this revision and SUCCESS. [CI run 43978362041](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/43978362041) passed 203 core tests, 10 Chromium journeys, PostgreSQL 18 roles/migrations/concurrency, types, lint, design checks, schema drift, dependency audit, production build and container smoke checks.

After deployment, a resumed Trading 212 preview still displayed “Saving to: Synthetic staging account” while the upload form selected the Freetrade account. The blocked draft was discarded and the saved Trading 212 calculation still returned £5.25. Final smoke checks passed for pages/assets, readiness, anonymous/private-route boundaries, foreign origins and forged-IP rate limiting. Unsigned Stripe requests still returned 400 and the refunded/cancelled test account retained its review hold. No Railway changes remain pending. Production DNS remains unchanged.


## Staging interface release — 17 November 2026

Railway web deployment `e550302a-50c2-4e9a-99ce-fa67eb8446ba` is SUCCESS on the existing staging URL. Its actual `meta.commitHash` is `5e6324994b1e65c8bf027614ef14630055412f24`, built from the fixed release branch `codex/staging-design-5e63249`. Only source branch and commit changed; no database migration, credentials, DNS or live Stripe changes. The previous native-import release remains available for rollback.

Hosted browser inspection confirmed the new account overview (2 taxable accounts, 3 import records including reversals, 0 saved previews) and the saved 2024–25 Trading 212 result (£10.50 proceeds, £5.25 allowable costs, £5.25 net gain), including expandable Section 104 evidence. A 375px hosted import screen has a 375px document width, keeps broker support accessible, and uses the packaged DM Sans font. The viewport override was reset after checking. No new financial records or payment actions were created during this visual verification. Screenshots are in `.private/redesign/`; the standalone before/after board embeds its two captures.

## Original interface restored — 17 November 2026

The user's original UI instruction supersedes the visual release above. Railway web deployment `3e2a90fa-93a9-44d9-bf19-9e7ee1d1ef42` is SUCCESS with actual `meta.commitHash` `0a33bd30761414dabb2e7aa153a37391692b16e4`, fixed branch `codex/staging-original-0a33bd3`. The source-only staging update does not alter database migrations, credentials, production DNS or live payments.

[CI run 44060862069](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44060862069) passed application/financial/browser contracts, container smoke and PostgreSQL 18 migrations/roles/concurrency. Local verification passed 203 core tests, 30 browser tests, TypeScript, build, lint, production dependency audit (zero vulnerabilities), 16-token design parity and the strict premium audit (zero findings). DESIGN.md schema lint has zero errors and five informational unused-component-token warnings; those tokens are used by the runtime CSS and are retained. Six public/account routes were checked at 320, 768, 1024 and 1440 pixels without document overflow; restored public and dashboard pages also passed the automated 375px accessibility checks.

Hosted inspection verified the original homepage, original dashboard structure with saved £5.25 gain/£10.50 proceeds/£5.25 cost and historical pool, import controls, restored reports and settings. The downloaded preview CSV contained exactly the saved synthetic disposal and preview warning. Saving the existing staging profile name succeeded through the real authentication endpoint without changing the name. No password, broker records or payments were changed. Hosted smoke checks passed assets, readiness, anonymous access rejection, origin checks and forged-IP rate limits. A hosted 375px homepage measured 375px document width; the viewport override was reset afterward. The restored preview tab was retained for review.

Evidence: `.private/screenshots/restored-staging-home.jpg`, `restored-staging-dashboard.jpg`, `restored-staging-home-mobile.jpg`; `.private/restored-staging-smoke.json`. See `ORIGINAL_UI_RESTORATION.md` for all recovered routes and necessary adaptations. PDF/SA108 filing exports, permanent deletion and outstanding broker qualification remain explicit release gates.
