import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { productionOrigin, productionTrader, publicBillingMode } from "../src/server/public-site";

afterEach(() => vi.unstubAllEnvs());

function production() {
  vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
  vi.stubEnv("APP_ORIGIN", productionOrigin);
  vi.stubEnv("STRIPE_MODE", "live");
  vi.stubEnv("BILLING_ENABLED", "true");
  vi.stubEnv("TRADER_LEGAL_NAME", "Synthetic trader");
  vi.stubEnv("TRADER_GEOGRAPHIC_ADDRESS", "Synthetic business address");
}

function request(host: string, path: string) {
  return proxy(new NextRequest(`https://${host}${path}`, {
    headers: { host, "x-cgt-public-index": "allow" },
  }));
}

describe("production public site", () => {
  it("opens public crawling only on the canonical production host and public routes", () => {
    production();
    expect(request("www.cgttracker.com", "/pricing").headers.get("x-robots-tag")).toBe("index, follow");
    for (const [host, path] of [
      ["preview.up.railway.app", "/pricing"],
      ["www.cgttracker.com", "/dashboard/reports"],
      ["www.cgttracker.com", "/account/reset"],
    ] as const) {
      expect(request(host, path).headers.get("x-middleware-request-x-cgt-public-index")).toBe("deny");
    }
    expect(request("www.cgttracker.com", "/design-preview").status).toBe(404);
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "staging");
    expect(request("www.cgttracker.com", "/pricing").headers.get("x-middleware-request-x-cgt-public-index")).toBe("deny");
    expect(publicBillingMode()).toBe("preview");
  });

  it("requires live mode, the canonical origin and trader disclosures before advertising live checkout", () => {
    production();
    expect(publicBillingMode()).toBe("live");
    vi.stubEnv("TRADER_GEOGRAPHIC_ADDRESS", " ");
    expect(productionTrader()).toBeNull();
    expect(publicBillingMode()).toBe("unavailable");
    vi.stubEnv("TRADER_GEOGRAPHIC_ADDRESS", "Synthetic business address");
    vi.stubEnv("STRIPE_MODE", "test");
    expect(publicBillingMode()).toBe("unavailable");
    vi.stubEnv("STRIPE_MODE", "live");
    vi.stubEnv("APP_ORIGIN", "https://preview.up.railway.app");
    expect(publicBillingMode()).toBe("unavailable");
  });
});
