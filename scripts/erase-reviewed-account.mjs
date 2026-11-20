// Operator-only. No HTTP route or application role can perform this operation.
import { Client } from "pg";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    owner: { type: "string" },
    "case-id": { type: "string" },
    apply: { type: "boolean" },
    "billing-reviewed": { type: "boolean" },
  },
});
const owner = values.owner?.trim();
if (
  !owner ||
  !values["case-id"]?.trim() ||
  !process.env.OPERATOR_DATABASE_URL
) {
  throw new Error(
    "Supply --owner, --case-id and a dedicated OPERATOR_DATABASE_URL. The default is a dry run.",
  );
}
const client = new Client({
  connectionString: process.env.OPERATOR_DATABASE_URL,
});
const tables = [
  "published_calculations",
  "calculation_runs",
  "reviewed_statement_overlaps",
  "receipt_revalidations",
  "transactions",
  "imports",
  "import_drafts",
  "broker_accounts",
  "reviewed_opening_pools",
  "portfolios",
  "request_limits",
  "billing_accounts",
];
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  // Fail if this operator lacks full visibility, rather than treating invisible rows as absent.
  await client.query("SET LOCAL row_security=off");
  await client.query("SET LOCAL lock_timeout='5s'");
  const user = await client.query(
    'SELECT id FROM auth."user" WHERE id=$1 FOR UPDATE',
    [owner],
  );
  if (!user.rowCount) {
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ outcome: "already_absent" }));
  } else {
    const billing = await client.query(
      "SELECT subscription_status,risk_hold,entitled FROM cgt.billing_accounts WHERE owner_id=$1 FOR UPDATE",
      [owner],
    );
    const bill = billing.rows[0];
    const blocked =
      !!bill &&
      (bill.risk_hold ||
        bill.entitled ||
        !["none", "canceled", "incomplete_expired"].includes(
          bill.subscription_status,
        ) ||
        !values["billing-reviewed"]);
    const counts = {};
    for (const table of tables) {
      const result = await client.query(
        "SELECT count(*)::int AS n FROM cgt." + table + " WHERE owner_id=$1",
        [owner],
      );
      counts[table] = result.rows[0].n;
    }
    if (!values.apply || blocked) {
      await client.query("ROLLBACK");
      console.log(
        JSON.stringify({
          outcome: blocked ? "billing_review_required" : "dry_run",
          counts,
        }),
      );
      if (blocked && values.apply) process.exitCode = 2;
    } else {
      // Reset links store the owner ID as their value. Auth sessions and credentials cascade from the user.
      await client.query(
        "DELETE FROM auth.verification WHERE identifier LIKE 'reset-password:%' AND value=$1",
        [owner],
      );
      for (const table of tables)
        await client.query("DELETE FROM cgt." + table + " WHERE owner_id=$1", [
          owner,
        ]);
      await client.query('DELETE FROM auth."user" WHERE id=$1', [owner]);
      await client.query("COMMIT");
      console.log(JSON.stringify({ outcome: "erased", counts }));
    }
  }
} catch {
  await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Account erasure did not complete. Check the operator connection and case before retrying.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
