BEGIN;

-- A support review applies only to one file and the specific other receipt.
-- New or changed files need their own evidence. Never grant a standing override
-- to an account label or to all executions with a particular reference.
CREATE TABLE cgt.reviewed_statement_overlaps (
  owner_id text NOT NULL,
  account_id uuid NOT NULL,
  file_digest text NOT NULL CHECK (file_digest ~ '^[a-f0-9]{64}$'),
  other_account_id uuid NOT NULL CHECK (other_account_id <> account_id),
  other_import_id uuid NOT NULL,
  case_reference text NOT NULL CHECK (length(trim(case_reference)) BETWEEN 1 AND 100),
  source_reference text NOT NULL CHECK (length(trim(source_reference)) BETWEEN 1 AND 200),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id, file_digest, other_import_id),
  FOREIGN KEY(account_id, owner_id) REFERENCES cgt.broker_accounts(id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY(other_import_id, other_account_id, owner_id) REFERENCES cgt.imports(id, account_id, owner_id) ON DELETE CASCADE
);
ALTER TABLE cgt.reviewed_statement_overlaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt.reviewed_statement_overlaps FORCE ROW LEVEL SECURITY;
CREATE POLICY own_overlap_reviews ON cgt.reviewed_statement_overlaps FOR SELECT TO cgt_app
  USING (owner_id = nullif(current_setting('cgt.owner_id', true), ''));
GRANT SELECT ON cgt.reviewed_statement_overlaps TO cgt_app;

-- Re-checking the identical original never edits or duplicates saved trades.
CREATE TABLE cgt.receipt_revalidations (
  request_id uuid PRIMARY KEY,
  import_id uuid NOT NULL UNIQUE,
  account_id uuid NOT NULL,
  owner_id text NOT NULL,
  verified_records jsonb NOT NULL CHECK (jsonb_typeof(verified_records) = 'array'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(import_id, account_id, owner_id) REFERENCES cgt.imports(id, account_id, owner_id) ON DELETE CASCADE
);
ALTER TABLE cgt.receipt_revalidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt.receipt_revalidations FORCE ROW LEVEL SECURITY;
CREATE POLICY own_receipt_checks ON cgt.receipt_revalidations TO cgt_app
  USING (owner_id = nullif(current_setting('cgt.owner_id', true), ''))
  WITH CHECK (owner_id = nullif(current_setting('cgt.owner_id', true), ''));
GRANT SELECT, INSERT ON cgt.receipt_revalidations TO cgt_app;

CREATE VIEW cgt.unverified_import_receipts WITH (security_invoker=true) AS
SELECT i.id, i.account_id, i.file_digest,
  CASE WHEN i.parser_version LIKE 'canonical-%' AND i.duplicate_count>0 THEN 'template'
       ELSE 'cash exclusions' END AS issue
FROM cgt.imports i
WHERE i.status='committed' AND NOT EXISTS (
  SELECT 1 FROM cgt.receipt_revalidations r WHERE r.import_id=i.id
) AND (
  (i.excluded_count>0 AND i.parser_version IN ('canonical-v1.0.0','canonical-v1.0.1',
    'freetrade-activity-29-gbp-v1','freetrade-activity-renamed-29-gbp-v1','trading212-invest-21-gbp-v1','trading212-invest-33-v1')
    AND (jsonb_array_length(i.record_receipts)<i.record_count OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(i.record_receipts) r
      WHERE r->>'status'='excluded' AND coalesce(r->>'reason','') NOT LIKE 'Statement notification only:%'
    ))) OR
  (i.parser_version IN ('canonical-v1.0.0','canonical-v1.0.1','canonical-v1.1.0') AND i.duplicate_count>0 AND (
    jsonb_array_length(i.record_receipts)<i.record_count OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(i.record_receipts) r
    WHERE r->>'status' IN ('accepted','duplicate')
    GROUP BY r->>'sourceKey' HAVING count(*)>1 OR r->>'sourceKey' IS NULL
  )))
);
GRANT SELECT ON cgt.unverified_import_receipts TO cgt_app;
CREATE INDEX active_statement_digests ON cgt.imports(file_digest, account_id) WHERE status = 'committed';
COMMIT;
