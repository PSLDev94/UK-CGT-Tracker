import { expect, test, type Page } from "@playwright/test";
import { calculateGains } from "../src/domain/cgt/calculate";
import type { Trade } from "../src/domain/cgt/types";
import { reviewCsv, tradesFromReview } from "../src/domain/imports/review";
import type { TaxYear } from "../src/domain/values";
import { reviewPage } from "../src/server/workspace-api";
import type { Overview, Preview } from "../src/ui/workspace-types";

const account = {
  id: "account",
  label: "Review account",
  broker: "trading212",
  account_type: "GIA",
} as const;
const sale: Trade = {
  id: "sale",
  securityId: "US0378331005",
  date: "2024-09-01",
  side: "SELL",
  quantity: "1",
  considerationGBP: "20",
  feesGBP: "0",
};
const purchase: Trade = {
  ...sale,
  id: "purchase",
  date: "2024-06-01",
  side: "BUY",
  quantity: "2",
  considerationGBP: "50",
};
const cutoff = "2025-05-05";

async function workspace(page: Page, trades: Trade[], confirmed: boolean) {
  const run = (year: TaxYear, date: string, ids: string[]) => ({
    id: "run-" + year,
    tax_year: year,
    result: calculateGains(trades, { taxYear: year, historyThrough: date }),
    coverage_confirmed: ids.includes(account.id),
    coverage_accounts: ids,
  });
  const state: Overview = {
    portfolio: { id: "portfolio", name: "Portfolio", revision: 1 },
    accounts: [account],
    imports: [],
    drafts: [],
    calculations: [run("2024-25", cutoff, confirmed ? [account.id] : [])],
  };
  const datedSubmissions: {
    historyThrough: string;
    confirmedAccountIds: string[];
  }[] = [];
  let importedTrades: Trade[] = [];
  let preview: Preview | null = null;
  await page.route("**/api/v2/auth/**", (route) =>
    route.fulfill({
      json: { user: { name: "Test investor", emailVerified: true } },
    }),
  );
  await page.route("**/api/v2/workspace", async (route) => {
    const body = route.request().postDataJSON();
    switch (body.action) {
      case "overview":
        return route.fulfill({ json: state });
      case "import-history":
        return route.fulfill({
          json: {
            imports: state.imports,
            total: state.imports.length,
            page: 1,
            pageSize: 25,
          },
        });
      case "calculate": {
        datedSubmissions.push({
          historyThrough: body.historyThrough,
          confirmedAccountIds: body.confirmedAccountIds,
        });
        const saved = run(
          body.taxYear,
          body.historyThrough,
          body.confirmedAccountIds,
        );
        state.calculations = [saved];
        return route.fulfill({
          json: { runId: saved.id, result: saved.result },
        });
      }
      case "prepare-import": {
        const review = reviewCsv(body.csv, {
          broker: "trading212",
          accountId: account.id,
          accountType: "GIA",
          format: body.format,
        });
        importedTrades = tradesFromReview(review);
        state.drafts = [
          {
            id: "recovery",
            account_id: account.id,
            expires_at: "2030-01-01T12:00:00Z",
          },
        ];
        preview = {
          draftId: "recovery",
          accountId: account.id,
          revision: 1,
          review: reviewPage(review, 1),
        };
        return route.fulfill({ json: preview });
      }
      case "review-import":
        return route.fulfill({ json: preview });
      case "commit-import":
        trades.push(...importedTrades);
        state.drafts = [];
        state.calculations = [];
        state.imports = [
          {
            id: "saved",
            account_id: account.id,
            created_at: "2026-11-18T12:00:00Z",
            status: "committed",
            record_count: 1,
            accepted_count: 1,
            excluded_count: 0,
            duplicate_count: 0,
          },
        ];
        return route.fulfill({
          json: { outcome: "committed", importId: "saved" },
        });
      default:
        throw new Error("Unexpected workspace action " + body.action);
    }
  });
  return { state, datedSubmissions };
}

