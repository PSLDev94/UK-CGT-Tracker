# Separate encrypted database backups

Prepared 17 November 2026. **Not yet provisioned or qualified against hosted storage.** The owner chose a separate backup service instead of a Railway Pro upgrade. Production launch remains blocked on storage activation, credential setup, a successful scheduled run and an isolated restore rehearsal.

## Concrete service design

- Private Railway cron service built from `Dockerfile.backup`; no web port/domain, no app or Stripe credentials, no persistent plaintext volume. Proposed daily schedule: `20 2 * * *` UTC. This gives a nominal 24-hour recovery-point objective, not point-in-time recovery. Missed jobs increase potential data loss.
- A dedicated `cgt_runtime_backup` login can set the read-only `cgt_backup` role. That role bypasses tenant row filters solely to read the whole database and inherits `pg_read_all_data`; it cannot write business records. The worker receives no migration-owner password. Provision once using `scripts/provision-backup-login.ts` in the existing private setup service with its migration connection and a new, distinct backup password. Existing credentials are never silently rotated.
- PostgreSQL 18 `pg_dump` custom-format export streams directly into AES-256-GCM encryption. A random 96-bit nonce is generated for every archive; the version header is authenticated. Only ciphertext is written to the worker's temporary disk. Child-process arguments and logs contain no passwords or raw database rows.
- Upload a uniquely named ciphertext object into a private Cloudflare R2 Standard bucket, proposed `cgt-tracker-backups-staging`. No public access or custom domain. Retrieve the whole object and compare its SHA-256 before reporting success. A failed dump, timeout, upload or readback exits non-zero.
- Proposed lifecycle: expire staging archives after 14 days; production in a separate bucket after 30 days, subject to final retention review. R2 object-write credentials also allow deletion: do not describe the token as write-only or the storage as immutable. Keep its scope to the one bucket. This protects against accidental database loss, not a compromise of both backup credentials and storage.
- An independent encryption key is held in Railway and an owner-controlled password manager/recovery vault. Losing both copies makes every backup unrecoverable. Key rotation requires retaining old keys with their archive date ranges. Never paste keys into chat, commit them, or store the only recovery copy in the backed-up database.

## Runtime variables (values are secrets, never documentation)

`BACKUP_DATABASE_URL`, `BACKUP_ENCRYPTION_KEY` (64 hexadecimal characters), `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_ENVIRONMENT=staging`.

Endpoint must be the account's HTTPS R2 S3 endpoint. Database destination must be the same private Railway database used at provisioning, with a `.railway.internal` hostname and no URL query options. Production needs its own credentials, bucket, encryption key and explicit deployment approval.

## Recover into an isolated PostgreSQL 18 service

1. Stop and identify the intended dated backup, encryption key version and recovery environment. Do not point any recovery command at the active database. Download ciphertext using a bucket-scoped read credential; do not place sensitive archives in public artifacts.
2. Create a fresh, private PostgreSQL 18 cluster with a new owner credential, no application connections and an empty target database. Provision only the fixed NOLOGIN group names required by the dump's ACLs/policies (`cgt_app`, `cgt_auth`, `cgt_billing`, `cgt_maintenance`). Dumps omit login passwords/cluster roles. Recovery needs newly provisioned runtime logins, not the old secret values.
3. Make a mode-0700 temporary directory. Load the appropriate encryption key from the recovery vault into `BACKUP_ENCRYPTION_KEY` without echoing it. Run `node scripts/decrypt-backup.mjs /private/path/archive.cgtenc /private/restore/database.dump`. Existing output files are refused. If authentication fails, partial plaintext is removed and **do not invoke pg_restore**.
4. On success only, run PostgreSQL 18 `pg_restore --exit-on-error --single-transaction --no-owner --dbname=<isolated target>` using password environment/secret injection, never a password in shell history. Do not use `--clean` against an existing service. Run under the recovery owner; preserve grants and RLS policies.
5. Compare migration versions, table counts and row digests for all business/auth/billing tables against the expected snapshot. Confirm no orphaned imports/trades, saved result fingerprints and report totals. Verify tenant isolation, unverified-user restrictions and separate app/auth/billing/maintenance role boundaries. In staging, keep Stripe sandbox-only and disable outbound emails while inspecting the restore.
6. Reconcile payments with Stripe before enabling service access: an older database snapshot must not revive refunded/disputed subscriptions. Recreate runtime logins and application secrets from approved sources. Record backup time, restore duration, actual recovery point, checks and reviewer in `REVIEW_OPERATIONS.md`.
7. Remove plaintext temporary files and retire the rehearsal cluster after recording aggregate evidence. Production promotion is a separate, explicitly approved action.

The CI workflow exercises encryption/decryption around a real PostgreSQL 18 logical restore and compares records/RLS. Unit tests exercise wrong keys, ciphertext/header/tag corruption, truncation, unique nonces and overwrite refusal. Neither CI nor a successful object readback alone certifies production recovery.

## Monitoring and launch conditions

Structured `database_backup` events show success/failure, archive name, size and elapsed time. Railway process failures must notify an accessible operator; add an independent missed-run check that alerts if no verified object appears within 26 hours. These alerts are not yet configured. Manually observing a green deployment is not backup monitoring.

The owner activated R2 on 17 November 2026. The private staging bucket was created with EU jurisdiction; its endpoint uses `<account>.eu.r2.cloudflarestorage.com`. Worker credentials, retention and first hosted backup are still pending. Published Standard allowances: 10 GB-month storage, 1 million Class A and 10 million Class B operations per month; excess usage is billed. Daily full-object readback counts toward requests, storage and Railway network usage. Set account usage alerts and review backup sizes before production.

Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 S3 client setup](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/), [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html), [predefined read roles](https://www.postgresql.org/docs/18/predefined-roles.html).
