import { describe, expect, it } from "vitest";
import { STRIPE_API_VERSION } from "../src/server/stripe-gateway";
import { config, fixtureTerms, stripeFixture as setup } from "./helpers/stripe-fixture";
import { stripeSettings } from "../src/server/billing-config";

describe("production and test billing configuration for web and reconciliation", () => {
  const live = {
    APP_ORIGIN: "https://www.cgttracker.com", RAILWAY_ENVIRONMENT_NAME: "production", STRIPE_MODE: "live",
    STRIPE_SECRET_KEY: "rk_live_fixture", STRIPE_ACCOUNT_ID: "acct_fixture", STRIPE_PRICE_ID: "price_fixture",
    STRIPE_PORTAL_CONFIGURATION_ID: "bpc_fixture",
  };
  it("enables only the intended deployment and preserves existing sandbox settings", () => {
    expect(stripeSettings(live).config.livemode).toBe(true);
    const staging = { ...live, APP_ORIGIN: "https://example.up.railway.app", RAILWAY_ENVIRONMENT_NAME: "staging", STRIPE_SECRET_KEY: "rk_test_fixture", STRIPE_MODE: undefined };
    expect(stripeSettings(staging).config.livemode).toBe(false);
    expect(() => stripeSettings({ ...staging, STRIPE_SECRET_KEY: live.STRIPE_SECRET_KEY })).toThrow();
    expect(() => stripeSettings({ ...staging, APP_ORIGIN: live.APP_ORIGIN })).toThrow();
  });
  it.each([
    { RAILWAY_ENVIRONMENT_NAME: "staging" }, { STRIPE_MODE: "typo" }, { STRIPE_MODE: undefined },
    { APP_ORIGIN: "https://example.up.railway.app" }, { APP_ORIGIN: "http://www.cgttracker.com" },
    { STRIPE_SECRET_KEY: "rk_test_fixture" }, { STRIPE_PORTAL_CONFIGURATION_ID: "" },
  ])("rejects mismatched or incomplete live settings %#", (override) => {
    expect(() => stripeSettings({ ...live, ...override })).toThrow();
  });
});

