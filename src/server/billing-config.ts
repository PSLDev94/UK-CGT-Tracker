import type { BillingConfig } from "./billing";
import { productionOrigin } from "./public-site";

/** Shared by the HTTP service and the scheduled reconciliation job. */
export function stripeSettings(env: Readonly<Record<string, string | undefined>>): {
  key: string;
  config: BillingConfig;
  portalConfiguration: string;
} {
  const mode = env.STRIPE_MODE ?? "test";
  if (mode !== "live" && mode !== "test") throw new Error("Invalid Stripe mode");
  const key = env.STRIPE_SECRET_KEY;
  const accountId = env.STRIPE_ACCOUNT_ID;
  const priceId = env.STRIPE_PRICE_ID;
  const portalConfiguration = env.STRIPE_PORTAL_CONFIGURATION_ID;
  const origin = env.APP_ORIGIN;
  if (!key || !accountId || !priceId || !portalConfiguration || !origin)
    throw new Error("Billing configuration is incomplete");

  const live = mode === "live";
  const production = env.RAILWAY_ENVIRONMENT_NAME === "production";
  const url = new URL(origin);
  const allowedOrigin = live
    ? origin === productionOrigin
    : !["www.cgttracker.com", "cgttracker.com"].includes(url.hostname);
  const keyPattern = live ? /^[rs]k_live_.+$/ : /^[rs]k_test_.+$/;
  if (
    url.origin !== origin ||
    live !== production ||
    !allowedOrigin ||
    !keyPattern.test(key)
  ) {
    throw new Error("Stripe mode does not match the deployment, application origin or key");
  }

  return { key, config: { origin, accountId, priceId, livemode: live }, portalConfiguration };
}
