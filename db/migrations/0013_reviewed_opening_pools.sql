BEGIN;

-- One immutable review per portfolio revision. Later corrections append a new
-- decision for the same security. Customer-facing roles can only read it.
CREATE TABLE cgt.reviewed_opening_pools (
  portfolio_id uuid NOT NULL,
  owner_id text NOT NULL,
  portfolio_revision integer NOT NULL CHECK (portfolio_revision > 0),
  security_id text NOT NULL CHECK (security_id ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  as_of date NOT NULL CHECK (as_of >= DATE '2008-04-05'),
  quantity numeric(38,12) NOT NULL CHECK (quantity >= 0 AND quantity <> 'NaN'::numeric),
  cost_gbp numeric(38,12) NOT NULL CHECK (cost_gbp >= 0 AND cost_gbp <> 'NaN'::numeric),
  case_reference text NOT NULL CHECK (case_reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$'),
  source_reference text NOT NULL CHECK (source_reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$'),
  supersedes_case_reference text,
  is_withdrawal boolean NOT NULL DEFAULT false,
  reviewed_input_digest text NOT NULL CHECK (reviewed_input_digest ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity > 0 OR cost_gbp = 0),
  CHECK (supersedes_case_reference IS DISTINCT FROM case_reference),
  CHECK (NOT is_withdrawal OR supersedes_case_reference IS NOT NULL),
  PRIMARY KEY (portfolio_id, portfolio_revision),
  UNIQUE (portfolio_id, security_id, case_reference),
  UNIQUE (portfolio_id, security_id, supersedes_case_reference),
  FOREIGN KEY (portfolio_id, security_id, supersedes_case_reference)
    REFERENCES cgt.reviewed_opening_pools (portfolio_id, security_id, case_reference),
  FOREIGN KEY (portfolio_id, owner_id) REFERENCES cgt.portfolios (id, owner_id)
);
ALTER TABLE cgt.reviewed_opening_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt.reviewed_opening_pools FORCE ROW LEVEL SECURITY;
CREATE POLICY own_reviewed_positions ON cgt.reviewed_opening_pools FOR SELECT TO cgt_app
  USING (owner_id = nullif(current_setting('cgt.owner_id', true), ''));
GRANT SELECT ON cgt.reviewed_opening_pools TO cgt_app;

COMMIT;