describe("Stripe SDK gateway against versioned HTTP fixtures", () => {
  it("validates a live charge-ready account, sterling annual plan and at-period-end cancellation", async () => {
    const s = setup(true);
    await s.gateway.validate();
    expect(s.requests.some(r => r.path === "/v1/account")).toBe(true);
    expect(await s.gateway.subscriptions("cus_fixture")).toMatchObject([{ paid: true }]);
    await s.gateway.createCheckout("cus_fixture", "live_operation");
    const params = new URLSearchParams(s.requests.at(-1)!.body);
    expect(params.get("currency")).toBe("gbp");
    expect(params.get("adaptive_pricing[enabled]")).toBe("false");
    s.state.checkout.customer = "cus_other";
    await expect(s.gateway.checkout("cs_fixture", "cus_fixture")).rejects.toThrow("customer");
  });
  it.each(["account","charges","mode","amount","currency","interval","portal","invoice history"] as const)(
    "rejects live %s misconfiguration before offering checkout", async (field) => {
      const s = setup(true);
      if (field === "account") s.state.account.id = "acct_other";
      if (field === "charges") s.state.account.charges_enabled = false;
      if (field === "mode") s.state.price.livemode = false;
      if (field === "amount") s.state.price.unit_amount = 490;
      if (field === "currency") s.state.price.currency = "usd";
      if (field === "interval") s.state.price.recurring.interval = "month";
      if (field === "portal") s.state.portal.features.subscription_cancel.mode = "immediately";
      if (field === "invoice history") s.state.portal.features.invoice_history.enabled = false;
      await expect(s.gateway.validate()).rejects.toThrow();
    },
  );
  it.each([
    ["flexible portal cancellation", false, 2000000000, 2000000000, true],
    ["classic portal cancellation", true, 2000000000, 2000000000, true],
    ["earlier cancellation", false, 1900000000, 1900000000, true],
    [
      "cancellation after the paid period",
      false,
      2100000000,
      2000000000,
      false,
    ],
    ["removed cancellation", false, null, 2000000000, false],
  ] as const)(
    "reconciles %s without extending paid access",
    async (_name, legacyFlag, cancelAt, periodEnd, cancelAtPeriodEnd) => {
      const s = setup();
      s.state.subscription.cancel_at_period_end = legacyFlag;
      s.state.subscription.cancel_at = cancelAt;
      expect(await s.gateway.subscriptions("cus_fixture")).toMatchObject([
        { paid: true, periodEnd, cancelAtPeriodEnd },
      ]);
    },
  );
  it("checks the actual invoice, payment intent and current charge before granting paid state", async () => {
    const s = setup();
    expect(await s.gateway.subscriptions("cus_fixture")).toMatchObject([
      { eligible: true, paid: true },
    ]);
    expect(s.requests.map((r) => r.path.split("?")[0])).toEqual([
      "/v1/subscriptions",
      "/v1/invoices/in_fixture",
      "/v1/invoice_payments",
      "/v1/payment_intents/pi_fixture",
      "/v1/charges/ch_fixture",
    ]);
    expect(s.requests.every((r) => r.version === STRIPE_API_VERSION)).toBe(
      true,
    );
  });
  it.each([
    "refund",
    "dispute",
    "processing",
    "no-payment",
    "wrong-customer",
    "unpaid-invoice",
    "wrong-subscription",
    "no-amount-paid",
    "wrong-currency",
  ])("does not grant paid state for %s", async (reason) => {
    const s = setup();
    if (reason === "refund") s.state.charge.amount_refunded = 100;
    if (reason === "dispute") s.state.charge.disputed = true;
    if (reason === "processing") s.state.intent.status = "processing";
    if (reason === "no-payment") s.state.hasPayment = false;
    if (reason === "wrong-customer") s.state.charge.customer = "cus_other";
    if (reason === "unpaid-invoice") s.state.invoice.status = "open";
    if (reason === "no-amount-paid") s.state.invoice.amount_paid = 0;
    if (reason === "wrong-currency") s.state.invoice.currency = "usd";
    if (reason === "wrong-subscription")
      s.state.invoice.parent.subscription_details.subscription = "sub_other";
    expect((await s.gateway.subscriptions("cus_fixture"))[0]?.paid).toBe(false);
  });
  it("does not mistake another price or paused collection for a paid plan", async () => {
    const s = setup();
    s.state.subscription.items.data[0]!.price.id = "price_other";
    expect((await s.gateway.subscriptions("cus_fixture"))[0]?.eligible).toBe(
      false,
    );
  });
  it("reads all subscription pages rather than missing an existing subscription", async () => {
    const s = setup();
    s.state.secondPage = true;
    expect(await s.gateway.subscriptions("cus_fixture")).toHaveLength(2);
    expect(
      s.requests.some((r) => r.path.includes("starting_after=sub_fixture")),
    ).toBe(true);
  });
  it("creates hosted checkout with fixed server-owned values and stable retry parameters", async () => {
    const s = setup();
    await s.gateway.createCheckout("cus_fixture", "operation_fixture");
    await s.gateway.createCheckout("cus_fixture", "operation_fixture");
    expect(s.requests[0]!.body).toBe(s.requests[1]!.body);
    const body = new URLSearchParams(s.requests[0]!.body);
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("line_items[0][price]")).toBe(config.priceId);
    expect(body.get("customer")).toBe("cus_fixture");
    expect(body.get("success_url")).toBe(
      `${config.origin}/billing?checkout=returned`,
    );
    expect(body.get("integration_identifier")).toMatch(
      /^cgt-tracker-[a-z]{8}$/,
    );
    expect(
      [...body.keys()].some(
        (key) =>
          key.startsWith("payment_method_types") ||
          key.startsWith("automatic_tax"),
      ),
    ).toBe(false);
  });
  it("fails closed if Stripe returns data from the wrong mode", async () => {
    const s = setup();
    s.state.charge.livemode = true;
    await expect(s.gateway.subscriptions("cus_fixture")).rejects.toThrow(
      "Unexpected Stripe mode",
    );
  });
});

