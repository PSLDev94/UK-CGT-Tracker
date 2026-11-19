// Creates a private access-request file for one verified owner. Never export login secrets.
import { Client } from "pg";
import { open } from "node:fs/promises";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: {
    owner: { type: "string" },
    "case-id": { type: "string" },
    output: { type: "string" },
  },
});
if (
  !values.owner?.trim() ||
  !values["case-id"]?.trim() ||
  !values.output ||
  !process.env.OPERATOR_DATABASE_URL
)
  throw new Error(
    "Supply the verified --owner, --case-id, a new --output path and OPERATOR_DATABASE_URL.",
  );
const db = new Client({ connectionString: process.env.OPERATOR_DATABASE_URL });
try {
  await db.connect();
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await db.query("SET LOCAL row_security=off");
  const rows = async (sql) => (await db.query(sql, [values.owner])).rows;
  const [profile] = await rows(
    'SELECT id,name,email,"emailVerified","createdAt","updatedAt" FROM auth."user" WHERE id=$1',
  );
  if (!profile) throw new Error("Missing owner");
  const data = { profile };
  for (const table of [
    "portfolios",
    "broker_accounts",
    "reviewed_opening_pools",
    "reviewed_statement_overlaps",
    "receipt_revalidations",
    "import_drafts",
    "imports",
    "transactions",
    "calculation_runs",
    "published_calculations",
  ])
    data[table] = await rows(
      "SELECT * FROM cgt." + table + " WHERE owner_id=$1",
    );
  data.billing = await rows(
    "SELECT stripe_customer_id,stripe_subscription_id,subscription_status,current_period_end,cancel_at_period_end,entitled FROM cgt.billing_accounts WHERE owner_id=$1",
  );
  await db.query("COMMIT");
  const file = await open(values.output, "wx", 0o600);
  try {
    await file.writeFile(JSON.stringify(data));
  } finally {
    await file.close();
  }
  console.log("Private account export written.");
} catch {
  await db.query("ROLLBACK").catch(() => {});
  console.error(
    "Export did not complete. Check the verified owner, connection and unused output path before retrying.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
