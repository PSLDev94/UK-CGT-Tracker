import { reportCsv } from "../src/domain/reports/report";
import { reportPdf } from "../src/domain/reports/pdf";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { reviewCsv, tradesFromReview } from "../src/domain/imports/review";
import { calculateGains } from "../src/domain/cgt/calculate";
import type { Overview, Preview } from "../src/ui/workspace-types";

test("billing keeps test status explicit and recovers from interrupted requests", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/v2/billing", async (route) => {
    if (fail) {
      fail = false;
      return route.abort();
    }
    return route.fulfill({
      json: {
        status: "none",
        entitled: false,
        periodEnd: null,
        cancelAtPeriodEnd: false,
        needsReview: false,
        canManage: false,
        testMode: true,
      },
    });
  });
  await page.goto("/billing?checkout=returned");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Billing could not be confirmed",
  );
  await expect(
    page.getByText("Test payment confirmed.", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh billing status" }).click();
  await expect(
    page.getByRole("heading", { name: "No subscription", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open test checkout" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("billing shows cancellation and prevents duplicate checkout while a request is pending", async ({
  page,
}) => {
  let calls = 0;
  let release: (() => void) | undefined;
  await page.route("**/api/v2/billing", async (route) => {
    const { action } = route.request().postDataJSON();
    if (action === "checkout") {
      calls++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return route.fulfill({
        status: 409,
        json: {
          error: {
            message:
              "Manage your existing subscription instead of starting another one.",
          },
        },
      });
    }
    return route.fulfill({
      json: {
        status: calls ? "active" : "none",
        entitled: !!calls,
        periodEnd: calls ? "2027-11-16T12:00:00Z" : null,
        cancelAtPeriodEnd: !!calls,
        needsReview: false,
        canManage: !!calls,
        testMode: true,
      },
    });
  });
  await page.goto("/billing");
  await page.getByRole("button", { name: "Open test checkout" }).click();
  await expect(
    page.getByRole("button", { name: "Open test checkout" }),
  ).toBeDisabled();
  release?.();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Manage your existing subscription",
  );
  await page.getByRole("button", { name: "Refresh billing status" }).click();
  await expect(
    page.getByText("Scheduled to end 16 November 2027."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open test checkout" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Manage subscription" }),
  ).toBeEnabled();
  expect(calls).toBe(1);
});

const csv = readFileSync("tests/fixtures/canonical-trades.csv", "utf8");
const accountId = "10000000-0000-4000-8000-000000000001";
const draftId = "20000000-0000-4000-8000-000000000001";
const file = {
  name: "sample-trades.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(csv),
};

