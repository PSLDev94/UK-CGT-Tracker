BEGIN;

-- Retain the receipt and its original evidence. Either date interpretation
-- can affect a report, even when the previously stored date is after its cutoff.
CREATE VIEW cgt.broker_evidence_issues WITH (security_invoker=true) AS
SELECT t.import_id, t.account_id, 'ambiguous_flex_date'::text AS issue,
  make_date(extract(year FROM t.trade_date)::int,
    least(parts[1],parts[2])::int, greatest(parts[1],parts[2])::int) AS earliest_date
FROM cgt.transactions t
CROSS JOIN LATERAL regexp_matches(t.provenance#>>'{native,fields,TradeDate}',
  '^(0[1-9]|1[0-2])/(0[1-9]|1[0-2])/[0-9]{4}$') AS split(parts)
WHERE t.active AND t.provenance#>>'{native,format}'='ibkr-flex-executions-v1'
  AND parts[1]<>parts[2]
UNION ALL
SELECT t.import_id, t.account_id, 'fee_direction'::text, t.trade_date
FROM cgt.transactions t
WHERE t.active AND t.provenance#>>'{native,format}'='trading212-invest-33-v1'
  -- The accepted source fields are unsigned plain decimals. At least one
  -- nonzero digit distinguishes an actual charge from an empty or zero fee.
  AND ((t.side='BUY' AND t.provenance#>>'{native,fields,Finra fee}' ~ '[1-9]')
    OR (t.side='SELL' AND (t.provenance#>>'{native,fields,Stamp duty reserve tax}' ~ '[1-9]'
      OR t.provenance#>>'{native,fields,French transaction tax}' ~ '[1-9]')));

GRANT SELECT ON cgt.broker_evidence_issues TO cgt_app;
COMMIT;