describe("durable first-purchase contract", () => {
  function signedPaidInvoice(invoice: Record<string, unknown>, live = true) {
    const { gateway } = setup(live);
    const secret = "whsec_synthetic";
    const payload = JSON.stringify({
      id: "evt_contract", object: "event", type: "invoice.paid", livemode: live,
      api_version: STRIPE_API_VERSION,
      data: { object: {
        id: "in_contract", object: "invoice", livemode: live, customer: "cus_fixture",
        number: "CGT-001", currency: "gbp", amount_paid: 4900, status: "paid",
        billing_reason: "subscription_create", customer_email: "buyer@example.test",
        created: 1717000000, status_transitions: { paid_at: 1717000600 },
        parent: { subscription_details: { subscription: "sub_fixture", metadata: {
          cgt_contract: "annual-pdf", cgt_price: config.priceId,
        } } },
        footer: fixtureTerms + "\nTerms as issued on the invoice.", ...invoice,
      } },
    });
    const signature = gateway.client.webhooks.generateTestHeaderString({ payload, secret });
    return gateway.event(payload, signature, secret);
  }

  it("writes and verifies the customer invoice footer before opening a tagged live Checkout", async () => {
    const s = setup(true);
    await s.gateway.createCheckout("cus_fixture", "contract_operation");
    expect(s.requests.map(r => r.path)).toEqual(["/v1/customers/cus_fixture", "/v1/checkout/sessions"]);
    expect(new URLSearchParams(s.requests[0]!.body).get("invoice_settings[footer]")).toBe(fixtureTerms);
    const params = new URLSearchParams(s.requests[1]!.body);
    expect(params.get("subscription_data[metadata][cgt_contract]")).toBe("annual-pdf");
    expect(params.get("subscription_data[metadata][cgt_price]")).toBe(config.priceId);
    expect(params.get("subscription_data[metadata][cgt_access_requested]")).toBe("immediate");
  });

  it.each(["footer", "customer", "mode"])("does not open Checkout if Stripe confirms an unexpected %s", async mismatch => {
    const s = setup(true);
    if (mismatch === "footer") s.state.customer.invoice_settings.footer = "Old terms";
    if (mismatch === "customer") s.state.customer.id = "cus_other";
    if (mismatch === "mode") s.state.customer.livemode = false;
    await expect(s.gateway.createCheckout("cus_fixture", "contract_operation")).rejects.toThrow();
    expect(s.requests.some(r => r.path === "/v1/checkout/sessions")).toBe(false);
  });

  it("delivers the recipient, terms, reference and time from the signed original invoice", async () => {
    const event = await signedPaidInvoice({});
    expect(event?.contract).toEqual({
      recipient: "buyer@example.test", invoiceId: "in_contract", reference: "CGT-001",
      paidAt: new Date(1717000600 * 1000).toISOString(), text: fixtureTerms + "\nTerms as issued on the invoice.",
    });
    const fallback = await signedPaidInvoice({ number: null, status_transitions: { paid_at: null } });
    expect(fallback?.contract).toMatchObject({ reference: "in_contract", paidAt: new Date(1717000000 * 1000).toISOString() });
  });

  it("does not send subscription confirmations for renewals, other products or sandbox invoices", async () => {
    const wrongPrice = { parent: { subscription_details: { subscription: "sub_other", metadata: {
      cgt_contract: "annual-pdf", cgt_price: "price_other",
    } } } };
    for (const invoice of [{ billing_reason: "subscription_cycle" }, { parent: null }, wrongPrice]) {
      expect((await signedPaidInvoice(invoice))?.contract).toBeUndefined();
    }
    expect((await signedPaidInvoice({}, false))?.contract).toBeUndefined();
  });

  it.each([{ footer: null }, { footer: "Unrelated note" }, { customer_email: null }])(
    "leaves an incomplete tagged purchase retryable %#", async invoice => {
      await expect(signedPaidInvoice(invoice)).rejects.toThrow();
    },
  );
});
