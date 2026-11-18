import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { Billing } from "./billing";
import { StripeGateway, stripeClient } from "./stripe-gateway";
import { assertRuntimeRole } from "./database";
import { AppError } from "./errors";
import { runtime } from "./runtime";
import {
  createBillingHandler,
  createStripeWebhookHandler,
} from "./billing-api";

const required = (name: string) => {
  const value = process.env[name];
  if (!value)
    throw new AppError(
      503,
      "BILLING_UNAVAILABLE",
      "Billing is not available yet. Your saved records are unaffected.",
    );
  return value;
};
async function initialise() {
  if (process.env.BILLING_ENABLED !== "true")
    throw new AppError(
      503,
      "BILLING_UNAVAILABLE",
      "Billing is not available yet. Your saved records are unaffected.",
    );
  const key = required("STRIPE_SECRET_KEY");
  // Live checkout remains locked until legacy entitlement migration, VAT treatment
  // and full release qualification are complete. A copied live key fails closed.
  if (!/^[rs]k_test_/.test(key))
    throw new Error("This preview only supports Stripe sandbox keys");
  const config = {
    origin: required("APP_ORIGIN"),
    accountId: required("STRIPE_ACCOUNT_ID"),
    priceId: required("STRIPE_PRICE_ID"),
    livemode: false,
  };
  const url = required("BILLING_DATABASE_URL");
  if (
    [process.env.APP_DATABASE_URL, process.env.AUTH_DATABASE_URL].includes(url)
  )
    throw new Error("Billing requires a separate login");
  const gateway = new StripeGateway(
    stripeClient(key),
    config,
    required("STRIPE_PORTAL_CONFIGURATION_ID"),
  );
  const db = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: url,
        max: 4,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        options:
          "-c role=cgt_billing -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000",
      }),
    }),
  });
  try {
    await Promise.all([
      assertRuntimeRole(db, "cgt_billing"),
      gateway.validate(),
    ]);
    const billing = new Billing(db, gateway, config);
    const application = await runtime();
    return {
      billing,
      handler: createBillingHandler(
        billing,
        (headers) => application.auth.api.getSession({ headers }),
        config.origin,
        (identity, bucket) =>
          application.workspace.consumeRequest(identity, bucket),
        (identity, target, purpose) => application.workspace.selectedReportIssue(identity, target, purpose),
      ),
      webhook: createStripeWebhookHandler(
        billing,
        gateway,
        required("STRIPE_WEBHOOK_SECRET"),
      ),
    };
  } catch (error) {
    await db.destroy();
    throw error;
  }
}
let instance: ReturnType<typeof initialise> | undefined;
export function billingRuntime() {
  instance ??= initialise().catch((error) => {
    instance = undefined;
    throw error;
  });
  return instance;
}
