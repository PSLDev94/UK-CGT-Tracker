import { describe, expect, it } from "vitest";
import { STRIPE_API_VERSION } from "../src/server/stripe-gateway";
import { config, stripeFixture as setup } from "./helpers/stripe-fixture";

describe("Stripe SDK gateway against versioned HTTP fixtures", () => {
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
  ])("does not grant paid state for %s", async (reason) => {
    const s = setup();
    if (reason === "refund") s.state.charge.amount_refunded = 100;
    if (reason === "dispute") s.state.charge.disputed = true;
    if (reason === "processing") s.state.intent.status = "processing";
    if (reason === "no-payment") s.state.hasPayment = false;
    if (reason === "wrong-customer") s.state.charge.customer = "cus_other";
    if (reason === "unpaid-invoice") s.state.invoice.status = "open";
    if (reason === "no-amount-paid") s.state.invoice.amount_paid = 0;
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