test("editing saved coverage hides old figures until recalculated and isolates the selected year", async ({
  page,
}) => {
  const { datedSubmissions } = await workspace(page, [purchase, sale], true);
  await page.goto("/dashboard/calculations?year=2024-25");
  const date = page.getByLabel("History complete through");
  const accountBox = page.getByRole("checkbox", {
    name: account.label,
    exact: true,
  });
  const report = page.getByRole("link", { name: "View reports for 2024-25" });
  const warning = page
    .getByRole("status")
    .filter({ hasText: "Settings changed" });
  await expect(date).toHaveValue(cutoff);
  await expect(accountBox).toBeChecked();
  await expect(page.getByText(/Last saved calculation/)).toContainText(
    "Confirmed accounts: Review account",
  );
  await expect(report).toBeVisible();
  await accountBox.uncheck();
  await expect(warning).toBeVisible();
  await expect(report).toHaveCount(0);
  await expect(page.locator(".net-gain")).toHaveCount(0);
  await accountBox.check();
  await expect(report).toBeVisible();
  await date.fill("2024-10-01");
  await expect(accountBox).not.toBeChecked();
  await expect(warning).toBeVisible();
  await expect(page.getByText(/Last saved calculation/)).toContainText(
    "5 May 2025",
  );
  await page.getByLabel("Tax year", { exact: true }).selectOption("2023-24");
  await expect(date).toHaveValue("");
  await expect(accountBox).not.toBeChecked();
  await page.getByLabel("Tax year", { exact: true }).selectOption("2024-25");
  await expect(date).toHaveValue(cutoff);
  await expect(accountBox).toBeChecked();
  await accountBox.uncheck();
  await page.getByRole("button", { name: "Recalculate", exact: true }).click();
  await expect(warning).toHaveCount(0);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Account coverage is not confirmed" }),
  ).toBeVisible();
  await expect(page.getByText(/Last saved calculation/)).toContainText(
    "No accounts confirmed",
  );
  await expect(report).toHaveAttribute(
    "href",
    "/dashboard/reports?year=2024-25",
  );
  expect(datedSubmissions).toEqual([
    { historyThrough: cutoff, confirmedAccountIds: [] },
  ]);
  await page.goto("/dashboard");
  await expect(page.getByText("Net loss", { exact: true })).toBeVisible();
  await page.goto("/dashboard/tax-loss-harvesting");
  await expect(
    page.getByRole("link", { name: "Review account coverage" }),
  ).toHaveAttribute("href", "/dashboard/calculations?year=2024-25");
  await expect(
    page.getByLabel("Scenario price for " + sale.securityId),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Illustrative Holding Scenarios" }),
  ).toHaveCount(0);
});

test("missing purchase recovery preserves the year through upload, preview, save and recalculation", async ({
  page,
}) => {
  const { state } = await workspace(page, [sale], true);
  // Stored results can predate the upload-only recovery instructions.
  state.calculations[0]!.result.issues[0]!.message =
    "Supply a verified opening pool.";
  await page.goto("/dashboard/calculations?year=2024-25");
  await expect(page.getByText(/opening pool/i)).toHaveCount(0);
  await expect(page.locator(".net-gain")).toHaveCount(0);
  await page.getByRole("link", { name: "Upload earlier acquisitions" }).click();
  await expect(page).toHaveURL(/\/dashboard\/upload\?year=2024-25$/);
  await page
    .getByLabel("Broker account", { exact: true })
    .selectOption(account.id);
  await page.getByLabel("File format").selectOption("canonical-v1");
  await page.getByLabel("CSV file", { exact: true }).setInputFiles({
    name: "missing-purchase.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Transaction ID,Trade date,Type,ISIN,Quantity,Consideration,Fees,Currency,GBP per unit,Asset type\n" +
        "purchase,2024-06-01,BUY,US0378331005,2,50,0,GBP,1,ORDINARY_SHARE",
    ),
  });
  await page.getByRole("button", { name: "Review file", exact: true }).click();
  await expect(page).toHaveURL(/draft=recovery&year=2024-25/);
  await page
    .getByRole("button", { name: "Save 1 transaction", exact: true })
    .click();
  await expect(page).toHaveURL(/saved=saved&year=2024-25/);
  await page
    .getByRole("link", { name: "Calculate gains", exact: true })
    .click();
  await expect(page.getByLabel("Tax year", { exact: true })).toHaveValue(
    "2024-25",
  );
  await page.getByLabel("History complete through").fill(cutoff);
  await page
    .getByRole("checkbox", { name: account.label, exact: true })
    .check();
  await page
    .getByRole("button", { name: "Calculate gains", exact: true })
    .click();
  await expect(page.locator(".net-gain")).toContainText("Net loss");
  await expect(page.locator(".net-gain")).toContainText("£5.00");
  await page.goto("/dashboard/tax-loss-harvesting");
  await expect(page.getByText(/Account coverage confirmed/)).toBeVisible();
  await page.getByLabel("Scenario price for " + sale.securityId).fill("20");
  await expect(
    page.getByRole("heading", { name: "Illustrative Holding Scenarios" }),
  ).toBeVisible();
});

test("a rate-limited checkout return explains when to retry and restores the selected paid PDF", async ({
  page,
}) => {
  await workspace(page, [purchase, sale], true);
  let checks = 0;
  await page.route("**/api/v2/billing", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ action: "report-access" });
    checks++;
    if (checks === 1)
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "12" },
        json: {},
      });
    return route.fulfill({
      json: {
        status: "active",
        entitled: true,
        periodEnd: null,
        cancelAtPeriodEnd: false,
        needsReview: false,
        canManage: true,
        testMode: true,
      },
    });
  });
  await page.goto(
    "/dashboard/reports?year=2024-25&format=evidence&checkout=returned",
  );
  const evidence = page.locator("#report-evidence");
  await expect(evidence.getByRole("status")).toContainText(
    "Try again in 12 seconds",
  );
  await expect(evidence.getByText("Checking PDF access.")).toHaveCount(0);
  await evidence.getByRole("button", { name: "Retry PDF access" }).click();
  await expect(
    evidence.getByText("Payment confirmed. Your PDF is ready."),
  ).toBeVisible();
  await expect(
    evidence.getByRole("button", { name: "Download evidence PDF" }),
  ).toBeEnabled();
  expect(checks).toBe(2);
});
