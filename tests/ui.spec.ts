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
        const review = reviewCsv(body.csv, {
          broker: "trading212",
          accountId,
          accountType: "GIA",
          format: body.format,
        });
        currentPreview = {
          draftId,
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
  await page
    .getByRole("button", { name: "Import & review", exact: true })
    .click();
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

test("home and broker support are honest, responsive and accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Know how your",
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
    page.getByText("Native CSV verification pending", { exact: true }),
  ).toHaveCount(6);
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
  await page.getByRole("button", { name: "Share gains", exact: true }).click();
  await page.getByLabel("Tax year", { exact: true }).selectOption("2024-25");
  await page.getByLabel("History complete through").fill("2025-05-05");
  await page.getByRole("checkbox", { name: "My Invest", exact: true }).check();
  await page
    .getByRole("button", { name: "Calculate gains", exact: true })
    .click();
  await expect(
    page.getByText("Net gain: £391.00", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("2024-09-01 · US0378331005 · £391.00", { exact: true })
    .click();
  await expect(page.getByText(/Section 104 pool: 50 shares/)).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Import history", exact: true })
    .click();
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
  await page.getByRole("button", { name: "Share gains", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "2024-25 share gains" }),
  ).not.toBeVisible();
});

test("unsupported files cannot be saved and can be discarded", async ({
  page,
}) => {
  await mockWorkspace(page, { account: true });
  await page.goto("/workspace");
  await page
    .getByRole("button", { name: "Import & review", exact: true })
    .click();
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
  await page
    .getByRole("button", { name: "Import & review", exact: true })
    .click();
  const broker = page.getByLabel("Broker account", { exact: true });
  await broker.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await page.keyboard.press("m");
  await page.keyboard.press("Tab");
  await expect(broker).toHaveValue(accountId);
  await page.getByLabel("CSV file", { exact: true }).setInputFiles(file);
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
  await page
    .getByRole("button", { name: "Import & review", exact: true })
    .click();
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
