import { checkExecutionShapedDividend, trading212TradeDate } from "../domain/imports/native";
import { query, type Connection } from "./database";

interface SavedDividend {
  import_id: string;
  account_label: string;
  record: string;
  fields: Record<string, string>;
}

export async function trading212DividendIssue(tx: Connection, portfolioId: string, through?: string) {
  // v2 kept the original cash fields. For a v1 import the exact-file
  // revalidation is the source of these fields. An unverified v1 receipt
  // is handled by cgt.unverified_import_receipts.
  const rows = await query<SavedDividend>(tx, `
    SELECT i.id AS import_id,a.label AS account_label,r->>'record' AS record,r->'cashFields' AS fields
    FROM cgt.broker_accounts a
    JOIN cgt.imports i ON i.account_id=a.id
    LEFT JOIN cgt.receipt_revalidations v ON v.import_id=i.id
    CROSS JOIN LATERAL jsonb_array_elements(CASE
      WHEN i.parser_version IN ('trading212-invest-21-gbp-v2','trading212-invest-33-v2') THEN i.record_receipts
      ELSE v.verified_records END) AS records(r)
    WHERE a.portfolio_id=$1 AND a.broker='trading212' AND i.status='committed' AND i.excluded_count>0
      AND i.parser_version IN ('trading212-invest-21-gbp-v1','trading212-invest-33-v1',
        'trading212-invest-21-gbp-v2','trading212-invest-33-v2')
      AND r->>'status'='excluded' AND r#>>'{cashFields,Action}'='Dividend (Dividend)'
      AND r->'cashFields' ?& ARRAY['ID','No. of shares','Price / share']
    ORDER BY i.id`, [portfolioId]);
  for (const row of rows) {
    try {
      checkExecutionShapedDividend(row.fields);
    } catch {
      if (through) {
        const timestamp = row.fields["Time (UTC)"] ?? row.fields.Time;
        try {
          if (timestamp && trading212TradeDate(timestamp) > through) continue;
        } catch {
          // An unreadable date cannot establish that the row is outside the period.
        }
      }
      return `Trading 212 receipt ${row.import_id} for ${row.account_label} excluded row ${row.record} as a dividend. Its recorded cash and withholding do not establish a dividend payment. Check the original statement and dividend voucher or trade confirmation. Reverse this receipt and import the supported, evidenced records before calculating.`;
    }
  }
  return null;
}
