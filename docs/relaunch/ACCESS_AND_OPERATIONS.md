# Relaunch access and operations

Verified 16 November 2026:

- GitHub source: https://github.com/PSLDev94/UK-CGT-Tracker
- Railway: new private [CGT Tracker project](https://railway.com/project/cb6c0af0-18e8-401f-aafd-9edad5956df9), `staging` environment with the [web preview](https://web-staging-e003bc3b.up.railway.app) online. PostgreSQL 18 has one healthy Europe West replica and its 1 GiB private volume. All five migrations and four separate runtime logins are applied and verified. The hourly cleanup service is deployed and its first manual execution succeeded.
- Stripe: existing UK CGT Tracker live account and cgt sandbox accessible. Live annual GBP 49 price inspected without changes.
- Cloudflare: cgttracker.com zone active. The www record still points to the previous Vercel target. Hosting DNS has not been changed during this increment; existing mail records remain intact.
- Resend: signed-in account already shows cgttracker.com as Verified. No messages sent.

## Runtime configuration

Connected management tools are not runtime application credentials. The user added `RESEND_API_KEY` and sandbox `STRIPE_SECRET_KEY` directly in Railway. Both names are confirmed in applied staging web variables, with values withheld. Their actual scope and runtime operation remain unverified. Check names/sealed status without printing values. Prefer sending-only/domain-scoped Resend access and a restricted Stripe key with only the operations needed for the implemented checkout/portal flow. Verify permissions with actual sandbox tests before calling access complete.

App/auth database references, an independently generated session secret and the staging application origin are configured. The billing webhook signing secret remains pending implementation of its endpoint. Generate application secrets with a cryptographic random source. Use separate production values and separate webhook endpoints. Never place keys in chat, source control, shell arguments, logs, browser-exposed variables or documentation.

The second increment implements these runtime names (none are browser-public):

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact HTTPS origin in production, no path or trailing slash. Use the staging hostname before domain cutover. |
| `APP_DATABASE_URL` | Dedicated login with membership only in `cgt_app`; must not own tables or bypass RLS. |
| `AUTH_DATABASE_URL` | Separate login with membership only in `cgt_auth`. |
| `BETTER_AUTH_SECRET` | Independently generated high-entropy secret, at least 32 characters. |
| `AUTH_CLIENT_IP_HEADER` | Header demonstrably overwritten by the trusted ingress. Verify against forged headers and direct-origin access before choosing a value. |
| `RESEND_API_KEY` | Domain-scoped runtime sending key; applied to staging web; not yet runtime-tested. |
| `AUTH_EMAIL_FROM` | Verified plain sender address under `@cgttracker.com`, for example `accounts@cgttracker.com`. |
| `STRIPE_SECRET_KEY` | Sandbox key for the upcoming billing increment; applied to staging web; not yet runtime-tested. |

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

PostgreSQL and the web service are running. Existing-plan usage charges apply. The public staging URL is https://web-staging-e003bc3b.up.railway.app. Production DNS is unchanged; provider key names are present but delivery/payment operations remain unverified.

`database-setup` completed as a one-time Europe West job, with restart policy NEVER. Its command is `sh -c 'node scripts/migrate.ts && node scripts/provision-runtime-logins.ts'`. It has the migration-owner URL through a private Railway reference and four separate, independently generated runtime URLs. The web service receives only its app/auth references, a separate generated session secret and the verified-domain sender. No credentials were written to Git or displayed in the conversation. The setup job completed successfully on 16 November 2026 at 17:54 UTC. Its logs confirm all five migrations and four independent runtime connections.

The provisioning script creates fixed `cgt_runtime_app`, `cgt_runtime_auth`, `cgt_runtime_billing` and `cgt_runtime_maintenance` logins with distinct 32–128-character base64url passwords. Each has NOINHERIT and can SET ROLE only to its single expected NOLOGIN group. It validates existing memberships/ownership and never silently rotates a password. All four runtime URLs must target the same database and connection settings as the migration URL. Configure them together in the job, then reference each from its corresponding service. Keep the migration-owner reference out of the web/worker services. Do not delete the setup service while other services reference its variables; move credentials deliberately if retiring it.

The container includes migration, provisioning and cleanup scripts. Run them with Node 24 directly; no development tooling is needed in the runtime image. CI qualifies all migrations, login provisioning, permission boundaries, real concurrent imports/reversals and verified auth sessions against a disposable PostgreSQL 18 service. These checks complement, rather than replace, tests of Railway networking, backups, role configuration and provider delivery.

The connector's `accept-deploy` calls were cancelled with “the user did not approve this action,” despite chat approval. The user applied the database and setup job through Railway. The user then explicitly approved the 28 prepared web/cleanup changes, which were applied through the signed-in browser. There are no pending changes from this deployment. The public website remains gated on hosted integration, verified broker formats, billing and reporting qualification.


## Hosted staging verification — 16 November 2026

Web deployment `202d5880-4968-40c8-a8ef-473d06a8d3e5` and cleanup deployment `703cac89-7703-425f-801a-abf8fc9e4270` use tested commit `cd660f01a7df28530242996957475cea466c43cb`. Web readiness is `/api/ready`; it validates the runtime and checks both app/auth database connections before returning 200. It returns a generic 503 on failure. The database remains private; no TCP proxy was opened.

The repeatable `scripts/smoke-staging.mjs` probe passed: home, packaged CSS, broker support, workspace shell, signup and liveness/readiness routes; no-index/frame-denial headers; anonymous session returned null; private API rejected anonymous requests with 401 and foreign origins with 403. Seven nonexistent-user sign-in requests with different forged `x-real-ip` and `x-forwarded-for` headers returned 401 five times, then 429 twice. This validates the configured Railway `x-real-ip` trust boundary for the current direct staging ingress; repeat after any proxy/topology change. No account was created or email sent.

Browser inspection confirmed the rendered home page and the workspace sign-in/verified-email gate. The cleanup execution emitted `expired_import_drafts_removed` with count 0 and completed. Node emitted a non-fatal module-type detection warning for its TypeScript script; the command itself succeeded.

CI at this deployed commit passed 119 core/configuration tests, 10 real PostgreSQL 18 qualification tests and seven controlled Chromium journeys, plus types, lint, schema drift, design tokens, dependency audit, build and container startup. See [run 43923822197](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/43923822197).

Still unverified on the hosted service: real email delivery and recovery, authenticated import-to-calculation journeys, native broker formats, Stripe lifecycle and reports, monitoring alerts, backup restoration and deployment rollback. The preview is not ready to accept paying customers.
