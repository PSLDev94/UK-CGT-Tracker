import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { reportPageText } from "./helpers/pdf-text";
import { sampleReport } from "../src/domain/reports/sample";
import { sa108Edition } from "../src/domain/reports/filing-guidance";

test("homepage jump and fee-bearing example reconcile with both downloadable samples", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See a sample calculation" }).click();
  const preview = page.locator("#preview");
  const title = preview.getByText("Illustrative Tax Year 2025-26 Overview");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(title).toBeInViewport();
  await expect
    .poll(async () => {
      const [heading, header] = await Promise.all([
        title.boundingBox(),
        nav.boundingBox(),
      ]);
      return Boolean(
        heading && header && heading.y >= header.y + header.height,
      );
    })
    .toBe(true);
  const apple = preview.getByRole("row", { name: /Apple/ });
  await expect(apple).toContainText("£8,505.00");
  await expect(apple).toContainText("Net sale proceeds £8,500.00");
  await expect(apple).toContainText("£6,205.00");
  await expect(apple).toContainText("Includes £5.00 selling costs");
  for (const [label, value] of [
    ["Total Gains", "£2,350.00"],
    ["Total Losses", "£500.00"],
    ["Total allowable costs", "£11,955.00"],
    ["Net gain", "£1,850.00"],
  ]) {
    const tile = preview
      .getByText(label!, { exact: true })
      .first()
      .locator("..");
    await expect(tile).toContainText(value!);
  }
  for (const kind of ["summary", "evidence"]) {
    const link = preview.getByRole("link", { name: `Download this sample ${kind} PDF` });
    await expect(link).toHaveAttribute("href", `/samples/cgt-${kind}.pdf`);
    const response = await request.get((await link.getAttribute("href"))!);
    expect(response.ok()).toBe(true);
    const text = reportPageText(await PDFDocument.load(await response.body()));
    expect(text).toContain("Net gain  £1850.00");
    expect(text).toContain(
      "Matched acquisition cost\n£11950.00\nTotal allowable costs\n£11955.00",
    );
    expect(text).toContain("Gains\n£2350.00\nLosses\n£500.00");
    if (kind === "evidence") {
      expect(text).toContain(
        "Apple\nGross disposal proceeds\n£8505.00\nSelling costs\n£5.00\nNet sale proceeds\n£8500.00",
      );
      expect(text).toContain(
        "Matched acquisition cost\n£6200.00\nTotal allowable costs\n£6205.00\nGain / loss\n£2300.00",
      );
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
    result: { ...sampleReport.result, taxYear: year },
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
