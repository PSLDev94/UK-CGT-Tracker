import { expect, test, type Page, type Locator } from "@playwright/test";

async function enlarge(page: Page, enlargement: "root" | "text") {
  await page.evaluate(async (mode) => {
    await document.fonts.ready;
    if (mode === "root") {
      document.documentElement.style.fontSize = "200%";
      return;
    }
    const labels = Array.from(
      document.body.querySelectorAll<HTMLElement>("*"),
    ).filter(
      (element) =>
        element instanceof HTMLElement &&
        Array.from(element.childNodes).some(
          (child) =>
            child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
        ),
    );
    // Measure before changing any ancestor so each text node doubles exactly once.
    const sizes = labels.map((label) => ({
      label,
      fontSize: parseFloat(getComputedStyle(label).fontSize),
    }));
    for (const { label, fontSize } of sizes) {
      label.style.fontSize = fontSize * 2 + "px";
    }
  }, enlargement);
}

async function expectTextToFit(labels: Locator, width: number) {
  const overflowing = await labels.evaluateAll((elements, width) => {
    return elements
      .filter((label) => {
        const range = document.createRange();
        range.selectNodeContents(label);
        return Array.from(range.getClientRects()).some(
          (rect) =>
            rect.width > 0 && (rect.left < -1 || rect.right > width + 1),
        );
      })
      .map((label) => label.textContent?.trim());
  }, width);
  expect(overflowing).toEqual([]);
}

for (const width of [320, 390]) {
  for (const enlargement of ["text", "root"] as const) {
    test(`Home and the workspace fit ${width}px with doubled ${enlargement} size`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.route("**/api/v2/auth/get-session", (route) =>
        route.fulfill({
          json: { user: { name: "Test investor", emailVerified: true } },
        }),
      );
      await page.route("**/api/v2/workspace", (route) =>
        route.fulfill({
          json: {
            portfolio: { id: "portfolio", name: "Test", revision: 0 },
            accounts: [
              {
                id: "account",
                label: "Invest",
                broker: "trading212",
                account_type: "GIA",
              },
            ],
            imports: [],
            drafts: [],
            calculations: [],
          },
        }),
      );
      await page.route("**/api/v2/billing", (route) =>
        route.fulfill({
          json: { status: "active", entitled: true, canManage: true },
        }),
      );
      for (const path of [
        "/",
        "/dashboard/upload",
        "/dashboard/calculations",
        "/billing",
      ]) {
        await page.goto(path);
        const main = page.getByRole("main");
        await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
        if (path === "/billing") {
          await expect(
            main.getByRole("button", { name: "Manage subscription" }),
          ).toBeVisible();
        }
        if (path === "/dashboard/upload") {
          const name =
            "Trading-212-consolidated-ordinary-share-transactions.csv";
          await main.getByLabel("CSV file", { exact: true }).setInputFiles({
            name,
            mimeType: "text/csv",
            buffer: Buffer.from("Date,Amount\n"),
          });
          const selected = main.getByText(name, { exact: false });
          await expect(selected).toBeVisible();
        }
        await enlarge(page, enlargement);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await expectTextToFit(
          main.locator(
            "h1, h2, h3, .home-card-pairs p, .home-card-pairs .tabular-nums, .home-card-pairs .font-bold, .home-card-pairs .font-extrabold, .actions button, .upload-box .caption",
          ),
          width,
        );
        if (path === "/") continue;
        if (path === "/dashboard/upload") {
          await main.getByLabel("CSV file", { exact: true }).setInputFiles([]);
        }
        const toggle = page.getByRole("button", { name: "Open sidebar menu" });
        expect(
          await toggle.evaluate((button) => {
            const r = button.getBoundingClientRect();
            return (
              window.scrollX === 0 &&
              r.left >= 0 &&
              r.right <= document.documentElement.clientWidth &&
              r.width >= 44 &&
              r.height >= 44 &&
              button.contains(
                document.elementFromPoint(
                  r.left + r.width / 2,
                  r.top + r.height / 2,
                ),
              )
            );
          }),
        ).toBe(true);
        await toggle.click();
        await expect(
          page
            .getByRole("navigation", { name: "Dashboard" })
            .getByRole("link", { name: "Calculations" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(toggle).toBeFocused();
      }
    });

    test(`Pricing and navigation fit ${width}px with doubled ${enlargement} size`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/pricing");
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      const menu = nav.getByRole("button", { name: "Open menu" });
      await menu.click();
      const close = nav.getByRole("button", { name: "Close menu" });
      const signup = nav.getByRole("link", { name: "Sign up free" }).first();
      await enlarge(page, enlargement);

      const annual = page.getByRole("link", {
        name: "Create an account for annual reports",
      });
      for (const control of [close, signup, annual]) {
        const box = await control.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await expect(
        nav.getByRole("link", { name: "Broker support" }),
      ).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      await expect(page.getByText(/^£49\s*\/ year$/)).toBeVisible();
      await annual.click();
      await expect(
        page.getByRole("heading", { name: "Create your account" }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.get("next")).toBe("/billing");
    });
  }
}
