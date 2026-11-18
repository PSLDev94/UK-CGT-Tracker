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

test("saved receipts offer only their disposal years and preserve an explicit different year", async ({ page }) => {
  const { state } = await workspace(page, [], true);
  state.savedReceipt = {
    id: "receipt", account_id: account.id, accepted_count: 4,
    disposalYears: [{ year: "2024-25", count: 2 }, { year: "2023-24", count: 1 }],
  };
  await page.goto("/dashboard/upload?saved=receipt&year=2025-26");
  const years = page.getByRole("list", { name: "Tax years with saved sales" });
  await expect(years).toContainText("2024-25 · 2 sales");
  await expect(years).toContainText("2023-24 · 1 sale");
  await expect(page.getByText("You previously selected 2025-26. This import contains no sales in that year.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to 2025-26 calculation" })).toHaveAttribute("href", "/dashboard/calculations?year=2025-26");
  await years.getByRole("link", { name: "Calculate gains for 2023-24" }).click();
  await expect(page.getByLabel("Tax year", { exact: true })).toHaveValue("2023-24");
  state.savedReceipt.disposalYears = [];
  await page.goto("/dashboard/upload?saved=receipt");
  await expect(page.getByText(/This file added purchases only/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Calculate gains for/ })).toHaveCount(0);
});

test("Reports distinguishes no disposals from a real break-even sale before offering PDFs", async ({ page }) => {
  const { state } = await workspace(page, [purchase], true);
  let entitled = false;
  await page.route("**/api/v2/billing", (route) => route.fulfill({
    json: { status: entitled ? "active" : "none", entitled },
  }));
  await page.goto("/dashboard/reports?year=2024-25");
  const summary = page.getByRole("region", { name: "Calculation summary" });
  await expect(summary.getByText("No disposals in this tax year", { exact: true })).toBeVisible();
  await expect(summary.getByRole("button", { name: "Download CSV evidence" })).toBeVisible();
  await expect(page.locator("#report-summary, #report-evidence")).toHaveCount(0);
  entitled = true;
  await page.reload();
  await expect(page.locator("#report-summary").getByRole("button", { name: /Download/ })).toBeVisible();
  entitled = false;
  state.calculations[0]!.result = calculateGains([purchase, { ...sale, considerationGBP: "25" }], { taxYear: "2024-25", historyThrough: cutoff });
  await page.reload();
  await expect(summary.getByText("Break-even £0.00", { exact: true })).toBeVisible();
  await expect(page.locator("#report-summary").getByRole("link", { name: /Get summary PDF/ })).toBeVisible();
});

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
      json: { session: { id: "test-session" }, user: { name: "Test investor", email: "investor@example.test", emailVerified: true } },
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
        state.staleReportYears = state.staleReportYears?.filter((year) => year !== body.taxYear);
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
          affectedReportYears: state.calculations.map((c) => c.tax_year),
          review: reviewPage(review, 1),
        };
        return route.fulfill({ json: preview });
      }
      case "review-import":
        return route.fulfill({ json: preview });
      case "commit-import":
        trades.push(...importedTrades);
        state.drafts = [];
        state.staleReportYears = state.calculations.map((c) => c.tax_year);
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
        state.savedReceipt = { ...state.imports[0]!, disposalYears: [] };
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
    page.getByLabel("Your scenario price (£) for " + sale.securityId),
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
  await expect(page.getByText("After saving, recalculate 2024-25.")).toBeVisible();
  await page
    .getByRole("button", { name: "Save 1 transaction", exact: true })
    .click();
  await expect(page).toHaveURL(/saved=saved&year=2024-25/);
  await expect(page.getByRole("region", { name: "Reports to recalculate" })
    .getByRole("link", { name: "Recalculate 2024-25" })).toHaveAttribute("href", "/dashboard/calculations?year=2024-25");
  await page
    .getByRole("link", { name: "Return to 2024-25 calculation", exact: true })
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
  await page.getByLabel("Your scenario price (£) for " + sale.securityId).fill("20");
  await expect(
    page.getByRole("heading", { name: "Illustrative Holding Scenarios" }),
  ).toBeVisible();
});

