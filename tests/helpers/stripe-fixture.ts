import Stripe from "stripe";
import {
  StripeGateway,
  STRIPE_API_VERSION,
} from "../../src/server/stripe-gateway";

export const config = {
  origin: "https://cgt.example",
  accountId: "acct_fixture",
  priceId: "price_fixture",
  livemode: false,
};
export const fixtureTerms = "CGT Tracker annual PDF subscription\n£49 per year. Synthetic trader address.";
export function stripeFixture(livemode = false) {
  const state = {
    account: { id: config.accountId, charges_enabled: true },
    price: {
      id: config.priceId, livemode, active: true, type: "recurring", currency: "gbp", unit_amount: 4900,
      billing_scheme: "per_unit", transform_quantity: null,
      recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
      product: { id: "prod_fixture", livemode, active: true },
    },
    portal: {
      id: "bpc_fixture", livemode, active: true,
      features: {
        subscription_cancel: { enabled: true, mode: "at_period_end" },
        invoice_history: { enabled: true },
      },
    },
    customer: {
      id: "cus_fixture", object: "customer", livemode,
      invoice_settings: { footer: fixtureTerms },
    },
    checkout: {
      id: "cs_fixture", object: "checkout.session", livemode, customer: "cus_fixture", mode: "subscription",
      status: "open", url: "https://checkout.stripe.com/c/pay/fixture",
    },
    subscription: {
      id: "sub_fixture",
      object: "subscription",
      livemode,
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
      livemode,
      customer: "cus_fixture",
      currency: "gbp",
      status: "paid",
      amount_remaining: 0,
      amount_paid: 4900,
      parent: { subscription_details: { subscription: "sub_fixture" } },
    },
    payment: {
      id: "inpay_fixture",
      object: "invoice_payment",
      livemode,
      status: "paid",
      payment: { type: "payment_intent", payment_intent: "pi_fixture" },
    },
    intent: {
      id: "pi_fixture",
      object: "payment_intent",
      livemode,
      status: "succeeded",
      latest_charge: "ch_fixture",
    },
    charge: {
      id: "ch_fixture",
      object: "charge",
      livemode,
      customer: "cus_fixture",
      paid: true,
      disputed: false,
      amount_refunded: 0,
    },
    hasSubscription: true,
    subscriptionsUnavailable: false,
    hasPayment: true,
    secondPage: false,
  };
  const requests: { path: string; body: string; version: string | null }[] = [];
  const client = new Stripe("synthetic-fixture", {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 0,
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
      if (url.pathname === "/v1/account") body = state.account;
      else if (url.pathname === "/v1/prices/price_fixture") body = state.price;
      else if (url.pathname === "/v1/billing_portal/configurations/bpc_fixture") body = state.portal;
      else if (url.pathname === "/v1/customers")
        body = { id: "cus_fixture", object: "customer", livemode };
      else if (url.pathname === "/v1/customers/cus_fixture") body = state.customer;
      else if (
        url.pathname === "/v1/subscriptions" &&
        state.subscriptionsUnavailable
      )
        return new Response(
          JSON.stringify({ error: { message: "Fixture outage" } }),
          { status: 503 },
        );
      else if (url.pathname === "/v1/subscriptions" && !state.hasSubscription)
        body = list([]);
      else if (url.pathname === "/v1/subscriptions")
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
      else if (url.pathname === "/v1/checkout/sessions" || url.pathname === "/v1/checkout/sessions/cs_fixture")
        body = state.checkout;
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
    gateway: new StripeGateway(client, { ...config, livemode }, "bpc_fixture", () => fixtureTerms),
  };
}
