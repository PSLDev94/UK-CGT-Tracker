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
  await gains.fill("3000");
  await expect(result.getByText("Allowance fully used")).toBeVisible();
  await expect(card("Taxable Gain")).toContainText("£0.00");

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
  await page.getByText("Higher rate (24%)", { exact: true }).click();
  await expect(card("Estimated Tax Owed")).toContainText("£240.00");
  await expect(income).toHaveCount(0);
  await losses.fill("invalid");
  await expect(losses).toHaveAccessibleDescription(
    /Enter non-negative amounts/,
  );
  await expect(result.getByText("Taxable Gain", { exact: true })).toHaveCount(
    0,
  );
});
