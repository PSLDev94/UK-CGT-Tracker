# Production release and rollback

## Recovery points

Two annotated Git tags were verified against the GitHub remote on 21 November 2026.

| Version | Immutable commit | Purpose |
|---|---|---|
| [legacy-before-relaunch-2026-11-21](https://github.com/PSLDev94/UK-CGT-Tracker/tree/legacy-before-relaunch-2026-11-21) | `80db71cfd92f0eb514e857ffcd23eeb236c443dd` | The original application on `main` before the relaunch |
| [staging-reviewed-2026-11-20](https://github.com/PSLDev94/UK-CGT-Tracker/tree/staging-reviewed-2026-11-20) | `dbac980a0a2024ab9de368a22c460c793f3ec476` | The version reviewed using Stripe test payments |

The [production release branch](https://github.com/PSLDev94/UK-CGT-Tracker/tree/codex/production-launch-2026-11-21) carries the live-payment configuration. Check the web deployment's commit in [CGT Tracker Production](https://railway.com/project/6546e66a-b956-47f6-8ace-d25304929105?environmentId=c2b530de-6a96-4ae8-981f-756bb197eb7a) before choosing a recovery point. The two tags above preserve the original and reviewed source trees independently of future branch changes.

Use a new branch from a tag if recovery work is needed. This preserves both release histories. For example, to inspect the original in a separate directory:

```sh
git fetch origin --tags
git worktree add --detach ../CGTTracker-original legacy-before-relaunch-2026-11-21
```

## Choose the recovery action

**For a web regression on Railway**, use the last known-good production deployment only if it supports the production database schema and Stripe live mode. Check the deployment's actual commit, migrations, `/api/ready`, report access and webhook handling. Preserve uploaded transactions, subscriptions and reconciliation jobs. The reviewed staging tag runs test payments and cannot process live billing. For the first launch there is no earlier live-capable Railway deployment to select.

**For the original website**, first restore and validate its own Vercel project, Supabase environment and dependent accounts on its provider hostname. On 21 November the public Cloudflare route returned HTTP 503 with Vercel's `DEPLOYMENT_PAUSED`. Reverting DNS alone would restore that error. The original application uses a different account and data model. Once customers have used the new site, retain their Railway data and subscriptions and plan continuity before switching them back. Returning to the old Git version does not reverse a payment or restore a database.

**For a data incident**, preserve the current database and encrypted archives. Restore a verified archive into a separate PostgreSQL instance, reconcile the intervening trades, payments and customer accounts, then choose whether to switch the application. [Backup and recovery procedure](BACKUP_RECOVERY.md)

## Cloudflare configuration before the cutover

Only the two web records are relevant. Leave email routing, sender authentication and domain ownership records alone.

| Name | Type | Content before cutover | Proxy | TTL |
|---|---|---|---|---|
| `www.cgttracker.com` | CNAME | `5f786d2111031f29.vercel-dns-017.com` | Proxied | Auto |
| `cgttracker.com` | A | `216.198.79.1` | Proxied | Auto |

If an apex-to-www redirect is installed during cutover, account for it in a rollback. Verify both hostnames over HTTPS and sign in against the intended origin before restoring public traffic. Keep the original Stripe webhook destination while the original app is retained. During recovery, route live events only to handlers that validate signatures, verify the right account and reconcile idempotently. Never use staging credentials with a production database.
