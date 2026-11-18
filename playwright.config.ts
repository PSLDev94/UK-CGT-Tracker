import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers: 3,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3200", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    env: { PORT: "3200", HOSTNAME: "127.0.0.1" },
    url: "http://127.0.0.1:3200/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
