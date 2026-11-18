import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  for (const enlargement of ["text", "root"] as const) {
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
