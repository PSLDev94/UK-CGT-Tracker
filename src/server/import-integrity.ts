import { query, type Connection } from "./database";
import { sourceKey } from "../domain/imports/ibkr-identity";
import { trading212DividendIssue } from "./trading212-receipt-evidence";

interface StoredIbkr {
  account_id: string;
  binding: string | null;
  external: string | null;
  execution: string | null;
  source_key: string;
  label: string;
  import_id: string;
  invalid_rate: boolean;
}

/** Pre-fix canonical IDs can be recovered by comparing their original hashes
 * to a known native execution. Never rewrite an immutable receipt to do this. */
export async function activeImportIssue(
  tx: Connection,
  portfolioId: string,
  through?: string,
): Promise<string | null> {
  const [brokerIssue] = await query<{ import_id: string; issue: string; label: string }>(tx,
    `SELECT v.import_id,v.issue,a.label FROM cgt.broker_evidence_issues v
     JOIN cgt.broker_accounts a ON a.id=v.account_id WHERE a.portfolio_id=$1
       AND ($2::date IS NULL OR v.earliest_date <= $2::date)
     ORDER BY v.earliest_date,v.import_id LIMIT 1`, [portfolioId, through ?? null]);
  if (brokerIssue) {
    const evidence = brokerIssue.issue === "ambiguous_flex_date"
      ? "An IBKR Flex trade date can be read in two ways. Re-export the original executions with year-first dates."
      : "A Trading 212 charge appears on the wrong side of a trade. Check the fee, trade direction and net amount against the contract note.";
    return `${evidence} Reverse receipt ${brokerIssue.import_id} for ${brokerIssue.label} and import the verified records before calculating.`;
  }
  const [foreign] = await query<{ label: string; import_id: string }>(tx,
    `SELECT a.label,t.import_id FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
     WHERE a.portfolio_id=$1 AND t.active AND t.provenance->>'originalCurrency'<>'GBP'
       AND ($2::date IS NULL OR t.trade_date<=$2)
       AND (cgt.supported_fx_product(t.consideration_gbp,t.provenance->>'consideration',t.provenance->>'gbpPerUnit') IS NULL
         OR cgt.supported_fx_product(t.fees_gbp,t.provenance->>'fees',t.provenance->>'gbpPerUnit') IS NULL)
     LIMIT 1`, [portfolioId, through ?? null]);
  if (foreign)
    return `The foreign amount, fees and exchange rate on receipt ${foreign.import_id} for ${foreign.label} cannot be reconciled to sterling. Verify the original statement and replace the affected import before calculating.`;

  const [unsupported] = await query<{ label: string; import_id: string }>(
    tx,
    `SELECT a.label,t.import_id FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
      WHERE a.portfolio_id=$1 AND t.active AND t.consideration_gbp=0 AND ($2::date IS NULL OR t.trade_date<=$2)
      LIMIT 1`,
    [portfolioId, through ?? null],
  );
  if (unsupported)
    return `Review the zero-consideration trade in ${unsupported.label} (receipt ${unsupported.import_id}). Verify its tax treatment before publishing a new calculation.`;

  const [unverified] = await query<{ label: string; id: string; issue: string }>(tx,
    `SELECT a.label,i.id,i.issue FROM cgt.unverified_import_receipts i JOIN cgt.broker_accounts a ON a.id=i.account_id
     WHERE a.portfolio_id=$1 LIMIT 1`, [portfolioId]);
  if (unverified)
    return `Review the older ${unverified.issue} on receipt ${unverified.id} for ${unverified.label}. Upload the identical original file to verify its rows. If the file contains ambiguous entries, reverse it and re-import with the original execution evidence.`;

  const dividend = await trading212DividendIssue(tx, portfolioId, through);
  if (dividend) return dividend;

  const [overlap] = await query<{ first_id: string; second_id: string; first_label: string; second_label:string }>(tx,
    `WITH receipts AS MATERIALIZED (
       SELECT i.id,i.account_id,i.file_digest,a.broker,a.label FROM cgt.imports i JOIN cgt.broker_accounts a ON a.id=i.account_id
       WHERE a.portfolio_id=$1 AND a.broker<>'ibkr' AND i.status='committed'
         AND EXISTS (SELECT 1 FROM cgt.broker_accounts other_account
           JOIN cgt.imports other_import ON other_import.account_id=other_account.id AND other_import.status='committed'
           WHERE other_account.portfolio_id=$1 AND other_account.broker=a.broker AND other_account.id<>a.id)
     ), executions AS MATERIALIZED (
       SELECT r.id,r.account_id,r.broker,t.source_key,t.trade_date,t.security_id,t.side,t.quantity,t.consideration_gbp,t.fees_gbp,
         coalesce(nullif(t.provenance->>'executionReference',''),nullif(t.provenance#>>'{native,fields,Reference}',''),
           nullif(t.provenance#>>'{native,fields,ID}',''),nullif(t.provenance#>>'{native,fields,Order ID}',''),
           nullif(t.provenance#>>'{native,supportingDetails,transactionId}','')) AS execution
       FROM receipts r JOIN cgt.transactions t ON t.import_id=r.id AND t.active
       WHERE $2::date IS NULL OR t.trade_date<=$2
     ), possible_overlaps AS (
       SELECT a.id first_id,b.id second_id FROM receipts a JOIN receipts b ON b.broker=a.broker AND b.file_digest=a.file_digest
         AND b.account_id>a.account_id
       UNION ALL
       SELECT a.id,b.id FROM executions a JOIN executions b ON b.broker=a.broker AND b.execution=a.execution
         AND b.account_id>a.account_id
       UNION ALL
       SELECT a.id,b.id FROM executions a JOIN executions b ON a.broker=b.broker AND b.account_id<>a.account_id
         AND a.execution IS NULL AND b.execution IS NOT NULL
         AND a.source_key=encode(sha256(convert_to('['||to_json(a.broker)::text||','||to_json(a.account_id::text)::text||','||to_json(b.execution)::text||']','UTF8')),'hex')
       UNION ALL
       SELECT a.id,b.id FROM executions a JOIN executions b ON a.broker=b.broker AND b.account_id<>a.account_id
         AND b.trade_date=a.trade_date AND b.security_id=a.security_id AND b.side=a.side AND b.quantity=a.quantity
         AND b.consideration_gbp=a.consideration_gbp AND b.fees_gbp=a.fees_gbp
         AND a.execution IS NULL AND (b.execution IS NOT NULL OR b.account_id>a.account_id)
     )
     SELECT a.id AS first_id,b.id AS second_id,a.label AS first_label,b.label AS second_label
     FROM possible_overlaps o JOIN receipts a ON a.id=o.first_id JOIN receipts b ON b.id=o.second_id
     WHERE NOT EXISTS(SELECT 1 FROM cgt.reviewed_statement_overlaps r WHERE
       (r.other_import_id=b.id AND r.account_id=a.account_id AND r.file_digest=a.file_digest) OR
       (r.other_import_id=a.id AND r.account_id=b.account_id AND r.file_digest=b.file_digest)) LIMIT 1`, [portfolioId,through ?? null]);
  if (overlap)
    return `Review overlapping broker records on ${overlap.first_label} (receipt ${overlap.first_id}) and ${overlap.second_label} (receipt ${overlap.second_id}). Reverse the duplicate or ask support to verify the statements identify genuinely separate accounts.`;

  const rows = await query<StoredIbkr>(
    tx,
    `SELECT a.id AS account_id,a.label,a.ibkr_client_account_id AS binding,t.source_key,t.import_id,
      t.provenance#>>'{native,fields,ClientAccountID}' AS external,
      coalesce(t.provenance#>>'{native,fields,TradeID}',t.provenance->>'executionReference') AS execution,
      (t.provenance ? 'native' AND CASE WHEN t.provenance#>>'{native,fields,CurrencyPrimary}'='GBP'
        THEN coalesce(t.provenance#>>'{native,fields,FXRateToBase}','') !~ '^1([.]0+)?$'
        ELSE coalesce(t.provenance#>>'{native,supportingDetails,statementBaseCurrency}','')<>'GBP' END) AS invalid_rate
      FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
      WHERE a.portfolio_id=$1 AND a.broker='ibkr' AND t.active AND ($2::date IS NULL OR t.trade_date<=$2)`,
    [portfolioId, through ?? null],
  );
  const knownAccounts = new Map<string, string>();
  const nativeLabels = new Map<string, string>();
  for (const r of rows) {
    if (r.invalid_rate)
      return `Verify the GBP base currency and trade-date FX on IBKR receipt ${r.import_id} for ${r.label}. Reverse the affected import and re-import it with statement evidence.`;
    const external = r.external || r.binding;
    if (!external) continue;
    if (
      (nativeLabels.has(external) &&
        nativeLabels.get(external) !== r.account_id) ||
      (knownAccounts.has(r.account_id) &&
        knownAccounts.get(r.account_id) !== external)
    )
      return `Conflicting IBKR account identities appear in the saved receipts for ${r.label}. Review the imports and reverse any incorrect assignment before recalculating.`;
    nativeLabels.set(external, r.account_id);
    knownAccounts.set(r.account_id, external);
  }
  const unresolved = rows.find(
    (r) => !r.external && !r.binding && !knownAccounts.has(r.account_id),
  );
  if (unresolved)
    return `The older IBKR template receipt ${unresolved.import_id} for ${unresolved.label} has no verified ClientAccountID. Check the statement, reverse the affected import and re-import with ClientAccountID:TradeID before recalculating.`;

  const keys = new Set(rows.map((r) => r.source_key));
  const executions = new Set<string>();
  for (const r of rows) {
    const external = r.external || r.binding || knownAccounts.get(r.account_id);
    if (!external || !r.execution) continue;
    const execution = r.execution.startsWith(external + ":")
      ? r.execution.slice(external.length + 1)
      : r.execution;
    const identity = JSON.stringify([external, execution]);
    const oldKey = sourceKey("ibkr", r.account_id, execution);
    if (
      executions.has(identity) ||
      (r.source_key !== oldKey && keys.has(oldKey))
    )
      return `IBKR execution ${execution} may have been imported more than once. Check receipt ${r.import_id} for ${r.label} and reverse any overlapping import before recalculating.`;
    executions.add(identity);
  }
  return null;
}
