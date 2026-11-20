BEGIN;

-- A source amount and a GBP-per-unit rate each have up to 12 fractional
-- digits. Allow all 24 in their product with the same maximum sterling value.
ALTER TABLE cgt.transactions
  ALTER COLUMN consideration_gbp TYPE numeric(50,24),
  ALTER COLUMN fees_gbp TYPE numeric(50,24);

-- Existing receipt and snapshot amounts stay intact. Older trades recorded
-- their original operands alongside a 12-place conversion. Recover only the
-- exact product supported by that evidence and the original stored amount.
CREATE FUNCTION cgt.supported_fx_product(recorded numeric, original text, rate text)
RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN length(original) <= 50 AND length(rate) <= 50
      AND original ~ '^[0-9]+([.][0-9]+)?(e[+-]?[0-9]{1,2})?$'
      AND rate ~ '^[0-9]+([.][0-9]+)?(e[+-]?[0-9]{1,2})?$'
    THEN CASE WHEN rate::numeric > 0 AND (
        original::numeric * rate::numeric = recorded
        OR round(original::numeric * rate::numeric,12) = recorded
      ) THEN trim_scale(original::numeric * rate::numeric) END
  END
$$;

CREATE FUNCTION cgt.ledger_gbp(recorded numeric, original text, rate text)
RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(cgt.supported_fx_product(recorded, original, rate), trim_scale(recorded))
$$;

COMMIT;