test("Reports keeps year-specific recovery after an import on another device and a fresh sidebar visit", async ({ page }) => {
  const { state } = await workspace(page, [purchase, sale], true);
  await page.route("**/api/v2/billing", (route) => route.fulfill({ json: { status: "active", entitled: true } }));
  await page.route("**/api/v2/reports", (route) => route.fulfill({
    status: 404, json: { error: { code: "REPORT_UNAVAILABLE", message: "The calculation has changed." } },
  }));
  await page.goto("/dashboard/reports?year=2024-25");
  const summary = page.getByRole("region", { name: "Calculation summary" });
  await expect(summary).toBeVisible();
  const published = state.calculations[0]!;
  state.calculations = [];
  state.staleReportYears = ["2025-26", "2024-25"];
  await page.getByRole("button", { name: "Download CSV evidence" }).click();
  const recovery = page.getByRole("region", { name: "Reports to recalculate" });
  for (const year of state.staleReportYears) {
    await expect(recovery.getByRole("link", { name: "Recalculate " + year })).toHaveAttribute("href", "/dashboard/calculations?year=" + year);
  }
  await expect(summary).toHaveCount(0);
  await expect(page.getByRole("button", { name: /download.*(csv|pdf)/i })).toHaveCount(0);
  await page.goto("/dashboard/reports");
  await expect(page.getByLabel("Tax year")).toHaveValue("2025-26");
  await expect(page.getByText("There are no saved calculations yet.")).toHaveCount(0);
  await page.getByLabel("Tax year").selectOption("2024-25");
  await expect(page.getByRole("heading", { name: "Reports to recalculate" })).toBeVisible();
  state.calculations = [published];
  state.staleReportYears = ["2025-26"];
  await page.reload();
  await expect(summary).toBeVisible();
  await expect(recovery.getByRole("link")).toHaveCount(1);
  await recovery.getByRole("link", { name: "Recalculate 2025-26" }).click();
  await expect(page.getByLabel("Tax year")).toHaveValue("2025-26");
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

test("scenario prices and their labels are visible without sideways scrolling on narrow screens", async ({ page }) => {
  await workspace(page, [purchase, sale], true);
  await page.goto("/dashboard/tax-loss-harvesting");
  const holding = page.getByRole("region", { name: "Holding scenario" });
  const price = holding.getByRole("textbox", { name: "Your scenario price (£) for US0378331005" });
  for (const width of [320, 390, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(price).toBeVisible();
    const inputRect = await price.boundingBox();
    const tableRect = await holding.boundingBox();
    expect(inputRect!.x).toBeGreaterThanOrEqual(tableRect!.x);
    expect(inputRect!.x + inputRect!.width).toBeLessThanOrEqual(tableRect!.x + tableRect!.width + 1);
    await expect(holding.locator('label[for]')).toBeVisible();
  }
  await price.fill("30");
  await expect(page.getByText(/Scenario value £30.00/)).toBeVisible();
  await price.fill("-1");
  await expect(price).toHaveAccessibleDescription(/Use a non-negative decimal/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(holding.getByRole("columnheader", { name: "Your scenario price (£)" })).toBeVisible();
  await expect(holding.locator('label[for]')).toBeHidden();
});

test("unsaved settings survive staying, and leaving or saving releases the guard", async ({ page }) => {
  await workspace(page, [], false);
  await page.goto("/dashboard/settings");
  const name = page.getByLabel("Full name");
  const billing = page.getByRole("link", { name: "Manage subscription" });
  const dialog = page.getByRole("dialog", { name: "Leave settings?" });
  await name.fill("Edited investor");
  await billing.click();
  await expect(dialog.getByRole("button", { name: "Stay here" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(billing).toBeFocused();
  await expect(name).toHaveValue("Edited investor");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated successfully.")).toBeVisible();
  await billing.click();
  await expect(page).toHaveURL(/\/billing$/);
  await page.goBack();
  await page.getByLabel("New password", { exact: true }).fill("staging-example-123");
  await billing.click();
  await dialog.getByRole("button", { name: "Stay here" }).click();
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue("staging-example-123");
  await billing.click();
  await dialog.getByRole("button", { name: "Discard changes and leave" }).click();
  await expect(page).toHaveURL(/\/billing$/);
});

test("all report entry points prefer the latest save and the calculation year precedes its evidence", async ({ page, browserName }) => {
  const { state } = await workspace(page, [purchase, sale], true);
  const latest = state.calculations[0]!;
  latest.created_at = "2026-11-18T09:00:00Z";
  state.calculations.unshift({
    ...latest, id: "older-save", tax_year: "2025-26", created_at: "2026-11-17T12:00:00Z",
    result: calculateGains([purchase, sale], { taxYear: "2025-26", historyThrough: "2026-05-05" }),
  });
  await page.route("**/api/v2/billing", (route) =>
    route.fulfill({ json: { status: "active", entitled: true } }),
  );
  await page.goto("/dashboard");
  await expect(page.getByRole("link", {name: "Open latest report"})).toHaveAttribute("href", /year=2024-25/);
  await page.goto("/dashboard/reports");
  await expect(page.getByLabel("Tax year")).toHaveValue("2024-25");
  await page.goto("/dashboard/reports?year=2025-26");
  await expect(page.getByLabel("Tax year")).toHaveValue("2025-26");
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/dashboard/calculations");
  const year = page.getByLabel("Tax year");
  await expect(year).toHaveValue("2024-25");
  expect((await year.boundingBox())!.y).toBeLessThan(400);
  const report = page.getByRole("link", { name: "View reports for 2024-25" });
  const cutoff = page.getByLabel("History complete through");
  expect(await year.evaluate((el) => !!(el.compareDocumentPosition(document.querySelector("#historyThrough")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  expect((await report.boundingBox())!.y).toBeLessThan((await cutoff.boundingBox())!.y);
  await year.focus();
  // WebKit uses Option-Tab to include links in its default keyboard traversal.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(report).toBeFocused();
});

test("same-tab history restores the profile edit only for its session and clears an explicit discard", async ({ page }) => {
  await workspace(page, [], false);
  let session = "first-session";
  await page.route("**/api/v2/auth/get-session", route => route.fulfill({
    json: { session: { id: session }, user: { name: "Investor", email: "investor@example.test" } },
  }));
  await page.goto("/dashboard/accounts");
  await expect(page.getByRole("complementary", { name: "Workspace navigation" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Open sidebar menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Dashboard" }).getByRole("link", { name: "Settings" }).click();
  const name = page.getByLabel("Full name");
  await name.fill("Unsaved profile edit");
  await page.getByLabel("New password", {exact: true}).fill("temporary example passphrase");
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toMatch(/Unsaved profile edit|temporary example passphrase/);
  await page.goBack();
  await expect(page).toHaveURL(/dashboard\/accounts/);
  await page.goForward();
  await expect(name).toHaveValue("Unsaved profile edit");
  await expect(page.getByLabel("New password", {exact:true})).toHaveValue("");
  await page.goBack();
  session = "new-session";
  await page.goForward();
  await expect(name).toHaveValue("Investor");
  await name.fill("Discard me");
  await page.getByRole("link", {name:"Manage subscription"}).click();
  await page.getByRole("button", {name:"Discard changes and leave"}).click();
  await expect(page).toHaveURL(/\/billing$/);
  await page.goBack();
  await expect(name).toHaveValue("Investor");
});

test("a fee-bearing sale reconciles across Calculations and Reports, including legacy evidence", async ({ page }) => {
  const { state } = await workspace(page, [
    { ...purchase, quantity: "1", considerationGBP: "60", feesGBP: "2" },
    { ...sale, considerationGBP: "100", feesGBP: "5" },
  ], true);
  await page.route("**/api/v2/billing", (route) =>
    route.fulfill({ json: { status: "active", entitled: true } }),
  );
  await page.goto("/dashboard/calculations?year=2024-25");
  const amounts = [
    ["Gross disposal proceeds", "£100.00"], ["Selling costs", "£5.00"],
    ["Net sale proceeds", "£95.00"], ["Matched acquisition cost", "£62.00"],
    ["Total allowable costs", "£67.00"],
  ] as const;
  for (const [label, amount] of amounts) {
    await expect(page.getByText(label, { exact: true }).first().locator("..").locator("dd")).toHaveText(amount);
  }
  await page.getByRole("link", { name: "View reports for 2024-25" }).click();
  const summary = page.getByRole("region", { name: "Calculation summary" });
  await expect(summary).toContainText("Net gain £33.00");
  for (const [label, amount] of amounts) {
    await expect(summary.getByText(label, { exact: true }).locator("..").locator("dd")).toHaveText(amount);
  }
  const legacy = state.calculations[0]!.result;
  delete legacy.saleBreakdown;
  for (const disposal of legacy.disposals) delete disposal.saleBreakdown;
  await page.reload();
  await expect(summary).toContainText("Recalculate this year to include them.");
  await expect(summary.getByText("Selling costs", { exact: true }).locator("..").locator("dd")).toHaveText("Unavailable");
  await expect(summary).toContainText("Net gain £33.00");
});

test("a grouped disposal opens both sales and the matched purchase at their broker receipt rows", async ({ page }) => {
  const receipt = "70a556e2-626e-4e98-93eb-b0fc68bd3cbe";
  const trades = [
    { ...purchase, id: "a".repeat(64), date: sale.date },
    { ...sale, id: "b".repeat(64) },
    { ...sale, id: "c".repeat(64) },
  ];
  await workspace(page, trades, true);
  await page.route("**/api/v2/workspace", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "disposal-sources") {
      expect(new Set(body.keys)).toEqual(new Set(trades.map((t) => t.id)));
      return route.fulfill({ json: trades.map((t, i) => ({
        key: t.id, label: "Synthetic broker", broker: "hl", record: 27 + i,
        instrument: "Synthetic ordinary share", reference: "trade-" + i,
        statementReference: "note-" + i, importReference: receipt,
      })) });
    }
    if (body.action === "import-detail") {
      expect(body.record).toBe(28);
      expect(body.importId).toBe(receipt);
      return route.fulfill({ json: { records: [{ record: 28, status: "accepted", reason: "Included sale" }], legacy: false, page: 2, pageSize: 25, total: 28 } });
    }
    return route.fallback();
  });
  await page.goto("/dashboard/calculations?year=2024-25");
  const detail = page.locator("details:visible").filter({ has: page.locator("summary", { hasText: sale.securityId }) }).first();
  await detail.locator("summary").click();
  await expect(detail.getByText("Matched purchase", { exact: true })).toBeVisible();
  await expect(detail.getByText("Sale", { exact: true })).toHaveCount(2);
  await expect(detail).toContainText("Synthetic ordinary share");
  await expect(detail).toContainText("Statement note-1");
  await detail.getByRole("link", { name: /record 28$/ }).click();
  await expect(page.getByRole("heading", { name: "Import receipt" })).toBeVisible();
  await expect(page.locator("#receipt-record-28")).toBeFocused();
  await expect(page.getByRole("link", { name: "Back to calculation" })).toHaveAttribute("href", "/dashboard/calculations?year=2024-25");
});
