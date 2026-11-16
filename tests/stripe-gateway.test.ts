import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  StripeGateway,
  STRIPE_API_VERSION,
} from "../src/server/stripe-gateway";

const config = {
  origin: "https://cgt.example",
  accountId: "acct_fixture",
  priceId: "price_fixture",
  livemode: false,
};
function setup() {
  const state = {
    subscription: {
      id: "sub_fixture",
      object: "subscription",
      livemode: false,
      customer: "cus_fixture",
      status: "active",
      pause_collection: null,
      latest_invoice: "in_fixture",
      cancel_at_period_end: false,
      cancel_at: null as number | null,
      items: {
        data: [
          {
            price: { id: "price_fixture" },
            quantity: 1,
            current_period_end: 2000000000,
          },
        ],
        has_more: false,
      },
    },
    invoice: {
      id: "in_fixture",
      object: "invoice",
      livemode: false,
      customer: "cus_fixture",
      status: "paid",
      amount_remaining: 0,
      amount_paid: 4900,
      parent: { subscription_details: { subscription: "sub_fixture" } },
    },
    payment: {
      id: "inpay_fixture",
      object: "invoice_payment",
      livemode: false,
      status: "paid",
      payment: { type: "payment_intent", payment_intent: "pi_fixture" },
    },
    intent: {
      id: "pi_fixture",
      object: "payment_intent",
      livemode: false,
      status: "succeeded",
      latest_charge: "ch_fixture",
    },
    charge: {
      id: "ch_fixture",
      object: "charge",
      livemode: false,
      customer: "cus_fixture",
      paid: true,
      disputed: false,
      amount_refunded: 0,
    },
    hasPayment: true,
    secondPage: false,
  };
  const requests: { path: string; body: string; version: string | null }[] = [];
  const client = new Stripe("synthetic-fixture", {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      const url = new URL(String(input));
      requests.push({
        path: url.pathname + url.search,
        body: String(init?.body ?? ""),
        version: new Headers(init?.headers).get("stripe-version"),
      });
      let body: unknown;
      const list = (data: unknown[], has_more = false) => ({
        object: "list",
        data,
        has_more,
        url: url.pathname,
      });
      if (url.pathname === "/v1/subscriptions")
        body = url.searchParams.has("starting_after")
          ? list([
              { ...state.subscription, id: "sub_second", status: "canceled" },
            ])
          : list([state.subscription], state.secondPage);
      else if (url.pathname === "/v1/invoices/in_fixture") body = state.invoice;
      else if (url.pathname === "/v1/invoice_payments")
        body = list(state.hasPayment ? [state.payment] : []);
      else if (url.pathname === "/v1/payment_intents/pi_fixture")
        body = state.intent;
      else if (url.pathname === "/v1/charges/ch_fixture") body = state.charge;
      else if (url.pathname === "/v1/checkout/sessions")
        body = {
          id: "cs_fixture",
          object: "checkout.session",
          livemode: false,
          status: "open",
          url: "https://checkout.stripe.com/c/pay/fixture",
        };
      else throw new Error(`Unexpected fixture path ${url.pathname}`);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  });
  return {
    state,
    requests,
    gateway: new StripeGateway(client, config, "bpc_fixture"),
  };
}

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
  ])("does not grant paid state for %s", async (reason) => {
    const s = setup();
    if (reason === "refund") s.state.charge.amount_refunded = 100;
    if (reason === "dispute") s.state.charge.disputed = true;
    if (reason === "processing") s.state.intent.status = "processing";
    if (reason === "no-payment") s.state.hasPayment = false;
    if (reason === "wrong-customer") s.state.charge.customer = "cus_other";
    if (reason === "unpaid-invoice") s.state.invoice.status = "open";
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
