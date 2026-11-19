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
export function stripeFixture() {
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
      if (url.pathname === "/v1/customers")
        body = { id: "cus_fixture", object: "customer", livemode: false };
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
