import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test.describe(`public calculators at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    test("changing either trade invalidates its previous match", async ({
      page,
    }) => {
      await page.goto("/tools/bed-and-breakfast-calculator");
      const check = page.getByRole("button", { name: "Check B&B Rule" });
      await check.click();
      await expect(page.getByLabel("Date of sale")).toBeFocused();
      await expect(page.getByLabel("Date of sale")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await page.getByLabel("Date of sale").fill("2025-07-01");
      await page.getByLabel("Shares sold").fill("100");
      await page.getByLabel("Sale price per share").fill("5");
      await page.getByLabel("Date of repurchase").fill("2025-07-15");
      await page.getByLabel("Shares repurchased").fill("100");
      await page.getByLabel("Repurchase price per share").fill("4");
      await check.click();
      await expect(
        page.getByRole("heading", { name: /14 days between/ }),
      ).toBeVisible();
      await page.getByLabel("Date of repurchase").fill("2025-09-01");
      await expect(
        page.getByRole("heading", { name: /14 days between/ }),
      ).toHaveCount(0);
      await expect(page.getByRole("status")).toContainText("Details changed");
      await check.click();
      await expect(
        page.getByRole("heading", { name: /62 days apart/ }),
      ).toBeVisible();
    });

    test("a partial purchase cannot produce a final pool or disposal", async ({
      page,
    }) => {
      await page.goto("/tools/section-104-calculator");
      const summary = page.getByRole("heading", { name: "Pool Summary" });
      await page.getByLabel("Quantity — purchase 1").fill("100");
      await page.getByLabel("Price/share (£) — purchase 1").fill("3.50");
      await expect(summary).toBeVisible();
      await page.getByRole("button", { name: "Add purchase" }).click();
      await expect(page.getByLabel("Quantity — purchase 2")).toBeFocused();
      await expect(summary).toBeVisible();
      await page.getByLabel("Quantity — purchase 2").fill("100");
      await expect(summary).toHaveCount(0);
      await expect(page.getByRole("status")).toContainText(
        "Purchase 2 needs a valid price",
      );
      await page.getByLabel("Quantity to sell").fill("10");
      await page.getByLabel("Sale price per share").fill("5");
      await expect(
        page.getByRole("heading", { name: "Disposal Result" }),
      ).toHaveCount(0);
      await page.getByLabel("Price/share (£) — purchase 2").fill("5.50");
      await expect(summary).toBeVisible();
      await expect(
        page.getByText("£900.00", { exact: true }).first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "Remove purchase 2" }).click();
      await expect(page.getByLabel("Quantity — purchase 1")).toBeFocused();
      await expect(
        page.getByText("£350.00", { exact: true }).first(),
      ).toBeVisible();
    });
  });
}

test("a visitor can follow broker-specific instructions, pricing and guide contents", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Check my broker" }),
  ).toHaveAttribute("href", "/supported-brokers");
  await page
    .getByRole("link", { name: /Interactive Brokers Execution Flex CSV/ })
    .click();
  await expect(page).toHaveURL(/supported-brokers#ibkr$/);
  await page.locator("article#ibkr summary").click();
  await expect(page.locator("article#ibkr")).toContainText("An EXECUTION row");
  await page.getByRole("link", { name: "View required Flex fields" }).click();
  await expect(page).toHaveURL(/#flex-fields$/);
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "Free workspace" }),
  ).toBeVisible();
  await expect(
    page.getByText("Download your calculation evidence as a CSV"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Annual PDF reports" }),
  ).toBeVisible();
  await page.goto("/guide/section-104-pool");
  await page.getByText("On this page", { exact: true }).click();
  await page
    .getByRole("link", { name: "Example 1: Building a Pool", exact: true })
    .click();
  await expect(page).toHaveURL(/#example-1-building-a-pool$/);
  await expect(
    page.getByRole("heading", {
      name: "Example 1: Building a Pool",
      exact: true,
    }),
  ).toBeInViewport();
});

test("fractional holdings stay visible until the last share is sold", async ({
  page,
}) => {
  await page.goto("/tools/section-104-calculator");
  await page.getByLabel("Quantity — purchase 1").fill("0.004");
  await page.getByLabel("Price/share (£) — purchase 1").fill("100");
  await expect(
    page.getByRole("cell", { name: "0.004", exact: true }),
  ).toHaveCount(2);
  await expect(page.getByText("0.004", { exact: true })).toHaveCount(3);
  await page.getByLabel("Quantity to sell").fill("0.001");
  await page.getByLabel("Sale price per share").fill("110");
  await expect(page.getByText("0.003 shares", { exact: true })).toBeVisible();
  await expect(page.getByText("£0.30 cost")).toBeVisible();
  await expect(page.getByText("+£0.01", { exact: true })).toBeVisible();
  await page.getByLabel("Quantity to sell").fill("0.004");
  await expect(page.getByText("0 shares", { exact: true })).toBeVisible();
  await expect(page.getByText("£0.00 cost")).toBeVisible();
});

test("a partial 30-day match identifies the proceeds covered and the sale quantity still to match", async ({
  page,
}) => {
  await page.goto("/tools/bed-and-breakfast-calculator");
  await page.getByLabel("Date of sale").fill("2025-07-01");
  await page.getByLabel("Shares sold").fill("100");
  await page.getByLabel("Sale price per share").fill("10");
  await page.getByLabel("Date of repurchase").fill("2025-07-31");
  await page.getByLabel("Shares repurchased").fill("20");
  await page.getByLabel("Repurchase price per share").fill("12");
  const check = page.getByRole("button", { name: "Check B&B Rule" });
  await check.click();
  await expect(
    page.getByText("Proceeds on matched shares").locator(".."),
  ).toContainText("£200.00");
  await expect(page.getByText("−£40.00", { exact: true })).toBeVisible();
  await expect(page.getByText(/remaining 80 shares sold/)).toBeVisible();
  await page.getByLabel("Shares repurchased").fill("100");
  await check.click();
  await expect(
    page.getByText("Proceeds on matched shares").locator(".."),
  ).toContainText("£1000.00");
  await expect(page.getByText(/remaining .* shares sold/)).toHaveCount(0);
});

test("the allowance checker and SA108 guide give the same qualified reporting rule", async ({
  page,
}) => {
  for (const url of [
    "/tools/cgt-allowance-checker",
    "/guide/sa108-how-to-fill-in",
  ]) {
    await page.goto(url);
    const article = page.locator(".guide-article");
    await expect(article).toContainText(
      /if you are registered for Self Assessment.*more than £50,000/,
    );
    await expect(article).toContainText(
      "£50,000 exactly is within that threshold. £50,001 crosses it.",
    );
    await expect(article).toContainText(
      "outside Self Assessment, this proceeds rule alone does not require you to register",
    );
    await expect(article).toContainText(
      "exceeded £3,000 before deducting losses",
    );
    await expect(
      article.getByRole("link", {
        name: "Read HMRC’s guidance on claiming losses",
      }),
    ).toHaveAttribute("href", "https://www.gov.uk/capital-gains-tax/losses");
    await expect(article).not.toContainText("£12,000");
  }
  await page.goto("/tools/cgt-allowance-checker");
  await expect(
    page.getByText(/Overseas Workday Relief for this year/),
  ).toBeVisible();
});

test("account callbacks and public pages have distinct titles, including Back and missing pages", async ({
  page,
}) => {
  for (const [url, title] of [
    ["/supported-brokers", "Supported brokers and CSV exports"],
    ["/terms", "Service terms"],
    ["/privacy", "Privacy and your data"],
    ["/account/sign-in?verification=complete", "Email verified · Sign in"],
    [
      "/account/sign-in?verification=complete&error=expired",
      "Verification link unavailable",
    ],
  ] as const) {
    await page.goto(url);
    await expect(page).toHaveTitle(title + " · CGT Tracker");
  }
  await page
    .getByRole("link", { name: "Request a new verification email" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveTitle("Verify your email · CGT Tracker");
  await page.goBack();
  await expect(page).toHaveTitle("Verification link unavailable · CGT Tracker");
  const response = await page.goto("/unavailable-page-for-title-test");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page unavailable · CGT Tracker");
});

for (const [tool, label] of [
  ["section-104-calculator", "Quantity — purchase 1"],
  ["bed-and-breakfast-calculator", "Shares sold"],
  ["cgt-allowance-checker", "Total gains for 2025–26"],
] as const) {
  test(`${tool} accepts the first edit only when the calculator is ready`, async ({
    page,
  }) => {
    let releaseScripts!: () => void;
    const scriptsPaused = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    await page.route("**/_next/static/**/*.js", async (route) => {
      await scriptsPaused;
      await route.continue();
    });
    const field = page.getByLabel(label);
    try {
      await page.goto(`/tools/${tool}`, { waitUntil: "commit" });
      await expect(field).toBeVisible();
      await expect(field).toBeDisabled();
    } finally {
      releaseScripts();
    }
    await expect(field).toBeEnabled();
    await field.fill("100");
    await field.press("Tab");
    await expect(field).toHaveValue("100");
  });
}
