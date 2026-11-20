-- Fresh database only. Auth tables are installed separately by the pinned auth
-- integration. owner_id is that integration's verified user ID, never client input.
-- Run migrations as an owner role; the web connection must use cgt_app privileges.
BEGIN;
CREATE SCHEMA cgt;
CREATE ROLE cgt_app NOLOGIN;
CREATE ROLE cgt_billing NOLOGIN;

CREATE TABLE cgt.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);

CREATE TABLE cgt.broker_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  owner_id text NOT NULL,
  broker text NOT NULL CHECK (broker IN ('trading212', 'freetrade', 'hl', 'ii', 'ibkr', 'ajbell')),
  account_type text NOT NULL CHECK (account_type = 'GIA'),
  label text NOT NULL,
  UNIQUE (id, owner_id),
  FOREIGN KEY (portfolio_id, owner_id) REFERENCES cgt.portfolios (id, owner_id)
);

CREATE TABLE cgt.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  owner_id text NOT NULL,
  file_digest text NOT NULL CHECK (file_digest ~ '^[a-f0-9]{64}$'),
  parser_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('review', 'committed', 'reversed')),
  record_count integer NOT NULL CHECK (record_count >= 0),
  accepted_count integer NOT NULL CHECK (accepted_count >= 0),
  excluded_count integer NOT NULL CHECK (excluded_count >= 0),
  duplicate_count integer NOT NULL CHECK (duplicate_count >= 0),
  review_count integer NOT NULL CHECK (review_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (record_count = accepted_count + excluded_count + duplicate_count + review_count),
  CHECK (status <> 'committed' OR (review_count = 0 AND accepted_count > 0)),
  UNIQUE (id, account_id, owner_id),
  UNIQUE (account_id, file_digest, parser_version),
  FOREIGN KEY (account_id, owner_id) REFERENCES cgt.broker_accounts (id, owner_id)
);

CREATE TABLE cgt.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  import_id uuid NOT NULL,
  owner_id text NOT NULL,
  source_key text NOT NULL CHECK (source_key ~ '^[a-f0-9]{64}$'),
  content_digest text NOT NULL CHECK (content_digest ~ '^[a-f0-9]{64}$'),
  source_record integer NOT NULL CHECK (source_record >= 2),
  security_id text NOT NULL,
  trade_date date NOT NULL,
  side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity numeric(38,12) NOT NULL CHECK (quantity > 0 AND quantity <> 'NaN'::numeric),
  consideration_gbp numeric(38,12) NOT NULL CHECK (consideration_gbp >= 0 AND consideration_gbp <> 'NaN'::numeric),
  fees_gbp numeric(38,12) NOT NULL CHECK (fees_gbp >= 0 AND fees_gbp <> 'NaN'::numeric),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
  UNIQUE (owner_id, source_key),
  FOREIGN KEY (import_id, account_id, owner_id) REFERENCES cgt.imports (id, account_id, owner_id)
);
CREATE INDEX transactions_history ON cgt.transactions (owner_id, trade_date, id);
CREATE INDEX accounts_portfolio ON cgt.broker_accounts (portfolio_id, owner_id);

CREATE TABLE cgt.calculation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  owner_id text NOT NULL,
  tax_year text NOT NULL CHECK (tax_year ~ '^20[0-9]{2}-[0-9]{2}$'),
  engine_version text NOT NULL,
  input_digest text NOT NULL CHECK (input_digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('complete', 'provisional', 'blocked')),
  history_through date NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, portfolio_id, owner_id, tax_year),
  UNIQUE (portfolio_id, tax_year, engine_version, input_digest),
  FOREIGN KEY (portfolio_id, owner_id) REFERENCES cgt.portfolios (id, owner_id)
);

-- Publishing changes one pointer atomically; old calculation snapshots survive.
CREATE TABLE cgt.published_calculations (
  portfolio_id uuid NOT NULL,
  owner_id text NOT NULL,
  tax_year text NOT NULL,
  run_id uuid NOT NULL,
  PRIMARY KEY (portfolio_id, tax_year),
  FOREIGN KEY (run_id, portfolio_id, owner_id, tax_year)
    REFERENCES cgt.calculation_runs (id, portfolio_id, owner_id, tax_year)
);

-- These are never writable through the ordinary customer-facing connection.
CREATE TABLE cgt.billing_accounts (
  owner_id text PRIMARY KEY,
  stripe_customer_id text NOT NULL UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_account_id text NOT NULL,
  livemode boolean NOT NULL,
  subscription_status text NOT NULL,
  current_period_end timestamptz,
  reconciled_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cgt.stripe_events (
  stripe_account_id text NOT NULL,
  livemode boolean NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stripe_account_id, livemode, event_id)
);

GRANT USAGE ON SCHEMA cgt TO cgt_app, cgt_billing;
GRANT SELECT, INSERT, UPDATE, DELETE ON cgt.portfolios, cgt.broker_accounts, cgt.imports,
  cgt.transactions, cgt.published_calculations TO cgt_app;
-- Immutable to the application after creation.
GRANT SELECT, INSERT ON cgt.calculation_runs TO cgt_app;
GRANT SELECT ON cgt.billing_accounts TO cgt_app;
GRANT SELECT, INSERT, UPDATE ON cgt.billing_accounts TO cgt_billing;
GRANT SELECT, INSERT ON cgt.stripe_events TO cgt_billing;

-- Transaction-local context is assigned by server code AFTER session verification.
-- Never give end users database credentials or expose arbitrary SQL endpoints.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['portfolios', 'broker_accounts', 'imports', 'transactions', 'calculation_runs', 'published_calculations', 'billing_accounts'] LOOP
    EXECUTE format('ALTER TABLE cgt.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE cgt.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY own_rows ON cgt.%I TO cgt_app USING (owner_id = nullif(current_setting(''cgt.owner_id'', true), '''')) WITH CHECK (owner_id = nullif(current_setting(''cgt.owner_id'', true), ''''))',
      table_name
    );
  END LOOP;
END $$;
ALTER TABLE cgt.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt.stripe_events FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_worker ON cgt.billing_accounts TO cgt_billing USING (true) WITH CHECK (true);
CREATE POLICY webhook_worker ON cgt.stripe_events TO cgt_billing USING (true) WITH CHECK (true);
COMMIT;
