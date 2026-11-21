import { defineConfig, devices } from "@playwright/test";

function localWebServer(port: number, env: Record<string, string>) {
  return {
    command: "npm run start",
    env: { PORT: String(port), HOSTNAME: "127.0.0.1", ...env },
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 30000,
  };
}
const closedSales = {
  RAILWAY_ENVIRONMENT_NAME: "production",
  APP_ORIGIN: "https://www.cgttracker.com",
  STRIPE_MODE: "live",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  TRADER_LEGAL_NAME: "",
  TRADER_GEOGRAPHIC_ADDRESS: "",
};

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers: 3,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3200", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: [
    localWebServer(3200, { RAILWAY_ENVIRONMENT_NAME: "staging" }),
    localWebServer(33201, { ...closedSales, BILLING_ENABLED: "false" }),
    localWebServer(33202, { ...closedSales, BILLING_ENABLED: "true" }),
  ],
});
