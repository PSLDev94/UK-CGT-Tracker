import { query, type Connection } from "./database";
import { sourceKey } from "../domain/imports/ibkr-identity";

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
  const [unsupported] = await query<{ label: string; import_id: string }>(
    tx,
    `SELECT a.label,t.import_id FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
      WHERE a.portfolio_id=$1 AND t.active AND t.consideration_gbp=0 AND ($2::date IS NULL OR t.trade_date<=$2)
      LIMIT 1`,
    [portfolioId, through ?? null],
  );
  if (unsupported)
    return `Review the zero-consideration trade in ${unsupported.label} (receipt ${unsupported.import_id}). Verify its tax treatment before publishing a new calculation.`;

  // Old excluded template rows retained their disposition but no source
  // values. A fresh preview of that file is the only way to validate the exclusions.
  const [unverified] = await query<{ label: string; id: string }>(
    tx,
    `SELECT a.label,i.id FROM cgt.imports i JOIN cgt.broker_accounts a ON a.id=i.account_id
      WHERE a.portfolio_id=$1 AND i.status='committed' AND i.parser_version IN ('canonical-v1.0.0','canonical-v1.0.1')
      AND i.excluded_count>0 LIMIT 1`,
    [portfolioId],
  );
  if (unverified)
    return `The older template receipt ${unverified.id} on ${unverified.label} contains cash exclusions whose source fields were not retained. Reverse it and re-import the original template for validation.`;

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
