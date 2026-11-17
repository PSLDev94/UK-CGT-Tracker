# Review release operations

## Release identity

Application release: `62476a6ba0cb89ba7937945dd0c4115b1ffc24df`, fixed branch `codex/staging-review-62476a6`. Development documentation commits may follow without changing this release branch. [CI 44068091383](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44068091383) passed all three jobs, including PostgreSQL 18 concurrency/roles/logical restore, browser journeys and the portable image.

Database-setup deployment `7c054b6e-7586-4a75-9cfd-ffa3fc2cc14d` completed successfully on 17 November 2026. Runtime logs confirm migrations 0008 and 0009 applied and all four separate runtime logins verified. Both migrations are additive. The module-type warnings emitted by Node's direct TypeScript runner are non-fatal; no credentials appeared in logs.

Web, cleanup and the new reconciliation job have a prepared 24-change staging patch. Do not mistake this for a completed application deployment. Record the actual deployment commit hashes and hosted journey results after applying it.

## Routine checks

- Web: `/api/ready` must return 200; private APIs reject anonymous and foreign-origin requests. Readiness does not prove optional Stripe or email delivery is working.
- Cleanup: hourly exit success; aggregate logs record removed drafts and contact throttle rows. No raw CSV or message content belongs in logs.
- Billing: hourly at minute 15 UTC; start command `node jobs/reconcile-billing.cjs`. A successful completed traversal logs `billing_reconciliation` with `finished:true` and `failed:0`. `needsReview` may be non-zero because refund/dispute holds are intentional. A non-zero exit or incomplete traversal needs investigation.
- Billing job access: six references to existing web billing configuration, including the billing-only database login and restricted sandbox Stripe key. No migration-owner, authentication, ordinary app database or public network endpoint.
- Provider jobs need failure notifications before production. An hourly schedule without an alert is not monitored recovery.

## Incident handling

1. Identify the affected release, UTC time, service and non-sensitive error reference. Read deploy logs first; avoid customer payloads and full request logs.
2. If a provider is unavailable, leave billing fail-closed and allow investment records/CSV evidence. Retry failed webhook delivery through the provider after resolving the cause; receipt deduplication is transactional.
3. If reconciliation exits unsuccessfully, inspect configuration names, service health and provider permissions without printing values. Run the same job again after recovery; it fetches current provider state and does not create charges or subscriptions.
4. A refund/dispute hold must not be cleared merely because the next subscription event says active. Keep the hold and investigate the customer's payment evidence. An audited operator-resolution workflow and business policy remain production requirements.
5. Unknown CSV layouts or activity should remain blocked. Retain an anonymised reproduction with permission, introduce a narrowly defined adapter/fixture and rerun reconciliation tests. Never turn an unknown financial record into an ignored row to satisfy an upload.

## Rollback and restoration

For an application rollback, select the previous successful deployment of the same service and verify its actual `meta.commitHash`, readiness and authenticated journey. Keep the additive 0008/0009 schema; do not run a destructive down migration. Pause the new reconciliation job if a defect in that job requires rollback. Previous web release: `0a33bd3`, deployment `3e2a90fa-93a9-44d9-bf19-9e7ee1d1ef42`.

Database recovery is separate from application rollback. CI rehearses a custom-format logical dump into a fresh PostgreSQL 18 database, compares full-row digests/counts for transactions, imports, runs and users, and verifies that RLS still returns no rows without an owner. This does not certify Railway volume snapshots or recovery of the hosted service. Before production: configure a provider backup schedule, record retention and recovery objectives, restore into an isolated private service, verify role bindings and business records, then record the measured recovery time. Never rehearse by overwriting the active database.

On 17 November 2026 the staging Postgres Backups page displayed: “Upgrade to Pro to create new backups, set up automated schedules, or enable point-in-time recovery.” No upgrade was purchased and no provider backup schedule was configured. Production needs either the approved Railway plan upgrade or a separately qualified encrypted backup destination and restore process.

## Review artifacts

Synthetic PDF/CSV samples are generated with `npx tsx scripts/review-report-samples.ts` under `.private/report-review/`, excluded from Git. The long-reference pagination fixture produces 18 A4 pages; its final page was rendered and visually checked for wrapping, readable pool details and footer separation. The 10,000-record local timing probe is a reproducible smoke benchmark, not a production capacity guarantee.

See [review scope and external launch gates](REVIEW_READY.md) before claiming production readiness.
