import { expect, test } from "@playwright/test";

test("the public pool sale reconciles fees, gains, losses and a penny rounding adjustment", async ({
  page,
}) => {
  await page.goto("/tools/section-104-calculator");
  await page.getByLabel("Quantity — purchase 1").fill("10");
  await page.getByLabel("Price/share (£) — purchase 1").fill("6");
  await page.getByLabel("Fees (£) — purchase 1").fill("2");
  await page.getByLabel("Quantity to sell").fill("10");
  const price = page.getByLabel("Sale price per share");
  const fee = page.getByLabel("Selling fees");
  const result = page.getByRole("group", { name: "Share disposal" });
  await price.fill("10");

  // A blank or explicit zero fee leaves the original illustration intact.
  await expect(result.getByText("+£38.00", { exact: true })).toBeVisible();
  await fee.fill("0");
  await expect(result.getByText("+£38.00", { exact: true })).toBeVisible();
  await fee.fill("5");
  await expect(result.locator("dt")).toHaveText([
    "Gross disposal proceeds",
    "Selling costs",
    "Net sale proceeds",
    "Matched acquisition cost",
    "Total allowable costs",
  ]);
  await expect(result.locator("dd")).toHaveText([
    "£100.00",
    "£5.00",
    "£95.00",
    "£62.00",
    "£67.00",
  ]);
  await expect(result.getByText("+£33.00", { exact: true })).toBeVisible();
  await expect(result.getByText("£0.00 cost")).toBeVisible();

  await price.fill("6");
  await expect(result.getByText("Loss", { exact: true })).toBeVisible();
  await expect(result.getByText("−£7.00", { exact: true })).toBeVisible();
  await price.fill("6.7");
  await expect(result.getByText("Break-even", { exact: true })).toBeVisible();
  await expect(result.getByText("£0.00", { exact: true })).toBeVisible();

  await price.fill("0");
  await expect(result.locator("dd")).toHaveText([
    "£0.00",
    "£5.00",
    "−£5.00",
    "£62.00",
    "£67.00",
  ]);
  await expect(result.getByText("−£67.00", { exact: true })).toBeVisible();
  for (const invalidFee of ["-1", "five", "0.123456789"]) {
    await fee.fill(invalidFee);
    await expect(fee).toHaveAttribute("aria-invalid", "true");
    await expect(fee).toHaveAccessibleDescription(
      /Enter selling fees of zero or more/,
    );
    await expect(
      result.getByRole("heading", { name: "Disposal Result" }),
    ).toHaveCount(0);
  }
  await fee.fill("0.005");
  await price.fill("6.2505");
  await expect(result.locator("dd")).toHaveText([
    "£62.51",
    "£0.01",
    "£62.50",
    "£62.00",
    "£62.01",
  ]);
  await expect(result.getByText("+£0.50", { exact: true })).toBeVisible();
  await price.fill("6.2504");
  await expect(
    result.getByText(/£0.01 adjustment to net sale proceeds/),
  ).toBeVisible();
});

