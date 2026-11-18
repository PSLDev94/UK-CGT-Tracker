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

test("the annual plan offers registration and sign-in with the billing destination and price", async ({
  page,
}) => {
  await page.goto("/pricing");
  const register = page.getByRole("link", {
    name: "Create an account for annual reports",
  });
  const login = page.getByRole("link", {
    name: "Already have an account? Sign in",
  });
  await expect(register).toHaveAttribute("href", "/signup?next=%2Fbilling");
  await expect(login).toHaveAttribute("href", "/login?next=%2Fbilling");
  await register.click();
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Continue to billing.*£49 per year/),
  ).toBeVisible();
  await page.goBack();
  await login.click();
  await expect(
    page.getByRole("heading", { name: "Sign in to your account" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Continue to billing.*£49 per year/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create account" }),
  ).toHaveAttribute("href", "/account/sign-up?next=%2Fbilling");
});

test("a protected deep link exposes only the two account choices before sign-in", async ({
  page,
}) => {
  await page.route("**/api/v2/auth/get-session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: "null",
    }),
  );
  for (const path of [
    "/billing?year=2024-25&format=evidence",
    "/dashboard/upload?account=account-1",
  ]) {
    await page.goto(path);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute("href", "/login?next=" + encodeURIComponent(path));
    await expect(
      main.getByRole("link", { name: "Create account", exact: true }),
    ).toHaveAttribute("href", "/signup?next=" + encodeURIComponent(path));
    await expect(page.getByLabel("Workspace navigation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  }
});

test("broker help carries the selected upload options and Escape returns focus from outside the mobile menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v2/auth/get-session", (route) =>
    route.fulfill({ json: { user: { name: "Test investor" } } }),
  );
  await page.route("**/api/v2/workspace", (route) =>
    route.fulfill({
      json: {
        portfolio: {
          id: "portfolio-1",
          name: "Personal investments",
          revision: 0,
        },
        accounts: [
          {
            id: "first-account",
            broker: "freetrade",
            label: "Freetrade",
            account_type: "GIA",
          },
          {
            id: "second-account",
            broker: "ajbell",
            label: "AJ Bell dealing",
            account_type: "GIA",
          },
        ],
        imports: [],
        drafts: [],
        calculations: [],
      },
    }),
  );
  await page.goto("/dashboard/upload?year=2024-25");
  const account = page.getByLabel("Broker account", { exact: true });
  await account.selectOption("second-account");
  const menu = page.getByRole("button", { name: "Open sidebar menu" });
  await menu.click();
  await page.getByRole("button", { name: "Sign out" }).focus();
  await page.keyboard.press("Tab");
  await expect(account).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  const guide = page.getByRole("link", { name: "See export instructions" });
  await guide.click();
  await expect(page.locator("article#ajbell h2")).toBeInViewport();
  const nativeFrom = new URL(page.url()).searchParams.get("from");
  expect(nativeFrom).toBe(
    "/dashboard/upload?year=2024-25&account=second-account",
  );
  await page.goBack();
  await expect(account).toHaveValue("second-account");
  const format = page.getByLabel("File format");
  await format.selectOption("canonical-v1");
  await page
    .getByRole("link", { name: "Check the reviewed CSV template columns" })
    .click();
  await expect(page).toHaveURL(/#template$/);
  const templateFrom = new URL(page.url()).searchParams.get("from")!;
  expect(templateFrom).toBe(nativeFrom + "&format=canonical-v1");
  await page.goto(templateFrom);
  await expect(account).toHaveValue("second-account");
  await expect(format).toHaveValue("canonical-v1");
});
