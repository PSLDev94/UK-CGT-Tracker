import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { Billing } from "./billing";
import { StripeGateway, stripeClient } from "./stripe-gateway";
import { stripeSettings } from "./billing-config";
import { productionTrader } from "./public-site";
import { resendContractMailer } from "./mail";
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
  const { key, config, portalConfiguration } = stripeSettings(process.env);
  const signingSecret = required("STRIPE_WEBHOOK_SECRET");
  if (!signingSecret.startsWith("whsec_"))
    throw new Error("A Stripe endpoint signing secret is required");
  const url = required("BILLING_DATABASE_URL");
  if (
    [process.env.APP_DATABASE_URL, process.env.AUTH_DATABASE_URL].includes(url)
  )
    throw new Error("Billing requires a separate login");
  const gateway = new StripeGateway(
    stripeClient(key),
    config,
    portalConfiguration,
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
    const billing = new Billing(db, gateway, config,
      config.livemode ? resendContractMailer(required("RESEND_API_KEY"), required("AUTH_EMAIL_FROM")) : undefined);
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
        () => !config.livemode || !!productionTrader(),
      ),
      webhook: createStripeWebhookHandler(
        billing,
        gateway,
        signingSecret,
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
