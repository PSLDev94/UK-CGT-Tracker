export const productionOrigin = "https://www.cgttracker.com";

export function isProductionSite() {
  return process.env.RAILWAY_ENVIRONMENT_NAME === "production" &&
    process.env.APP_ORIGIN === productionOrigin;
}

export function productionTrader() {
  if (!isProductionSite()) return null;
  const legalName = process.env.TRADER_LEGAL_NAME?.trim();
  const address = process.env.TRADER_GEOGRAPHIC_ADDRESS?.trim();
  if (!legalName || !address) return null;
  return { legalName, address, registration: process.env.TRADER_REGISTRATION_DETAILS?.trim() };
}

export function publicBillingMode(): "live" | "preview" | "unavailable" {
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== "production") return "preview";
  return productionTrader() && process.env.STRIPE_MODE === "live" &&
    process.env.BILLING_ENABLED === "true" ? "live" : "unavailable";
}

export function publicSearchHost(host: string | null) {
  return isProductionSite() && host?.toLowerCase() === "www.cgttracker.com";
}

export function publicSearchPath(path: string) {
  return path === "/" || /^\/(pricing|supported-brokers|sample-calculation|contact|privacy|terms|guide|tools)(\/|$)/.test(path);
}