async function mockWorkspace(
  page: Page,
  options: { account?: boolean; conflict?: boolean; expired?: boolean } = {},
) {
  const calls: string[] = [];
  const state: Overview = {
    portfolio: {
      id: "30000000-0000-4000-8000-000000000001",
      name: "Personal investments",
      revision: 0,
    },
    accounts: options.account
      ? [
          {
            id: accountId,
            broker: "trading212",
            label: "My Invest",
            account_type: "GIA",
          },
        ]
      : [],
    imports: [],
    drafts: [],
    calculations: [],
  };
  let currentPreview: Preview | null = null;
  let currentCsv = "";
  let currentDetails: import("../src/domain/imports/supporting-details").ImportDetails =
    {};
  let ordinaryConfirmed = false;
  let conflict = !!options.conflict;
  await page.route("**/api/v2/auth/**", (route) =>
    route.fulfill({
      json: { user: { name: "Test investor", emailVerified: true } },
    }),
  );
  await page.route("**/api/v2/workspace", async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body.action);
    if (options.expired)
      return route.fulfill({
        status: 401,
        json: {
          error: {
            code: "SIGN_IN_REQUIRED",
            message: "Sign in again to continue.",
          },
        },
      });
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
      case "add-account":
        state.accounts.push({
          id: accountId,
          broker: body.broker,
          label: body.label,
          account_type: "GIA",
        });
        return route.fulfill({ status: 201, json: state.accounts[0] });
      case "prepare-import": {
        currentCsv = body.csv;
        currentDetails = {};
        ordinaryConfirmed = body.ordinarySharesConfirmed;
        const review = reviewCsv(body.csv, {
          broker: state.accounts[0]!
            .broker as import("../src/domain/imports/brokers").BrokerId,
          accountId,
          accountType: "GIA",
          format: body.format,
          ordinarySharesConfirmed: body.ordinarySharesConfirmed,
        });
        currentPreview = {
          draftId,
          accountId,
          revision: state.portfolio.revision,
          review: {
            ...review,
            page: 1,
            pageSize: 100,
            issueCount: review.issues.length,
          },
        };
        state.drafts = [
          {
            id: draftId,
            account_id: accountId,
            expires_at: "2027-01-01T12:00:00Z",
          },
        ];
        return route.fulfill({ status: 201, json: currentPreview });
      }
      case "supply-import-details": {
        currentDetails[String(body.record)] = body.details;
        const review = reviewCsv(currentCsv, {
          broker: state.accounts[0]!
            .broker as import("../src/domain/imports/brokers").BrokerId,
          accountId,
          accountType: "GIA",
          format: "native",
          ordinarySharesConfirmed: ordinaryConfirmed,
          supportingDetails: currentDetails,
        });
        currentPreview = {
          ...currentPreview!,
          reviewVersion: (currentPreview?.reviewVersion ?? 0) + 1,
          review: {
            ...review,
            page: 1,
            pageSize: 100,
            issueCount: review.issues.length,
          },
        };
        return route.fulfill({ json: currentPreview });
      }
      case "review-import":
        return route.fulfill({ json: currentPreview });
      case "discard-draft":
        state.drafts = [];
        return route.fulfill({ json: { discarded: true } });
      case "commit-import":
        if (conflict) {
          conflict = false;
          state.portfolio.revision++;
          return route.fulfill({
            status: 409,
            json: {
              ...currentPreview,
              revision: state.portfolio.revision,
              outcome: "review_changed",
            },
          });
        }
        state.imports = [
          {
            id: draftId,
            account_id: accountId,
            status: "committed",
            record_count: 3,
            accepted_count: 2,
            excluded_count: 1,
            duplicate_count: 0,
            created_at: "2026-11-16T12:00:00Z",
          },
        ];
        state.drafts = [];
        return route.fulfill({
          json: { outcome: "committed", importId: draftId },
        });
      case "calculate": {
        const result = calculateGains(
          tradesFromReview(
            reviewCsv(csv, {
              broker: "trading212",
              accountId,
              accountType: "GIA",
              format: "canonical-v1",
            }),
          ),
          { taxYear: "2024-25", historyThrough: body.historyThrough },
        );
        state.calculations = [
          {
            id: "result-1",
            tax_year: "2024-25",
            result,
            coverage_confirmed: body.confirmedAccountIds.includes(accountId),
          },
        ];
        return route.fulfill({ json: { runId: "result-1", result } });
      }
      case "reverse-import":
        state.imports[0]!.status = "reversed";
        state.imports[0]!.reversal_reason = body.reason;
        state.calculations = [];
        return route.fulfill({
          json: { status: "reversed", importId: draftId },
        });
      default:
        return route.fulfill({
          status: 400,
          json: { error: { message: "Unexpected test action" } },
        });
    }
  });
  return { calls, state };
}

async function uploadTemplate(page: Page) {
  await navigateWorkspace(page, "Upload CSV");
  await page
    .getByLabel("Broker account", { exact: true })
    .selectOption(accountId);
  await page.getByLabel("File format").selectOption("canonical-v1");
  await page.getByLabel("CSV file", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Review file", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review before saving" }),
  ).toBeVisible();
}

async function navigateWorkspace(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible()))
    await page.getByRole("button", { name: "Open sidebar menu" }).click();
  await button.click();
}

