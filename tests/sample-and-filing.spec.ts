import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { reportPageText } from "./helpers/pdf-text";
import { calculateGains } from "../src/domain/cgt/calculate";
import { sampleReport } from "../src/domain/reports/sample";
import { adjustment2024Url, sa108Edition } from "../src/domain/reports/filing-guidance";

test("each homepage sale opens its own matching evidence and reconciles with both PDF downloads", async ({ page }) => {
  await page.goto("/");
  const sample = page.getByRole("region", { name: "Explore a sample share sale" });
  for (const [id, label, amount, reference] of [
    ["tesla", "Tesla", "−£500.00", "SAMPLE-DEAL-5"],
    ["apple", "Apple", "+£2,300.00", "SAMPLE-DEAL-1"],
    ["lloyds", "Lloyds", "+£50.00", "SAMPLE-DEAL-6"],
  ] as const) {
    const choice = sample.getByRole("button", { name: label, exact: true });
    await choice.click();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    await expect(sample).toContainText(amount);
    await sample.getByRole("link", { name: "Inspect source records" }).click();
    await expect(page).toHaveURL(new RegExp("sample-calculation#" + id + "$"));
    const detail = page.locator("#match-" + id);
    await expect(detail).toContainText(reference);
    await expect(detail).toContainText(amount);
    if (id === "apple") {
      await expect(detail).toContainText("£8,505.00");
      await expect(detail).toContainText("£5.00");
      await expect(detail).toContainText("£6,205.00");
    }
    await page.goBack();
  }
  for (const kind of ["summary", "evidence"]) {
    if (kind === "evidence") await page.goto("/sample-calculation");
    const link = page.locator(`a[download][href="/samples/cgt-${kind}.pdf"]`).first();
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe(`cgt-${kind}.pdf`);
    const path = await download.path();
    if (!path) throw new Error("The browser did not save the sample PDF");
    const text = reportPageText(await PDFDocument.load(await readFile(path))).replaceAll(",", "");
    for (const value of ["£1850.00", "£2350.00", "£500.00", "£11955.00", "£11950.00", "£2300.00", "£50.00"]) expect(text).toContain(value);
    if (kind === "evidence") {
      for (const value of ["£8505.00", "£8500.00", "£5.00", "£6200.00", "£6205.00", "SAMPLE-DEAL-3"]) expect(text).toContain(value);
    }
  }
});

test("filing guidance uses the report year, including archived editions and the current open year", async ({
  page,
}) => {
  const years = [
    "2021-22",
    "2022-23",
    "2023-24",
    "2024-25",
    "2025-26",
    "2026-27",
  ];
  const account = {
    id: "sample",
    label: "Illustrative dealing account",
    broker: "ajbell",
    account_type: "GIA",
  };
  const calculations = years.map((year) => ({
    id: "sample-" + year,
    tax_year: year,
    coverage_confirmed: true,
    coverage_accounts: [account.id],
    result: year === "2024-25" ? calculateGains([
      { id: "buy", securityId: "GB0008706128", side: "BUY", date: "2024-06-01", quantity: "2", considerationGBP: "20", feesGBP: "0" },
      { id: "sell", securityId: "GB0008706128", side: "SELL", date: "2024-10-30", quantity: "2", considerationGBP: "30", feesGBP: "0" },
    ], { taxYear: "2024-25", historyThrough: "2025-05-05" }) : { ...sampleReport.result, taxYear: year },
  }));
  await page.route("**/api/v2/auth/**", (route) =>
    route.fulfill({
      json: { user: { name: "Investor", emailVerified: true } },
    }),
  );
  await page.route("**/api/v2/workspace", (route) =>
    route.fulfill({
      json: {
        portfolio: { id: "sample", name: "Portfolio", revision: 1 },
        accounts: [account],
        drafts: [],
        imports: [],
        calculations,
      },
    }),
  );
  await page.route("**/api/v2/billing", (route) =>
    route.fulfill({ json: { entitled: true, testMode: true } }),
  );
  await page.goto("/dashboard/reports?year=2024-25");
  const select = page.getByLabel("Tax year", { exact: true });
  const summary = page.getByRole("region", { name: "Calculation summary" });
  await expect(
    summary
      .getByRole("list", { name: "Confirmed accounts" })
      .getByRole("listitem"),
  ).toHaveText(account.label);
  for (const year of years) {
    await select.selectOption(year);
    const edition = sa108Edition(year);
    const label = year.replace("-", "–");
    const rateChange = summary.getByRole("link", { name: "HMRC’s adjustment guidance" });
    if (year === "2024-25") {
      await expect(rateChange).toHaveAttribute("href", adjustment2024Url);
      const periods = page.getByRole("region", { name: "2024–25 rate periods" });
      await expect(periods).toContainText("Gains £10.00 · Losses £0.00 · Net £10.00");
      await expect(summary.getByText(/SA108 box 51/)).toBeVisible();
    } else {
      await expect(rateChange).toHaveCount(0);
    }
    if (year === "2025-26") {
      await summary
        .getByRole("link", { name: `Read the ${label} SA108 filing guide` })
        .click();
      const back = page.getByRole("link", {
        name: `Back to your ${label} report`,
      });
      await expect(back).toHaveAttribute(
        "href",
        "/dashboard/reports?year=2025-26",
      );
      await back.click();
      await expect(select).toHaveValue(year);
    } else if (edition) {
      for (const kind of ["form", "notes"] as const) {
        const link = summary.getByRole("link", {
          name: `${label} SA108 ${kind}`,
        });
        await expect(link).toHaveAttribute("href", edition[kind]);
        await expect(link).toHaveAttribute("target", "_blank");
      }
    } else {
      await expect(
        summary.getByRole("link", { name: /Check HMRC for the 2026–27/ }),
      ).toBeVisible();
    }
  }
});
