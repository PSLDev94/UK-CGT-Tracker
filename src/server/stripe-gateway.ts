import { ANNUAL_REPORT_PRICE_PENCE } from "../domain/reports/access";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import type {
  BillingConfig,
  BillingEvent,
  BillingGateway,
  CheckoutState,
  SubscriptionState,
} from "./billing";
import { AppError } from "./errors";

export const STRIPE_API_VERSION = "2026-10-28.endive" as const;
export const BILLING_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "radar.early_fraud_warning.created",
] as const;
const objectId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

export function stripeClient(key: string) {
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    timeout: 8000,
    maxNetworkRetries: 1,
  });
}
export class StripeGateway implements BillingGateway {
  constructor(
    readonly client: Stripe,
    private readonly config: BillingConfig,
    private readonly portalConfiguration: string,
  ) {}
  async validate() {
    const [account, price] = await Promise.all([
      this.client.accounts.retrieve(this.config.accountId),
      this.client.prices.retrieve(this.config.priceId, { expand: ["product"] }),
    ]);
    if (
      account.id !== this.config.accountId ||
      price.livemode !== this.config.livemode ||
      !price.active ||
      price.type !== "recurring" ||
      price.currency !== "gbp" ||
      price.unit_amount !== ANNUAL_REPORT_PRICE_PENCE ||
      price.recurring?.interval !== "year" ||
      price.recurring.interval_count !== 1 ||
      price.recurring.usage_type !== "licensed" ||
      typeof price.product === "string" ||
      price.product.deleted ||
      !price.product.active
    )
      throw new Error("Unexpected Stripe account or price configuration");
    const portal = await this.client.billingPortal.configurations.retrieve(
      this.portalConfiguration,
    );
    if (
      !portal.active ||
      portal.livemode !== this.config.livemode ||
      !portal.features.subscription_cancel.enabled
    )
      throw new Error("Stripe portal cancellation must be available");
  }
  async createCustomer(key: string) {
    const customer = await this.client.customers.create(
      {},
      { idempotencyKey: key },
    );
    this.mode(customer.livemode);
    return customer.id;
  }
  private mode(livemode: boolean) {
    if (livemode !== this.config.livemode)
      throw new Error("Unexpected Stripe mode");
  }
  async subscriptions(customerId: string): Promise<SubscriptionState[]> {
    const subscriptions = [];
    for await (const subscription of this.client.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    })) {
      if (subscriptions.length >= 1000)
        throw new Error("Subscription history requires review");
      this.mode(subscription.livemode);
      const item = subscription.items.data[0];
      const eligible =
        subscription.items.data.length === 1 &&
        !subscription.items.has_more &&
        item?.price.id === this.config.priceId &&
        item.quantity === 1 &&
        !subscription.pause_collection;
      let paid = false;
      if (
        eligible &&
        subscription.status === "active" &&
        subscription.latest_invoice
      ) {
        const invoice = await this.client.invoices.retrieve(
          objectId(subscription.latest_invoice)!,
        );
        this.mode(invoice.livemode);
        paid =
          invoice.status === "paid" &&
          invoice.amount_remaining === 0 &&
          objectId(invoice.customer) === customerId &&
          objectId(invoice.parent?.subscription_details?.subscription) ===
            subscription.id;
        // A paid invoice alone can hide a refunded/disputed charge. Inspect the
        // current payment objects too; webhook delivery is not the only defence.
        if (paid && invoice.amount_paid > 0) {
          let found = false;
          for await (const payment of this.client.invoicePayments.list({
            invoice: invoice.id,
            status: "paid",
            limit: 100,
          })) {
            this.mode(payment.livemode);
            found = true;
            let chargeId = objectId(payment.payment.charge);
            if (payment.payment.payment_intent) {
              const intent = await this.client.paymentIntents.retrieve(
                objectId(payment.payment.payment_intent)!,
              );
              this.mode(intent.livemode);
              chargeId = objectId(intent.latest_charge);
              if (intent.status !== "succeeded") paid = false;
            }
            if (!chargeId) {
              paid = false;
              continue;
            }
            const charge = await this.client.charges.retrieve(chargeId);
            this.mode(charge.livemode);
            if (
              !charge.paid ||
              charge.disputed ||
              charge.amount_refunded > 0 ||
              objectId(charge.customer) !== customerId
            )
              paid = false;
          }
          if (!found) paid = false;
        }
      }
      const paidPeriodEnd = item?.current_period_end ?? 0;
      // Flexible billing's portal sets cancel_at but leaves the legacy flag false.
      // Cap access at an earlier cancellation without extending the paid period.
      const cancellationEndsThisPeriod =
        subscription.cancel_at != null &&
        subscription.cancel_at <= paidPeriodEnd;
      subscriptions.push({
        id: subscription.id,
        status: subscription.status,
        eligible: !!eligible,
        paid,
        periodEnd: cancellationEndsThisPeriod
          ? subscription.cancel_at!
          : paidPeriodEnd,
        cancelAtPeriodEnd:
          subscription.cancel_at_period_end || cancellationEndsThisPeriod,
      });
    }
    return subscriptions;
  }
  private session(session: Stripe.Checkout.Session): CheckoutState {
    this.mode(session.livemode);
    if (
      session.status !== "open" &&
      session.status !== "expired" &&
      session.status !== "complete"
    )
      throw new Error("Checkout state missing");
    if (
      session.url &&
      new URL(session.url).origin !== "https://checkout.stripe.com"
    )
      throw new Error("Unexpected Checkout destination");
    const status =
      session.status === "open"
        ? "open"
        : session.status === "complete"
          ? "complete"
          : "expired";
    return {
      id: session.id,
      status,
      url: session.url,
      subscriptionId: objectId(session.subscription),
    };
  }
  async createCheckout(customerId: string, key: string) {
    // Stable per-operation label keeps idempotent retries byte-for-byte identical.
    const suffix = [...createHash("sha256").update(key).digest().subarray(0, 8)]
      .map((n) => String.fromCharCode(97 + (n % 26)))
      .join("");
    return this.session(
      await this.client.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: this.config.priceId, quantity: 1 }],
          integration_identifier: `cgt-tracker-${suffix}`,
          success_url: `${this.config.origin}/billing?checkout=returned`,
          cancel_url: `${this.config.origin}/billing?checkout=cancelled`,
          // Tax configuration is intentionally not changed until business registration is confirmed.
        },
        { idempotencyKey: key },
      ),
    );
  }
  async checkout(id: string) {
    return this.session(await this.client.checkout.sessions.retrieve(id));
  }
  async portal(customerId: string) {
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      configuration: this.portalConfiguration,
      return_url: `${this.config.origin}/billing?checkout=portal`,
    });
    if (new URL(session.url).origin !== "https://billing.stripe.com")
      throw new Error("Unexpected portal destination");
    return session.url;
  }
  async event(
    raw: string,
    signature: string,
    secret: string,
  ): Promise<BillingEvent | null> {
    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(raw, signature, secret);
    } catch {
      throw new AppError(
        400,
        "INVALID_SIGNATURE",
        "Invalid webhook signature.",
      );
    }
    if (
      event.livemode !== this.config.livemode ||
      (event.account && event.account !== this.config.accountId) ||
      event.api_version !== STRIPE_API_VERSION
    ) {
      throw new AppError(
        400,
        "INVALID_EVENT_CONTEXT",
        "Unexpected webhook account, mode or API version.",
      );
    }
    if (!(BILLING_EVENTS as readonly string[]).includes(event.type))
      return null;
    const object = event.data.object;
    let customerId: string | null = null;
    let riskReason: string | undefined;
    if (object.object === "charge") {
      customerId = objectId(object.customer);
      riskReason = "refund_review";
    } else if (
      object.object === "dispute" ||
      object.object === "radar.early_fraud_warning"
    ) {
      const charge = await this.client.charges.retrieve(
        objectId(object.charge)!,
      );
      this.mode(charge.livemode);
      customerId = objectId(charge.customer);
      riskReason =
        object.object === "dispute" ? "dispute_review" : "fraud_review";
    } else if (
      object.object === "subscription" ||
      object.object === "invoice" ||
      object.object === "checkout.session"
    )
      customerId = objectId(object.customer);
    return { id: event.id, type: event.type, customerId, riskReason };
  }
}
