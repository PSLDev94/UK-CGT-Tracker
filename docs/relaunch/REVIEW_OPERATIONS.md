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


## 17 November follow-up qualification

- The owner confirmed the labelled support-form email arrived at `support@cgttracker.com`. This qualifies actual inbox delivery, beyond provider acceptance. The owner corrected further test mail to `parvinderlongani@gmail.com`; no further plus-alias emails should be sent. The new alias signup remains unverified; it is not evidence of completed verification.
- Scheduled billing reconciliation ran at 12:18 UTC: checked 1, updated 1, failed 0, needsReview 1, finished true. The existing synthetic refund hold remained under review, as intended.
- Read-only inspection of the connected existing Stripe live account returned complete empty lists for subscriptions and payment intents. No live mutations were made. This closes the observed subscription/payment-intent migration inventory, not every possible historical Stripe object.
- Added the exact 33-column Trading 212 variant and synthetic £72.00 result, with foreign-fee and conflict tests. 252 core tests passed; TypeScript, ESLint and production build passed locally. Hosted deployment and qualification of this variant are still pending.
- Prepared a separate encrypted R2 backup worker, provisioning script, tamper tests and an isolated PostgreSQL restore CI step. See [backup recovery](BACKUP_RECOVERY.md). R2 activation and bucket creation were completed subsequently, as recorded below.


CI [448941e](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44084779778) passed all three jobs, including 252 core tests, browser checks, a non-root backup image, dedicated-reader dump and authenticated decrypt followed by restore into a separate PostgreSQL 18 container. Restored transactions/imports/calculation runs/users matched row digests and tenant RLS remained enforced. The EU endpoint/provisioning image follow-up [d7f992f](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44085434470) also passed all jobs. Three additional HMRC-reference tests pass locally; see [tax review pack](TAX_REVIEW.md).

The owner activated Cloudflare R2; `cgt-tracker-backups-staging` exists privately in the EU jurisdiction. A daily 02:20 UTC backup service, its distinct read-only login and the newer Trading 212 web build are staged on Railway, not applied. The owner approved this deployment and 14-day archive expiry. The enabled `staging-backups-14-days` rule now permanently expires objects under `staging/` after 14 days. The default seven-day incomplete multipart-upload rule remains in place. Bucket-scoped object credentials, recovery-key escrow confirmation and hosted restore qualification are pending. The latest Railway read still lists only five of the seven required worker variables; the two S3 credentials are missing.

Provider-only Stripe test-clock qualification completed an annual £49 renewal, a subsequent declined renewal (`past_due`, open invoice, £0 paid), and recovery to paid £49 / active after restoring the successful test method. The clock finished in `ready`. See [billing evidence](BILLING.md#17-november-provider-inventory-and-additional-test-setup) for object IDs and limits. This customer has no email or application-user mapping; the existing user's refund hold was not changed. Hosted paid-PDF and mapped lifecycle qualification remain separate gates.

A second synthetic no-email customer completed a provider-only 3DS rejection/retry test. Failed authentication left the subscription incomplete and invoice unpaid; the next completed bank challenge produced paid £49 and active status, verified through API and hosted invoice UI. Private screenshots: `stripe-renewal-recovery.jpg`, `stripe-3ds-paid.jpg`, and `r2-retention-enabled.jpg`. No live Stripe writes or production deployment occurred.

CI [065d8ba](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44086281752) passed all three jobs, including 255 core tests after the three HMRC-reference additions. This is source/CI evidence; it does not mean the staged backup worker has run.


## Extended broker and calculation qualification — 17 November

Release `8946a5f232c3b701e8f0e1f86967453d352f4e85` passed [all three CI jobs](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44098777352): application/browser checks, portable container, and PostgreSQL 18 roles/concurrency/encrypted restore. It adds the documented assisted AJ Bell GBP-history layout, Freetrade renamed amount columns and verified foreign FX fees. Nine corpus paths across all six brokers pass persisted import → supporting evidence → commit → calculation → snapshot → duplicate retry → audited reversal, both under the local PostgreSQL-compatible test engine and actual PostgreSQL 18.

The expanded persisted tests exposed an order-dependent supporting-detail fingerprint: freshly edited JS objects and PostgreSQL JSONB could order the same fields differently. The correction preserves existing committed fingerprints and makes equivalent evidence independent of property order. Real PostgreSQL tests compare the fixed field order against its JSONB output and the historical hash construction. Changed financial values or provenance still conflict rather than overwrite records.

The suite includes 675 seeded fractional-acquisition cases across nine source layouts using integer-pence expectations, and 500 generated histories compared with an independent exact-rational quarter-share model. Native normalization also passes same-day, 30-day and Section 104 matching together, plus cash mismatch, malformed columns, unknown activity, duplicates and corrected reexports. Existing 33 browser checks passed locally, including report download/gating, interrupted uploads, stale previews, account isolation, original routes and responsive accessibility. TypeScript, lint, production build and the design-token contract passed.

A subsequent small change distinguishes Freetrade MONTHLY_STATEMENT/TAX_CERTIFICATE notifications from transactions: only metadata-only rows may be excluded, and every row remains counted. Any financial value on a notification blocks the file. This took the core suite to 331 tests; commit `3f4eaf8` passed [all three CI jobs](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44099217253).

These additions are not deployed yet. The approved staging backup patch still lacks its two R2 credential variables and owner confirmation of recovery-key escrow. No production DNS, live payments or UI redesign was applied. Representative broker-export validation, tax review, monitoring, hosted backup/restore and mapped-user billing/report qualification remain open gates.


Upload-size qualification subsequently accepted exactly 100,000 distinct executions and conserved all 100,000 shares/£100,000 pool cost. A 100,001-record file is rejected before normalisation, and the 10 MiB cap is measured in UTF-8 bytes. A second defect was found at the HTTP boundary: normal JSON escaping could push a valid, quote-heavy CSV above the previous 12 MiB request cap. The workspace request now allows bounded encoding overhead (twice the decoded CSV cap plus 64 KiB); other endpoints retain their existing limit, and the decoded file cap remains 10 MiB. Unsupported control characters are rejected, while ordinary quoted text, tabs and line endings remain supported. A transport regression passes a valid 8.4 MB quote-heavy native CSV through the decoder and parser. These additions bring the core suite to 339 tests.


Final application release `9e488d099f2590f3aad262a1a072238925ecd612` passed [CI 44099863569](https://github.com/PSLDev94/UK-CGT-Tracker/actions/runs/44099863569), all three jobs: 339 core tests, 33 browser checks, production build, dependency audit, portable container and PostgreSQL 18 qualification including encrypted isolated restore. Its immutable branch is `codex/staging-brokers-9e488d0`.

The staging web source is now prepared at that exact commit in existing patch `5254377e-df8e-4691-b60b-cee04f66075c` (24 changes). Database-setup and backup worker remain at their previously approved `d7f992f` sources; their code and permissions did not change. The patch has not been applied, so the hosted web still runs the older build. Missing R2 credentials prevent a working backup run. A fresh signup/verification at the accessible support inbox has been requested to qualify paid PDF access without clearing the existing Gmail refund-review hold. No verification email has been sent to that address for this new purpose yet.
