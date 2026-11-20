import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { reportPageText } from "./helpers/pdf-text";

test("the homepage and sample statement reflow at 320 pixels with double-size text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 650 });
  for (const path of ["/", "/sample-calculation#tesla"]) {
    await page.goto(path);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const bounds = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(bounds.page).toBeLessThanOrEqual(bounds.viewport);
    const target =
      path === "/"
        ? page.getByRole("button", { name: "Apple", exact: true })
        : page.getByRole("link", { name: "Open annual statement PDF" });
    // Edge-aligned scrolling rounds to a whole pixel in Chromium. Center the
    // control so full visibility tests the layout, including at fractional sizes.
    await target.evaluate((element) =>
      element.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "instant",
      }),
    );
    await expect(target).toBeInViewport({ ratio: 1 });
  }
});

test("the previous staging review URLs lead to the approved designs and downloadable evidence", async ({
  page,
  request,
}) => {
  await page.goto("/design-preview");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Which purchase counts?" }),
  ).toBeVisible();
  await page.goto("/design-preview/calculations#tesla");
  await expect(page).toHaveURL(/sample-calculation#tesla$/);
  await expect(page.locator("#match-tesla")).toContainText("SAMPLE-DEAL-5");
  const source = "/design-preview/report.pdf";
  const [inline, attachment] = await Promise.all([
    request.get(source),
    request.get(source + "?download=1"),
  ]);
  expect(inline.headers()["content-disposition"]).toContain("inline");
  expect(attachment.headers()["content-disposition"]).toContain("attachment");
  const text = reportPageText(
    await PDFDocument.load(await inline.body()),
  ).replaceAll(",", "");
  for (const value of [
    "£1850.00",
    "£2300.00",
    "£500.00",
    "£50.00",
    "£5.00",
    ...Array.from({ length: 7 }, (_, i) => "SAMPLE-DEAL-" + (i + 1)),
  ]) {
    expect(text).toContain(value);
  }
});
