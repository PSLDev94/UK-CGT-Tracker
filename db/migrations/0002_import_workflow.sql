BEGIN;
ALTER TABLE cgt.portfolios ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);
-- Initial scope is one taxpayer / legal capacity. All their taxable accounts
-- must share a pool; the UI must not accidentally create separate tax pools.
CREATE UNIQUE INDEX one_personal_portfolio ON cgt.portfolios(owner_id);

CREATE TABLE cgt.import_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  account_id uuid NOT NULL,
  csv text NOT NULL CHECK (octet_length(csv) <= 10485760),
  format text NOT NULL CHECK (format IN ('canonical-v1', 'native')),
  reviewed_revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  FOREIGN KEY (account_id, owner_id) REFERENCES cgt.broker_accounts (id, owner_id)
);
CREATE INDEX import_drafts_expiry ON cgt.import_drafts(expires_at);
ALTER TABLE cgt.import_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt.import_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON cgt.import_drafts TO cgt_app
  USING (owner_id = nullif(current_setting('cgt.owner_id', true), ''))
  WITH CHECK (owner_id = nullif(current_setting('cgt.owner_id', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON cgt.import_drafts TO cgt_app;

ALTER TABLE cgt.imports ADD COLUMN record_receipts jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(record_receipts) = 'array');
ALTER TABLE cgt.imports ADD COLUMN reversed_at timestamptz;
ALTER TABLE cgt.imports ADD COLUMN reversal_reason text;
ALTER TABLE cgt.imports DROP CONSTRAINT imports_account_id_file_digest_parser_version_key;
CREATE UNIQUE INDEX one_active_import ON cgt.imports(account_id, file_digest, parser_version) WHERE status = 'committed';
ALTER TABLE cgt.transactions ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE cgt.transactions DROP CONSTRAINT transactions_owner_id_source_key_key;
CREATE UNIQUE INDEX one_active_source_record ON cgt.transactions(owner_id, source_key) WHERE active;
ALTER TABLE cgt.calculation_runs ADD COLUMN portfolio_revision integer NOT NULL DEFAULT 0;
ALTER TABLE cgt.calculation_runs ADD COLUMN coverage_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE cgt.calculation_runs ADD COLUMN coverage_accounts jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMIT;
