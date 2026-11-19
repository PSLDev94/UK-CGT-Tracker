import { test, expect } from "@playwright/test";

test("the support form waits for its handler and preserves the message on the first submit", async ({
  page,
}) => {
  let release!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route("**/_next/**/*.js*", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  await page.route("**/api/v2/contact", (route) => {
    posts++;
    return route.fulfill({ json: { accepted: true } });
  });
  try {
    await page.goto("/contact", { waitUntil: "commit" });
    await expect(page.locator("#contact-message")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
    await expect(
      page.locator('form a[href="mailto:support@cgttracker.com"]'),
    ).toBeVisible();
  } finally {
    release();
  }
  await page.locator("#contact-name").fill("Support fixture");
  await page.locator("#contact-email").fill("fixture@example.test");
  await page
    .locator("#contact-message")
    .fill("Synthetic verified support message.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("heading", { name: "Message Accepted" }),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("the broker directory retains the year and the selected account on the upload link", async ({
  page,
}) => {
  const from = new URLSearchParams({
    from: "/dashboard/upload?year=2024-25&account=fixture-account",
  });
  await page.goto("/supported-brokers?" + from);
  const href = await page
    .getByRole("link", { name: "Upload a Trading 212 CSV" })
    .getAttribute("href");
  const url = new URL(href!, "https://example.test");
  expect(url.pathname).toBe("/dashboard/upload");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    year: "2024-25",
    account: "fixture-account",
    broker: "trading212",
  });
});
