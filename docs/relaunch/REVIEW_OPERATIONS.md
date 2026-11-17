# Review release operations

## Release identity

Application release: `62476a6ba0cb89ba7937945dd0c4115b1ffc24df`, fixed branch `codex/staging-review-62476a6`. Development documentation commits may follow without changing this release branch. [CI 44068091383](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44068091383) passed all three jobs, including PostgreSQL 18 concurrency/roles/logical restore, browser journeys and the portable image.

Database-setup deployment `7c054b6e-7586-4a75-9cfd-ffa3fc2cc14d` completed successfully on 17 November 2026. Runtime logs confirm migrations 0008 and 0009 applied and all four separate runtime logins verified. Both migrations are additive. The module-type warnings emitted by Node's direct TypeScript runner are non-fatal; no credentials appeared in logs.

The owner approved the 24-change staging patch, applied on 17 November 2026 at 11:51 UTC. Actual deployment metadata confirms release `62476a6` for web `c3a3cac6-adcf-4777-af54-b14e9d310c2b`, cleanup `705c5e4f-b4b4-46f6-a10b-1f534b55e726` and the initial billing job `c6b07c73-b88f-4e87-bb25-303fbf0c7a6d`. The web service passed readiness and hosted qualification below. Production DNS and live Stripe remain unchanged.

The first manual billing run exposed a missing `kysely` dependency: Next's web trace did not include the independent worker's external imports. Correction `b46209fd035ba29935756303ec9a2c213a88328c` bundles worker JS dependencies, with only the unused optional `pg-native` external. An isolated startup check copies the worker outside the repository, strips configuration/NODE_PATH and requires its own structured missing-configuration failure rather than a module-loader crash. [CI 44078410091](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44078410091) passed all three jobs including the new check. The correction changes only the worker deployment source; permissions and scheduling are unchanged.

Corrected worker deployment `c66a2429-4400-4164-9e04-cf66c106a9ad` reports SUCCESS on actual commit `b46209f`. Its manual run at 11:59 UTC reached the provider/database validation and logged `billing_reconciliation`, `finished:true`, `failed:0`. It checked zero stale accounts because the browser/API qualification had just refreshed the only sandbox account; this proves startup and an empty eligible batch, not a renewed paid entitlement. The hourly schedule remains minute 15 UTC.

The updated cleanup deployment's scheduled 12:00 UTC execution succeeded, logging zero expired draft removals after both the draft and contact-throttle cleanup queries. No active import data was deleted.

## Hosted qualification — 17 November 2026

- HL, ii and AJ Bell synthetic assisted files each required two supporting-detail records, then committed two trades. Configured IBKR Flex accepted two executions directly. CSV exports returned 200, matched the saved calculation and used private/no-store headers. Unpaid PDF requests returned 402 `SUBSCRIPTION_REQUIRED`.
- Existing Trading 212 trades use the same ISIN and acquisition day as these samples. Hosted checks therefore independently calculated the combined cross-broker pool: July gain £69.60 for HL/ii/AJ Bell and £70.34 for IBKR, plus the existing August sale at £7.80/£7.82. The isolated fixture gains £70.88/£71.62 still pass in tests. The first test-harness expectation incorrectly assumed an isolated pool; corrected the expectation, not the calculation engine.
- Each new synthetic import was reversed after qualification, retaining its receipt/reason. Its previous CSV became unavailable (404). The baseline Trading 212 £5.25 calculation was restored with all six synthetic accounts covered; no pending drafts remain.
- Trading 212 corporate actions, mixed valid/unsupported Freetrade activity and duplicate Trading 212 trades all refused forced commits with 409 `needs_review`. Import history stayed unchanged. The rate limiter also rejected an overly rapid test batch with 429; subsequent tests respected the cooldown.
- In the signed-in browser, a stale report displayed the recalculation instruction. Refreshing the restored result downloaded `CGT-csv-2024-25.csv` with the £5.25 baseline and calculation fingerprint. PDF download displayed the subscription explanation and retained the free CSV action, consistent with the test account's earlier refund hold.
- A further hosted browser HL preview showed the original source fields and required supporting details. Entering zero fees retained the reconciliation error and blocked saving trades; correcting fees to £8.49 changed that record to Included while the second unresolved record still blocked the file. The preview was discarded without changing saved transactions.
- Contact validation reached the hosted database-backed limiter and returned 400 `INVALID_CONTACT` for an empty message, without sending email. Privacy page returned 200 with PSL Digital details and a nonce-based CSP. Readiness returned 200; unsigned Stripe webhooks returned 400 `INVALID_SIGNATURE`.

Screenshots and synthetic downloads remain under `.private/` or the user's Downloads folder, outside Git. Positive paid-PDF generation is covered by the service/browser suite and rendered local samples; this hosted account intentionally cannot pass entitlement while its refund hold remains.

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
