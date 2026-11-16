# Relaunch access and operations

Verified 16 November 2026:

- GitHub source: https://github.com/PSLDev94/UK-CGT-Tracker
- Railway: new private [CGT Tracker project](https://railway.com/project/cb6c0af0-18e8-401f-aafd-9edad5956df9), `staging` environment, empty `web` service. No application deployed and no database provisioned yet.
- Stripe: existing UK CGT Tracker live account and cgt sandbox accessible. Live annual GBP 49 price inspected without changes.
- Cloudflare: cgttracker.com zone active. The www record still points to the previous Vercel target. Hosting DNS has not been changed during this increment; existing mail records remain intact.
- Resend: signed-in account already shows cgttracker.com as Verified. No messages sent.

## Runtime configuration

Connected management tools are not runtime application credentials. The user has been asked to place `RESEND_API_KEY` and the sandbox `STRIPE_SECRET_KEY` directly in Railway staging web variables. Check names/sealed status without printing values. Prefer sending-only/domain-scoped Resend access and a restricted Stripe key with only the operations needed for the implemented checkout/portal flow. Verify permissions with actual sandbox tests before calling access complete.

Database URL, session secret, application base URL and webhook signing secret will be configured when their corresponding services/endpoints exist. Generate application secrets with a cryptographic random source. Use separate production values and separate webhook endpoints. Never place keys in chat, source control, shell arguments, logs, browser-exposed variables or documentation.

## Before deployment

1. Finish the fresh app and pin updated dependencies; do not connect Railway to the legacy application entry point.
2. Provision private PostgreSQL, select a suitable region, configure backups and test restoration.
3. Apply versioned migrations using the migration owner. Configure separate web/billing credentials with limited role membership. Add auth tables using the pinned Better Auth schema tool and test auth lifecycle.
4. Set all required runtime variables and register a sandbox Stripe webhook. Validate retries, signatures and event reconciliation.
5. Deploy staging, exercise browser journeys and verify email delivery without disclosing real customer data.
6. Only after release gates pass, connect www.cgttracker.com and redirect the apex domain. Preserve existing mail/DKIM/SPF/MX records. Do not cache authenticated routes or tax data at Cloudflare.
7. Verify HTTPS, callbacks, billing, reports, monitoring and rollback against the actual production origin.

The Railway project currently contains no running workload. Review projected hosting costs and confirm the intended paid plan before accepting a new financial commitment.
