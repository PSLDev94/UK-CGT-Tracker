import { expect, test } from "@playwright/test";

test("signup confirmation replaces the form and preserves the requested report", async ({
  page,
}) => {
  let callback = "";
  await page.route("**/api/v2/auth/sign-up/email", (route) => {
    callback = route.request().postDataJSON().callbackURL;
    return route.fulfill({ json: { user: {} } });
  });
  const next = "/dashboard/reports?year=2024-25&format=evidence";
  await page.goto("/signup?next=" + encodeURIComponent(next));
  await page.getByLabel("Your name").fill("Example investor");
  await page.getByLabel("Email address").fill("user@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("example password 123");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("example password 123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Create account" }),
  ).toHaveCount(0);
  expect(new URL(callback).searchParams.get("next")).toBe(next);
  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByLabel("Email address")).toBeEditable();
});

test("the missing reset-token screen offers a working recovery path", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await expect(
    page.getByRole("button", { name: "Set new password" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Request a new reset link" }).click();
  await expect(page.getByLabel("Email address")).toBeEditable();
});
