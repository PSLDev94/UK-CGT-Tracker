BEGIN;

ALTER TABLE cgt.broker_accounts ADD COLUMN ibkr_client_account_id text
  CHECK (ibkr_client_account_id IS NULL OR (broker='ibkr' AND length(ibkr_client_account_id) BETWEEN 1 AND 200));

-- The migration owner needs to see every portfolio during the backfill even
-- when its role has no BYPASSRLS attribute. Runtime roles retain their normal
-- policies. Both table-owner settings are restored within this transaction.
ALTER TABLE cgt.broker_accounts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE cgt.transactions NO FORCE ROW LEVEL SECURITY;

-- Only bind unambiguous active histories. Conflicting legacy receipts stay
-- intact for review, including labels that used the same broker account.
WITH pairs AS (
  SELECT DISTINCT a.id,a.portfolio_id,t.provenance#>>'{native,fields,ClientAccountID}' AS external
  FROM cgt.broker_accounts a JOIN cgt.transactions t ON t.account_id=a.id
  WHERE a.broker='ibkr' AND t.active AND t.provenance#>>'{native,fields,ClientAccountID}' IS NOT NULL
), bindings AS (
  SELECT *,count(*) OVER (PARTITION BY id) AS per_label,
    count(*) OVER (PARTITION BY portfolio_id,external) AS per_external
  FROM pairs
)
UPDATE cgt.broker_accounts a SET ibkr_client_account_id=b.external FROM bindings b
WHERE a.id=b.id AND b.per_label=1 AND b.per_external=1 AND length(b.external) BETWEEN 1 AND 200;

ALTER TABLE cgt.transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE cgt.broker_accounts FORCE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX ibkr_account_binding ON cgt.broker_accounts(portfolio_id,ibkr_client_account_id)
WHERE ibkr_client_account_id IS NOT NULL;

COMMIT;
