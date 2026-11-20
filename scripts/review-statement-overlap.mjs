import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { Client } from "pg";

const { values } = parseArgs({
  options: {
    draft: { type: "string" },
    receipt: { type: "string" },
    other: { type: "string" },
    case: { type: "string" },
    evidence: { type: "string" },
    apply: { type: "boolean" },
    "verified-separate-accounts": { type: "boolean" },
  },
});
if (
  !process.env.OPERATOR_DATABASE_URL ||
  !!values.draft === !!values.receipt ||
  !values.other
)
  throw new Error(
    "Supply a dedicated OPERATOR_DATABASE_URL, --other and either --draft or --receipt.",
  );
if (
  values.apply &&
  (!values["verified-separate-accounts"] ||
    !values.case?.trim() ||
    !values.evidence?.trim())
)
  throw new Error(
    "Review both original account statements and executions, then supply their case/evidence references with --verified-separate-accounts.",
  );
const client = new Client({
  connectionString: process.env.OPERATOR_DATABASE_URL,
});
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  await client.query("SET LOCAL row_security=off");
  const selected = values.draft
    ? await client.query(
        "SELECT account_id,csv FROM cgt.import_drafts WHERE id=$1 AND expires_at>now()",
        [values.draft],
      )
    : await client.query(
        "SELECT account_id,file_digest FROM cgt.imports WHERE id=$1 AND status='committed'",
        [values.receipt],
      );
  const file = selected.rows[0];
  if (!file) throw new Error("Choose an active receipt or a current preview.");
  const digest = values.draft
    ? createHash("sha256").update(file.csv).digest("hex")
    : file.file_digest;
  const other = await client.query(
    `SELECT a.owner_id,i.account_id AS other_id FROM cgt.broker_accounts a
    JOIN cgt.broker_accounts b ON a.portfolio_id=b.portfolio_id AND a.broker=b.broker AND a.id<>b.id
    JOIN cgt.imports i ON i.account_id=b.id AND i.id=$2 AND i.status='committed'
    WHERE a.id=$1 AND a.broker<>'ibkr' FOR SHARE OF a,b,i`,
    [file.account_id, values.other],
  );
  if (other.rowCount !== 1)
    throw new Error(
      "The receipts must identify separate labels at the same supported broker in one portfolio.",
    );
  if (values.apply) {
    const recorded = await client.query(
      `INSERT INTO cgt.reviewed_statement_overlaps
      (owner_id,account_id,file_digest,other_account_id,other_import_id,case_reference,source_reference)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [
        other.rows[0].owner_id,
        file.account_id,
        digest,
        other.rows[0].other_id,
        values.other,
        values.case.trim(),
        values.evidence.trim(),
      ],
    );
    await client.query("COMMIT");
    console.log(
      recorded.rowCount
        ? "Review recorded. Refresh the preview or recalculate the affected year."
        : "This statement/receipt decision was already recorded.",
    );
  } else {
    await client.query("ROLLBACK");
    console.log(
      "Eligible for review. Compare the original account identifiers, executions and contract notes before recording a decision.",
    );
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(
    error.code
      ? "Review failed. Check identifiers, permissions and the current receipt or draft."
      : error.message,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