test("the allowance is available before income and distinguishes a loss, full allowance and taxable gain", async ({
  page,
}) => {
  await page.goto("/tools/cgt-allowance-checker");
  const gains = page.getByLabel("Total gains for 2025–26");
  const losses = page.getByLabel("Total allowable losses for 2025–26");
  const income = page.getByLabel("Taxable income after");
  const result = page.getByRole("group", { name: "Allowance calculation" });
  const card = (label: string) =>
    result.getByText(label, { exact: true }).locator("..");
  await gains.fill("1000");
  await expect(card("Exemption Remaining")).toContainText("£2,000.00");
  await expect(card("Estimated Tax Owed")).toContainText("£0.00");
  await expect(income).toHaveCount(0);

  await gains.fill("500");
  await losses.fill("900");
  await expect(card("Net loss")).toContainText("−£400.00");
  await expect(card("Taxable Gain")).toContainText("£0.00");
  await expect(card("Exemption Remaining")).toContainText("£3,000.00");
  await expect(
    result.getByText("0% of allowance used", { exact: true }),
  ).toBeVisible();
  await expect(
    result.getByRole("link", { name: "How to claim an allowable loss" }),
  ).toHaveAttribute("href", "https://www.gov.uk/capital-gains-tax/losses");
  await gains.fill("900");
  await expect(card("Break-even")).toContainText("£0.00");

  await losses.fill("0");
  await gains.fill("2999.99");
  await expect(result.getByText("Approaching allowance limit")).toBeVisible();
  await expect(result.getByText("99% of allowance used")).toBeVisible();
  await expect(card("Exemption Remaining")).toContainText("£0.01");
  await expect(income).toHaveCount(0);
  await gains.fill("3000.00");
  await expect(result.getByText("Allowance fully used")).toBeVisible();
  await expect(card("Taxable Gain")).toContainText("£0.00");

  await gains.fill("3000.01");
  await expect(result.getByText(/Over allowance/)).toBeVisible();
  await expect(card("Taxable Gain")).toContainText("£0.01");
  await expect(income).toBeEditable();
  for (const amount of ["2999.999", "3000.001"]) {
    await gains.fill(amount);
    await expect(gains).toHaveAccessibleDescription(/pounds and pence/);
    await expect(gains).toBeFocused();
    await expect(card("Taxable Gain")).toHaveCount(0);
    await expect(result.getByText(/% of allowance used/)).toHaveCount(0);
    await expect(income).toHaveCount(0);
  }

  await gains.fill("4000");
  await expect(card("Taxable Gain")).toContainText("£1,000.00");
  await expect(card("Estimated Tax Owed")).toContainText(
    "Enter your taxable income",
  );
  await income.fill("37200");
  await expect(card("Estimated Tax Owed")).toContainText("£210.00");
  await income.fill("-1");
  await expect(income).toHaveAttribute("aria-invalid", "true");
  await expect(card("Taxable Gain")).toContainText("£1,000.00");
  await expect(card("Estimated Tax Owed")).toContainText(
    "Enter your taxable income",
  );
  await income.fill("37700");
  await expect(card("Estimated Tax Owed")).toContainText("£240.00");
  await gains.fill("10000");
  await income.fill("32430");
  await expect(card("Estimated Tax Owed")).toContainText("£1,363.80");
  await losses.fill("invalid");
  await expect(losses).toHaveAccessibleDescription(
    /Enter non-negative amounts/,
  );
  await expect(result.getByText("Taxable Gain", { exact: true })).toHaveCount(
    0,
  );
});

test("sub-penny pool unit prices stay visible in the ledger and summary", async ({ page }) => {
  await page.goto("/tools/section-104-calculator");
  await page.getByLabel("Quantity — purchase 1").fill("1000");
  await page.getByLabel("Price/share (£) — purchase 1").fill("0.004");
  await expect(page.getByText("£0.004", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("cell", { name: "£4.00", exact: true })).toHaveCount(2);
  await page.getByLabel("Quantity to sell").fill("1000");
  await page.getByLabel("Sale price per share").fill("0.005");
  await expect(page.getByText("+£1.00", { exact: true })).toBeVisible();
});

test("the rates guide and checker agree when taxable income already includes allowances", async ({ page }) => {
  await page.goto("/guide/cgt-rates-2025-26");
  await expect(page.getByText(/already gives you taxable income, use that figure directly/)).toBeVisible();
  await expect(page.getByText(/giving £2,298/)).toBeVisible();
  await expect(page.getByRole("link", {name: "Read HMRC’s guidance on claiming losses"})).toHaveAttribute("href", "https://www.gov.uk/capital-gains-tax/losses");
  await page.goto("/tools/cgt-allowance-checker");
  await page.locator("#gains").fill("13000");
  await page.locator("#taxable-income").fill("36000");
  await expect(page.getByText("£2,298.00", { exact: true })).toBeVisible();
});

test("the 30-day illustration reconciles rounded sale and acquisition amounts", async ({ page }) => {
  await page.goto("/tools/bed-and-breakfast-calculator");
  await page.getByLabel("Date of sale").fill("2025-07-01");
  await page.getByLabel("Shares sold").fill("1");
  await page.getByLabel("Sale price per share").fill("1.005");
  await page.getByLabel("Date of repurchase").fill("2025-07-02");
  await page.getByLabel("Shares repurchased").fill("1");
  await page.getByLabel("Repurchase price per share").fill("1.004");
  await page.getByRole("button", { name: "Check B&B Rule" }).click();
  await expect(page.getByText("Proceeds on matched shares").locator("..")).toContainText("£1.01");
  await expect(page.getByText("+£0.01", { exact: true })).toBeVisible();
  await expect(page.getByText("B&B Rule Triggered — 1 day between transactions")).toBeVisible();
});