test("home and broker support are honest, responsive and accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Calculate your Capital Gains Tax",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: ".private/screenshots/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".private/screenshots/home-mobile.png",
    fullPage: true,
  });
  await page.goto("/supported-brokers");
  await expect(
    page.getByText("Assisted import", { exact: true }),
  ).toHaveCount(3);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download CSV template" }).click();
  expect((await download).suggestedFilename()).toBe("cgt-trades.csv");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("auth validation, password reveal and neutral verification feedback", async ({
  page,
}) => {
  await page.route("**/api/v2/auth/sign-up/email", (route) =>
    route.fulfill({ json: { user: {} } }),
  );
  await page.goto("/account/sign-up");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByLabel("Your name")).toBeFocused();
  await expect(page.getByLabel("Your name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Your name").fill("Test investor");
  await page.getByLabel("Email address").fill("investor@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("A long test password 123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("A long test password 123!");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("account → review → conflict → commit → calculate → reverse", async ({
  page,
}) => {
  const { calls } = await mockWorkspace(page, { conflict: true });
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", {
      name: "Start with your first broker account.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await expect(page.getByLabel("Broker", { exact: true })).toBeFocused();
  await page.getByLabel("Broker", { exact: true }).selectOption("trading212");
  await page.getByLabel("Account name", { exact: true }).fill("My Invest");
  await page.getByRole("checkbox", { name: /This is a taxable/ }).check();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await navigateWorkspace(page, "Broker accounts");
  await expect(page.getByLabel("Portfolio summary")).toContainText(
    "Taxable accounts1",
  );
  await page.screenshot({
    path: ".private/screenshots/accounts-desktop.png",
    fullPage: true,
  });
  await uploadTemplate(page);
  await expect(
    page.getByRole("cell", { name: "Excluded", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save 2 transactions" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "The review changed" }),
  ).toBeVisible();
  expect(calls.filter((action) => action === "commit-import")).toHaveLength(1);
  await page.screenshot({
    path: ".private/screenshots/review-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save 2 transactions" }).click();
  await expect(
    page.getByRole("heading", { name: "Review before saving" }),
  ).not.toBeVisible();
  await navigateWorkspace(page, "Tax Overview");
  await page.getByLabel("Tax year", { exact: true }).selectOption("2024-25");
  await page.getByLabel("History complete through").fill("2025-05-05");
  await page.getByRole("checkbox", { name: "My Invest", exact: true }).check();
  await page
    .getByRole("button", { name: "Calculate gains", exact: true })
    .click();
  await expect(
    page.locator(".net-gain").getByText("£391.00", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("2024-09-01 · US0378331005 · £391.00", { exact: true })
    .click();
  await expect(page.getByText(/Section 104 pool: 50 shares/)).toBeVisible();
  await page.screenshot({
    path: ".private/screenshots/calculation-desktop.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await navigateWorkspace(page, "Import history");
  await page
    .getByRole("button", { name: "Reverse import", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Reverse this import?" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reverse import", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Reverse import", exact: true })
    .click();
  await dialog.getByLabel("Reason for reversing").fill("Corrected export");
  await dialog
    .getByRole("button", { name: "Reverse import", exact: true })
    .click();
  await expect(page.getByText("Reversed", { exact: true })).toBeVisible();
  await navigateWorkspace(page, "Tax Overview");
  await expect(
    page.getByRole("heading", { name: "2024-25 share gains" }),
  ).not.toBeVisible();
});

test("unsupported files cannot be saved and can be discarded", async ({
  page,
}) => {
  await mockWorkspace(page, { account: true });
  await page.goto("/workspace");
  await navigateWorkspace(page, "Upload CSV");
  await page
    .getByLabel("Broker account", { exact: true })
    .selectOption(accountId);
  await page.getByLabel("CSV file", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Review file", exact: true }).click();
  await expect(
    page.getByText("This format is not verified.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Save \d+ transactions/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Discard preview" }).click();
  await expect(
    page.getByRole("heading", { name: "Review before saving" }),
  ).not.toBeVisible();
});

test("narrow workspace, keyboard, unsaved navigation and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockWorkspace(page, { account: true });
  await page.goto("/workspace");
  await navigateWorkspace(page, "Upload CSV");
  const broker = page.getByLabel("Broker account", { exact: true });
  await broker.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await page.keyboard.press("m");
  await page.keyboard.press("Tab");
  await expect(broker).toHaveValue(accountId);
  await page.getByLabel("CSV file", { exact: true }).setInputFiles(file);
  if (
    !(await page
      .getByRole("link", { name: "Broker support", exact: true })
      .isVisible())
  )
    await page.getByRole("button", { name: "Open sidebar menu" }).click();
  await page.getByRole("link", { name: "Broker support", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Leave this workspace?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay here" }).click();
  await expect(
    page.getByText("Selected: sample-trades.csv", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollbarColor,
    ),
  ).not.toBe("auto");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: ".private/screenshots/workspace-mobile.png",
    fullPage: true,
  });
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  if (
    !(await page
      .getByRole("link", { name: "Broker support", exact: true })
      .isVisible())
  )
    await page.getByRole("button", { name: "Open sidebar menu" }).click();
  await page.getByRole("link", { name: "Broker support", exact: true }).click();
  await page
    .getByRole("button", { name: "Leave workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/supported-brokers$/);
  expect(nativeDialogs).toEqual([]);
});

test("interrupted upload retains the file; pending retry prevents duplicate submission", async ({
  page,
}) => {
  const { calls } = await mockWorkspace(page, { account: true });
  let interrupted = false;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v2/workspace", async (route) => {
    if (route.request().postDataJSON().action !== "prepare-import")
      return route.fallback();
    if (!interrupted) {
      interrupted = true;
      return route.abort("connectionreset");
    }
    await pending;
    return route.fallback();
  });
  await page.goto("/workspace");
  await navigateWorkspace(page, "Upload CSV");
  await page
    .getByLabel("Broker account", { exact: true })
    .selectOption(accountId);
  await page.getByLabel("File format").selectOption("canonical-v1");
  await page.getByLabel("CSV file", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Review file", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "connection was interrupted" }),
  ).toBeVisible();
  await expect(
    page.getByText("Selected: sample-trades.csv", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review file", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reviewing…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Broker accounts", exact: true }),
  ).toBeDisabled();
  release!();
  await expect(
    page.getByRole("heading", { name: "Review before saving" }),
  ).toBeVisible();
  expect(calls.filter((action) => action === "prepare-import")).toHaveLength(1);
});

test("session expiry and setup failures leave recoverable pages", async ({
  page,
}) => {
  await mockWorkspace(page, { expired: true });
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace." }),
  ).toBeVisible();
  await page.unroute("**/api/v2/auth/**");
  await page.route("**/api/v2/auth/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "The new workspace is not available yet." } },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "The workspace is not available yet." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
});

test("native import requires classification and shows incomplete-history guidance", async ({
  page,
}) => {
  await mockWorkspace(page, { account: true });
  await page.goto("/workspace");
  await navigateWorkspace(page, "Upload CSV");
  await page
    .getByLabel("Broker account", { exact: true })
    .selectOption(accountId);
  await page
    .getByLabel("CSV file", { exact: true })
    .setInputFiles("tests/fixtures/brokers/trading212-gbp.csv");
  await expect(page.getByText(/Freetrade exports can omit them/)).toBeVisible();
  await page.getByRole("button", { name: "Review file", exact: true }).click();
  await expect(
    page.getByText(/Confirm that every traded instrument/).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save 2 transactions" }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: /For a native broker export/ })
    .check();
  await page
    .getByLabel("CSV file", { exact: true })
    .setInputFiles("tests/fixtures/brokers/trading212-gbp.csv");
  await expect(
    page.getByRole("checkbox", { name: /For a native broker export/ }),
  ).not.toBeChecked();
  await page
    .getByRole("checkbox", { name: /For a native broker export/ })
    .check();
  await page.getByRole("button", { name: "Review file", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save 2 transactions" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("checkbox", { name: /For a native broker export/ }),
  ).not.toBeChecked();
  // The upload form can point elsewhere while an existing draft is resumed.
  // The confirmation must retain the account bound by the server to that draft.
  await page.getByLabel("Broker account", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Open preview", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Review before saving", exact: true }),
  ).toContainText("Saving to: My Invest");
  await page.screenshot({
    path: ".private/screenshots/native-import-preview.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

const restoredPublicRoutes = [
  "/pricing",
  "/contact",
  "/guide",
  "/guide/section-104-pool",
  "/guide/bed-and-breakfast-rule",
  "/guide/cgt-rates-2025-26",
  "/guide/sa108-how-to-fill-in",
  "/guide/trading-212-cgt",
  "/guide/freetrade-cgt",
  "/guide/hargreaves-lansdown-cgt",
  "/tools/bed-and-breakfast-calculator",
  "/tools/section-104-calculator",
  "/tools/cgt-allowance-checker",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];
for (const url of restoredPublicRoutes)
  test(`restored ${url} is accessible at mobile width`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });

test("restored tools handle band boundaries, oversells and same-day matching", async ({
  page,
}) => {
  await page.goto("/tools/cgt-allowance-checker");
  await page.getByLabel("Total gains so far").fill("10000");
  await page.getByLabel("Total losses so far").fill("1000");
  await page.getByLabel("Taxable income after").fill("36700");
  await expect(page.getByText("£1,380.00", { exact: true })).toBeVisible();
  await page.getByLabel("Taxable income after").fill("-1");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "non-negative",
  );
  await expect(page.getByText("£1,380.00", { exact: true })).toHaveCount(0);
  await page.goto("/tools/section-104-calculator");
  await page.getByLabel("Quantity — purchase 1").fill("100");
  await page.getByLabel("Price/share (£) — purchase 1").fill("3");
  await page.getByLabel("Fees (£) — purchase 1").fill("5");
  await page.getByLabel("Quantity to sell").fill("50");
  await page.getByLabel("Sale price per share").fill("4");
  await expect(
    page.getByText("£152.50", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Quantity to sell").fill("101");
  await expect(
    page.getByRole("heading", { name: "Disposal Result" }),
  ).toHaveCount(0);
  await page.goto("/tools/bed-and-breakfast-calculator");
  await page.locator('input[type="date"]').nth(0).fill("2025-03-01");
  await page.locator('input[type="date"]').nth(1).fill("2025-03-31");
  const numbers = page.locator('input[type="number"]');
  for (const [index, value] of ["100", "4", "50", "3"].entries())
    await numbers.nth(index).fill(value);
  await page.getByRole("button", { name: "Check B&B Rule" }).click();
  await expect(
    page.getByRole("heading", { name: /B&B Rule Triggered — 30 days/ }),
  ).toBeVisible();
  await expect(page.getByText("+£50.00", { exact: true })).toBeVisible();
  await page.locator('input[type="date"]').nth(1).fill("2025-03-01");
  await page.getByRole("button", { name: "Check B&B Rule" }).click();
  await expect(
    page.getByRole("heading", { name: /Same-day matching takes priority/ }),
  ).toBeVisible();
});

test("restored reports export saved evidence and settings retain edits after failure", async ({
  page,
}) => {
  const { state } = await mockWorkspace(page, { account: true });
  const result = calculateGains(
    tradesFromReview(
      reviewCsv(csv, {
        broker: "trading212",
        accountId,
        accountType: "GIA",
        format: "canonical-v1",
      }),
    ),
    { taxYear: "2024-25", historyThrough: "2025-05-05" },
  );
  state.calculations = [
    { id: "saved", tax_year: "2024-25", result, coverage_confirmed: true },
  ];
  await page.route("**/api/v2/reports", async (route) => {
    const input = route.request().postDataJSON();
    expect(input.runId).toBe("saved");
    const snapshot = {
      id: "saved",
      input_digest: "synthetic-digest",
      created_at: "2026-11-17T12:00:00Z",
      coverage_confirmed: true,
      result,
    };
    return route.fulfill({
      contentType: input.kind === "csv" ? "text/csv" : "application/pdf",
      body:
        input.kind === "csv"
          ? reportCsv(snapshot)
          : Buffer.from(await reportPdf(snapshot, input.kind === "evidence")),
    });
  });
  await page.goto("/dashboard/reports");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV evidence" }).click();
  const download = await downloaded;
  const content = readFileSync((await download.path())!, "utf8");
  expect(content).toContain("Not a tax return or personal tax liability");
  expect(content).toContain("2024-25");
  expect(content).toContain(result.disposals[0]!.securityId);
  const pdfDownloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download PDF", exact: true })
    .first()
    .click();
  expect((await pdfDownloaded).suggestedFilename()).toBe(
    "CGT-summary-2024-25.pdf",
  );
  await page.route("**/api/v2/reports", (route) =>
    route.fulfill({
      status: 402,
      json: {
        error: {
          message: "An active subscription is required for PDF reports.",
        },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Download PDF", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: "View subscription" }),
  ).toBeVisible();
  await page.goto("/dashboard/tax-loss-harvesting");
  await expect(page.getByText(/Snapshot at/)).toBeVisible();
  const price = page.getByLabel(
    `Current price for ${result.pools[0]!.securityId}`,
  );
  await price.fill("1");
  await expect(
    page.getByRole("heading", { name: "Illustrative Holding Scenarios" }),
  ).toBeVisible();
  await price.fill("-1");
  await expect(price).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("heading", { name: "Illustrative Holding Scenarios" }),
  ).toHaveCount(0);
  await expect(page.getByText(/not model a disposal/)).toBeVisible();
  let calls = 0;
  await page.route("**/api/v2/auth/update-user", (route) => {
    calls++;
    return route.fulfill({
      status: calls === 1 ? 500 : 200,
      json: calls === 1 ? { message: "Please try again." } : { status: true },
    });
  });
  await page.goto("/dashboard/settings");
  await page.getByLabel("Full name").fill("Updated investor");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Updated investor");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Profile updated successfully",
  );
  expect(calls).toBe(2);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const url of [
    "/dashboard/reports",
    "/dashboard/settings",
    "/dashboard/tax-loss-harvesting",
    "/dashboard/contact",
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});

test("original menus restore keyboard focus on Escape", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Free Tools" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: /B&B Rule Calculator Check/ })
    .focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Free Tools" })).toBeFocused();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open menu", exact: true }),
  ).toBeFocused();
});

test("assisted HL import preserves source evidence, validates details and enables an explicit commit", async ({
  page,
}) => {
  const { state, calls } = await mockWorkspace(page, { account: true });
  state.accounts[0]!.broker = "hl";
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard/upload");
  await page
    .getByLabel("Broker account", { exact: true })
    .selectOption(accountId);
  await page
    .getByLabel("CSV file", { exact: true })
    .setInputFiles("tests/fixtures/brokers/hl-contract-note-required.csv");
  await page
    .getByRole("checkbox", { name: /For a native broker export/ })
    .check();
  await page.getByRole("button", { name: "Review file", exact: true }).click();
  await page
    .getByText(/Supply or review supporting details for record/)
    .click();
  await page
    .getByRole("button", { name: "Check and save supporting details" })
    .click();
  await expect(page.getByLabel("Verified ISIN", { exact: true })).toBeFocused();
  await page.getByLabel("Verified ISIN", { exact: true }).fill("GB0008706128");
  await page.getByLabel("Trade currency", { exact: true }).fill("GBP");
  await page.getByLabel("GBP per currency unit", { exact: true }).fill("1");
  await page
    .getByLabel("Price units in the export", { exact: true })
    .selectOption("minor");
  await page
    .getByLabel("Dealing fees and transaction taxes", { exact: true })
    .fill("14.45");
  await page
    .getByLabel("Supporting statement or contract-note reference", {
      exact: true,
    })
    .fill("Synthetic contract note B900000001");
  await page.getByRole("checkbox", { name: /I checked the currency/ }).check();
  await page
    .getByRole("button", { name: "Check and save supporting details" })
    .click();
  await expect(
    page.getByRole("button", { name: "Save 1 transactions" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".private/screenshots/assisted-hl-review.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save 1 transactions" }).click();
  expect(calls).toContain("supply-import-details");
  expect(calls).toContain("commit-import");
});

test("contact sends through the service, preserves failed input and retries with the same reference", async ({
  page,
}) => {
  const bodies: { requestId: string }[] = [];
  await page.route("**/api/v2/contact", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({
      status: bodies.length === 1 ? 503 : 200,
      json:
        bodies.length === 1
          ? { error: { message: "Temporary delivery problem. Try again." } }
          : { accepted: true },
    });
  });
  await page.goto("/contact");
  await page.getByLabel("Full Name", { exact: true }).fill("Synthetic test");
  await page
    .getByLabel("Email Address", { exact: true })
    .fill("synthetic@example.test");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Synthetic support test without external delivery.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator("#contact-error")).toContainText(
    "Temporary delivery problem",
  );
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Synthetic support test without external delivery.",
  );
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("heading", { name: "Message Accepted" }),
  ).toBeVisible();
  expect(bodies[0]!.requestId).toBe(bodies[1]!.requestId);
});

test("HTML has fresh script nonces and blocks injected inline script", async ({
  page,
}) => {
  await page.route('http://127.0.0.1:3200/', async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace('</body>', '<script>window.__cgtInjected = true</script></body>');
    await route.fulfill({ response, body: html });
  });
  const response = await page.goto("/");
  const policy = response!.headers()["content-security-policy"]!;
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).not.toContain("'unsafe-eval'");
  const first = policy.match(/'nonce-([^']+)'/)![1];
  expect(
    await page.evaluate(() => Object.hasOwn(window, "__cgtInjected")),
  ).toBe(false);
  const second = await page.reload();
  expect(second!.headers()["content-security-policy"]).not.toContain(
    `nonce-${first}`,
  );
  await page
    .getByRole("link", { name: "Log in", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: /Sign in to your account/i }),
  ).toBeVisible();
});
