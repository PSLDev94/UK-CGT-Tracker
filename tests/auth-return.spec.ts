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

test("the signup form waits for JavaScript before accepting a submission", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto("/signup?next=%2Fdashboard%2Fupload");
    await expect(page.locator("form")).toHaveAttribute("method", "post");
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeDisabled();
    const guidance = page.locator("form noscript p");
    await expect(guidance).toBeVisible();
    await expect(guidance).toHaveText("Enable JavaScript to use this form.");
  } finally {
    await context.close();
  }
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
  const email = page.getByLabel("Email address");
  const password = page.getByLabel("Password", { exact: true });
  await email.fill("investor@example.test");
  await password.fill("example password 123");
  for (const [name, heading] of [
    ["Privacy policy", "Privacy & your data"],
    ["Terms of service", "Service information"],
  ]) {
    const popup = page.waitForEvent("popup");
    await page.getByRole("link", { name }).click();
    const policyPage = await popup;
    await expect(
      policyPage.getByRole("heading", { name: heading }),
    ).toBeVisible();
    await policyPage.close();
    await expect(email).toHaveValue("investor@example.test");
    await expect(password).toHaveValue("example password 123");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/billing");
  }
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

test("each public calculator carries its upload action through signup and sign-in", async ({
  page,
}) => {
  for (const tool of [
    "bed-and-breakfast-calculator",
    "section-104-calculator",
    "cgt-allowance-checker",
  ]) {
    await page.goto("/tools/" + tool);
    const upload = page.getByRole("link", { name: "Upload your CSV free" });
    await expect(upload).toHaveAttribute(
      "href",
      "/signup?next=%2Fdashboard%2Fupload",
    );
    await upload.click();
    const signIn = page.getByRole("link", { name: "Back to sign in" });
    await signIn.click();
    await expect(
      page.getByRole("heading", { name: "Sign in to your account" }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("next")).toBe(
      "/dashboard/upload",
    );
    await expect(
      page.getByRole("link", { name: "Need another verification email?" }),
    ).toHaveAttribute("href", "/account/verify?next=%2Fdashboard%2Fupload");
  }
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

test("signup clears corrected errors and rechecks both passwords without resubmission", async ({ page }) => {
  await page.goto("/signup");
  const name = page.getByLabel("Your name");
  const email = page.getByLabel("Email address");
  const password = page.getByLabel("Password", { exact: true });
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await name.fill("Example investor");
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await email.fill("investor@example.test");
  await expect(page.getByText("Enter a valid email address.")).toHaveCount(0);
  const initialPassword = "sample account password";
  await password.fill(initialPassword);
  await confirmation.fill(initialPassword);
  await expect(page.locator("input[aria-invalid=true]")).toHaveCount(0);
  await password.fill(initialPassword + "!");
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("The passwords do not match.")).toBeVisible();
  await confirmation.fill(initialPassword + "!");
  await expect(confirmation).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByText("The passwords do not match.")).toHaveCount(0);
});

test("a signed-out broker upload names the broker through registration and sign-in", async ({ page }) => {
  await page.route("**/api/v2/auth/get-session", route => route.fulfill({ json: null }));
  await page.route("**/api/v2/workspace", route => route.fulfill({ status: 401, json: { error: "Sign in required." } }));
  await page.goto("/supported-brokers#freetrade");
  await page.getByRole("link", { name: "Upload CSV for Freetrade" }).click();
  await expect(page.getByText("Sign in or create a free account to continue to your Freetrade CSV upload.")).toBeVisible();
  const next = "/dashboard/upload?broker=freetrade";
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page.getByText(/then sign in to upload your Freetrade CSV/)).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(next);
  await expect(page.getByRole("link", { name: "Back to Freetrade instructions" })).toHaveAttribute("href", "/supported-brokers#freetrade");
  await expect(page.getByText(/Example account · AJ Bell/)).toBeVisible();
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await expect(page.getByText("Sign in to continue to your Freetrade CSV upload.")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(next);
});

test("invalid signup never redirects subsequent password typing into the name field", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeEnabled();
  const focus = await page.locator("form").evaluate(async form => {
    if (!(form instanceof HTMLFormElement)) throw new Error("Expected the signup form");
    form.requestSubmit();
    const first = document.activeElement?.id;
    // Move on to another correction before the next paint.
    (form.elements.namedItem("password") as HTMLInputElement).focus();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    return { first, next: document.activeElement?.id };
  });
  await page.keyboard.type("synthetic field check");
  await expect(page.getByLabel("Your name")).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("synthetic field check");
  expect(focus).toEqual({ first: "name", next: "password" });
});
