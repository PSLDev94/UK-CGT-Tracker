import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { reportPageText } from "./helpers/pdf-text";

test("the illustrative sale opens its source records and reconciles to the printable statement", async ({
  page,
  request,
}) => {
  await page.goto("/design-preview");
  await expect(page.getByRole("heading", { name: "Apple" })).toBeInViewport();
  await expect(
    page.getByText("+£2,300.00", { exact: true }).filter({ visible: true }),
  ).toBeInViewport();
  await page
    .getByRole("link", { name: /see how this sale was matched/i })
    .click();
  await expect(page).toHaveURL(/calculations#apple$/);
  const apple = page.locator("#match-apple");
  await expect(apple).toBeVisible();
  await expect(apple).toContainText("£6,205.00");
  await expect(apple).toContainText("SAMPLE-DEAL-1");
  const tesla = page.getByRole("button", { name: "View match for Tesla" });
  await tesla.click();
  await expect(page.locator("#match-tesla")).toContainText("12 November 2025");
  await expect(page.locator("#match-tesla")).toContainText("SAMPLE-DEAL-5");
  await expect(apple).toBeHidden();
  await page
    .getByRole("button", { name: "View match for Lloyds Banking Group" })
    .click();
  await expect(page.locator("#match-lloyds")).toContainText("SAMPLE-DEAL-6");
  const pdfUrl = await page
    .getByRole("navigation", { name: "Design preview" })
    .getByRole("link", { name: "Sample PDF" })
    .getAttribute("href");
  const response = await request.get(pdfUrl!);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-disposition"]).toContain("inline");
  const attachment = await request.get(pdfUrl! + "?download=1");
  expect(attachment.headers()["content-disposition"]).toContain("attachment");
  const pdf = await PDFDocument.load(await response.body());
  const text = reportPageText(pdf);
  for (const value of [
    "£1,850.00",
    "£2,300.00",
    "£500.00",
    "£50.00",
    "£5.00",
    ...Array.from({ length: 7 }, (_, i) => "SAMPLE-DEAL-" + (i + 1)),
  ]) {
    expect(text).toContain(value);
  }
});
