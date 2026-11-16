# Relaunch access and operations

Verified 16 November 2026:

- GitHub source: https://github.com/PSLDev94/UK-CGT-Tracker
- Railway: new private [CGT Tracker project](https://railway.com/project/cb6c0af0-18e8-401f-aafd-9edad5956df9), `staging` environment, `web` service with no deployment. PostgreSQL 18 is online with one healthy Europe West replica and its 1 GiB volume. The user applied the database deployment in the dashboard after the connector cancelled its apply request. The web application is not deployed.
- Stripe: existing UK CGT Tracker live account and cgt sandbox accessible. Live annual GBP 49 price inspected without changes.
- Cloudflare: cgttracker.com zone active. The www record still points to the previous Vercel target. Hosting DNS has not been changed during this increment; existing mail records remain intact.
- Resend: signed-in account already shows cgttracker.com as Verified. No messages sent.

## Runtime configuration

Connected management tools are not runtime application credentials. The user added `RESEND_API_KEY` and sandbox `STRIPE_SECRET_KEY` directly in Railway. Both names are confirmed in applied staging web variables, with values withheld. Their actual scope and runtime operation remain unverified. Check names/sealed status without printing values. Prefer sending-only/domain-scoped Resend access and a restricted Stripe key with only the operations needed for the implemented checkout/portal flow. Verify permissions with actual sandbox tests before calling access complete.

Database URL, session secret, application base URL and webhook signing secret will be configured when their corresponding services/endpoints exist. Generate application secrets with a cryptographic random source. Use separate production values and separate webhook endpoints. Never place keys in chat, source control, shell arguments, logs, browser-exposed variables or documentation.

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

Run `npm run db:expire-drafts` hourly with `MAINTENANCE_DATABASE_URL` on a separate job whose login has only `cgt_maintenance` membership. Drafts become unusable at 24 hours; scheduled deletion should remove their raw contents by the next hourly run. Alert on cleanup failure. This schedule has not been deployed yet. Committed drafts are deleted within the import transaction; record classifications, provenance and historical calculations are retained. The complete financial-data retention/account-deletion policy remains a release requirement.

## Before deployment

1. The fresh app builds as a standalone Node 24 service, with a Dockerfile and no build-time provider credentials. Deploy a tested commit; do not connect Railway to the legacy application entry point.
2. Provision private PostgreSQL, select a suitable region, configure backups and test restoration.
3. Apply versioned migrations using the migration owner. Configure separate web/auth/billing/maintenance credentials with limited role membership. Run hosted migration, concurrency, role-isolation, backup/restore and auth lifecycle checks.
4. Set all required runtime variables and register a sandbox Stripe webhook. Validate retries, signatures and event reconciliation.
5. Deploy staging, exercise browser journeys and verify email delivery without disclosing real customer data.
6. Only after release gates pass, connect www.cgttracker.com and redirect the apex domain. Preserve existing mail/DKIM/SPF/MX records. Do not cache authenticated routes or tax data at Cloudflare.
7. Verify HTTPS, callbacks, billing, reports, monitoring and rollback against the actual production origin.

## Current staging status and setup job

PostgreSQL is running. Existing-plan usage charges apply. The provider keys are applied, but there is no web workload, public staging URL or production DNS change.

`database-setup` is prepared as a one-time Europe West job, with restart policy NEVER. Its command is `sh -c 'node scripts/migrate.ts && node scripts/provision-runtime-logins.ts'`. It has the migration-owner URL through a private Railway reference and four separate, independently generated runtime URLs. The web service receives only its app/auth references, a separate generated session secret and the verified-domain sender. No credentials were written to Git or displayed in the conversation. The setup job has not been applied; its proposed changes are non-destructive.

The provisioning script creates fixed `cgt_runtime_app`, `cgt_runtime_auth`, `cgt_runtime_billing` and `cgt_runtime_maintenance` logins with distinct 32–128-character base64url passwords. Each has NOINHERIT and can SET ROLE only to its single expected NOLOGIN group. It validates existing memberships/ownership and never silently rotates a password. All four runtime URLs must target the same database and connection settings as the migration URL. Configure them together in the job, then reference each from its corresponding service. Keep the migration-owner reference out of the web/worker services. Do not delete the setup service while other services reference its variables; move credentials deliberately if retiring it.

The container includes migration, provisioning and cleanup scripts. Run them with Node 24 directly; no development tooling is needed in the runtime image. CI qualifies all migrations, login provisioning, permission boundaries, real concurrent imports/reversals and verified auth sessions against a disposable PostgreSQL 18 service. These checks complement, rather than replace, tests of Railway networking, backups, role configuration and provider delivery.

The connector's `accept-deploy` calls were cancelled with “the user did not approve this action,” despite chat approval. The first deployment was completed by the user through Railway. Review the pending setup-job patch before applying it; never apply unrelated changes. The public website remains gated on hosted integration, verified broker formats, billing and reporting qualification.
