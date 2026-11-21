import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { Billing } from "../src/server/billing";
import { StripeGateway, stripeClient } from "../src/server/stripe-gateway";
import { stripeSettings } from "../src/server/billing-config";
import { assertRuntimeRole } from "../src/server/database";
const required = (key: string) => {
  const value = process.env[key];
  if (!value)
    throw new Error("Billing reconciliation configuration is incomplete");
  return value;
};
async function main() {
  const { key, config, portalConfiguration } = stripeSettings(process.env);
  const db = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: required("BILLING_DATABASE_URL"),
        max: 2,
        connectionTimeoutMillis: 10000,
        options:
          "-c role=cgt_billing -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000",
      }),
    }),
  });
  try {
    const gateway = new StripeGateway(
      stripeClient(key),
      config,
      portalConfiguration,
    );
    await assertRuntimeRole(db, "cgt_billing");
    await gateway.validate();
    const billing = new Billing(db, gateway, config);
    const totals = { checked: 0, updated: 0, failed: 0, needsReview: 0 };
    let cursor = "",
      finished = false;
    for (let batch = 0; batch < 40; batch++) {
      const result = await billing.reconcileBatch(cursor);
      for (const field of [
        "checked",
        "updated",
        "failed",
        "needsReview",
      ] as const)
        totals[field] += result[field];
      if (!result.nextCursor) {
        finished = true;
        break;
      }
      cursor = result.nextCursor;
    }
    console.log(
      JSON.stringify({ event: "billing_reconciliation", ...totals, finished }),
    );
    if (totals.failed || !finished) process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}
void main().catch(() => {
  console.error(JSON.stringify({ event: "billing_reconciliation_failed" }));
  process.exitCode = 1;
});
