import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabase } from "./helpers/database";
import {
  Billing,
  type BillingGateway,
  type CheckoutState,
  type SubscriptionState,
} from "../src/server/billing";
import { authenticate } from "../src/server/identity";
import { query } from "../src/server/database";
import { AppError } from "../src/server/errors";
import {
  createBillingHandler,
  createStripeWebhookHandler,
} from "../src/server/billing-api";
import {
  StripeGateway,
  STRIPE_API_VERSION,
  stripeClient,
} from "../src/server/stripe-gateway";

let database: Awaited<ReturnType<typeof testDatabase>>;
const config = {
  origin: "https://cgt.example",
  accountId: "acct_fixture",
  priceId: "price_fixture",
  livemode: false,
};
const active = (): SubscriptionState => ({
  id: `sub_fixture_${sequence}`,
  status: "active",
  eligible: true,
  paid: true,
  periodEnd: Math.floor(Date.now() / 1000) + 86400,
  cancelAtPeriodEnd: false,
});
let sequence = 0;
async function setup() {
  const id = `billing-${++sequence}`;
  await database.pg.exec("RESET ROLE");
  await database.pg.query(
    'INSERT INTO auth."user"(id,name,email,"emailVerified") VALUES($1,$1,$2,true)',
    [id, `${id}@example.test`],
  );
  await database.pg.exec("SET ROLE cgt_billing");
  const identity = await authenticate(new Headers(), async () => ({
    user: { id, emailVerified: true },
    session: { expiresAt: new Date(Date.now() + 3600000) },
  }));
  const state = {
    subscriptions: [] as SubscriptionState[],
    session: {
      id: `cs_${id}`,
      status: "open",
      url: "https://checkout.stripe.com/c/pay/fixture",
    } as CheckoutState,
  };
  const gateway: BillingGateway = {
    createCustomer: vi.fn(async () => `cus_${id}`),
    subscriptions: vi.fn(async () => state.subscriptions),
    createCheckout: vi.fn(async () => state.session),
    checkout: vi.fn(async () => state.session),
    portal: vi.fn(async () => "https://billing.stripe.com/p/session/fixture"),
  };
  return {
    identity,
    state,
    gateway,
    billing: new Billing(database.db, gateway, config),
    customerId: `cus_${id}`,
  };
}
beforeAll(async () => {
  database = await testDatabase("cgt_billing");
}, 30000);
afterAll(async () => {
  await database.db.destroy();
});

describe("billing ownership, retries and reconciliation", () => {
  it("checks paid report access locally across checkout returns without spending the provider budget", async () => {
    const s = await setup();
    const calls = { general: 0, billing: 0 };
    const handler = createBillingHandler(s.billing, async () => ({
      user: { id: s.identity.ownerId, emailVerified: true },
      session: { expiresAt: new Date(Date.now() + 60000) },
    }), config.origin, async (_identity, bucket) => {
      if (++calls[bucket] > (bucket === "general" ? 60 : 10))
        throw new AppError(429, "TOO_MANY_REQUESTS", "Wait one minute.");
    });
    const post = (action: string) => handler(new Request(config.origin + "/api/v2/billing", {
      method: "POST", headers: { origin: config.origin, "content-type": "application/json" },
      body: JSON.stringify({ action }),
    }));
    for (let i = 0; i < 12; i++) {
      expect((await (await post("report-access")).json()).entitled).toBe(false);
    }
    expect(calls.billing).toBe(0);
    expect((await post("checkout")).status).toBe(200);
    s.state.subscriptions = [active()];
    expect((await (await post("status")).json()).entitled).toBe(true);
    for (let i = 0; i < 8; i++) expect((await post("portal")).status).toBe(200);
    const limited = await post("status");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    vi.mocked(s.gateway.subscriptions).mockClear();
    expect((await (await post("report-access")).json()).entitled).toBe(true);
    expect(s.gateway.subscriptions).not.toHaveBeenCalled();
    await query(database.db, "UPDATE cgt.billing_accounts SET current_period_end=now()-interval '1 second' WHERE owner_id=$1",[s.identity.ownerId]);
    expect((await (await post("report-access")).json()).entitled).toBe(false);
    await query(database.db, "UPDATE cgt.billing_accounts SET current_period_end=now()+interval '1 day',risk_hold=true,risk_reason='refund' WHERE owner_id=$1",[s.identity.ownerId]);
    expect(await (await post("report-access")).json()).toMatchObject({entitled:false,needsReview:true});
    while (calls.general < 60) expect((await post("report-access")).status).toBe(200);
    expect((await post("report-access")).status).toBe(429);
  });
  it("creates one customer, reuses open Checkout and never grants access from a redirect", async () => {
    const s = await setup();
    expect((await s.billing.status(s.identity)).entitled).toBe(false);
    expect(await s.billing.checkout(s.identity)).toEqual(
      await s.billing.checkout(s.identity),
    );
    expect(s.gateway.createCustomer).toHaveBeenCalledTimes(1);
    expect(s.gateway.createCheckout).toHaveBeenCalledTimes(1);
    expect((await s.billing.status(s.identity)).entitled).toBe(false);
  });
  it("does not accept forged identities or let a customer select another account/price/redirect", async () => {
    const s = await setup();
    await expect(
      s.billing.checkout({ ownerId: s.identity.ownerId } as typeof s.identity),
    ).rejects.toMatchObject({ status: 401 });
    const handler = createBillingHandler(
      s.billing,
      async () => ({
        user: { id: s.identity.ownerId, emailVerified: true },
        session: { expiresAt: new Date(Date.now() + 3600000) },
      }),
      config.origin,
      async () => {},
    );
    const request = (body: object, origin = config.origin) =>
      new Request(`${config.origin}/api/v2/billing`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect(
      (await handler(request({ action: "checkout", customer: "cus_victim" })))
        .status,
    ).toBe(400);
    expect(
      (
        await handler(
          request({ action: "checkout" }, "https://foreign.example"),
        )
      ).status,
    ).toBe(403);
    expect(s.gateway.createCustomer).not.toHaveBeenCalled();
  });
  it("restores only the selected PDF year and format for the same account and tab", async () => {
    const a = await setup(), b = await setup();
    const tab = "72eac3d6-28dc-4828-b5a2-78663871ce12";
    let owner = a.identity.ownerId;
    const handler = createBillingHandler(a.billing, async () => ({
      user: { id: owner, emailVerified: true }, session: { expiresAt: new Date(Date.now() + 60000) }
    }), config.origin, async () => {});
    const post = (body: object, cookie = "") => handler(new Request(config.origin + "/api/v2/billing",{
      method: "POST", headers: {origin: config.origin, "content-type": "application/json", cookie}, body: JSON.stringify(body)
    }));
    const target = {year:"2024-25",format:"evidence"};
    const start = await post({action:"checkout",tab,...target});
    const setCookie = start.headers.get("set-cookie");
    expect(start.status).toBe(200);
    expect(setCookie).toMatch(/HttpOnly; SameSite=Lax; Max-Age=86400; Secure/);
    const cookie = setCookie!.split(";")[0]!;
    expect((await (await post({action:"status",tab}, cookie)).json()).returnReport).toEqual(target);
    expect((await (await post({action:"status"}, cookie)).json()).returnReport).toBeNull();
    owner = b.identity.ownerId;
    expect((await (await post({action:"status",tab}, cookie)).json()).returnReport).toBeNull();
    expect((await post({action:"checkout",year:"2024-25",format:"invalid"})).status).toBe(400);
  });
  it("keeps provider idempotency keys after a provider failure", async () => {
    const s = await setup();
    vi.mocked(s.gateway.createCheckout).mockRejectedValueOnce(
      new Error("Provider timeout"),
    );
    await expect(s.billing.checkout(s.identity)).rejects.toThrow(
      "Provider timeout",
    );
    await s.billing.checkout(s.identity);
    const calls = vi.mocked(s.gateway.createCheckout).mock.calls;
    expect(calls[0]).toEqual(calls[1]);
    expect(s.gateway.createCustomer).toHaveBeenCalledTimes(1);
  });
  it("refuses ambiguous operations older than provider idempotency retention", async () => {
    const s = await setup();
    vi.mocked(s.gateway.createCustomer).mockRejectedValueOnce(
      new Error("Network lost"),
    );
    await expect(s.billing.checkout(s.identity)).rejects.toThrow();
    await query(
      database.db,
      "UPDATE cgt.billing_accounts SET customer_started_at=now()-interval '25 hours' WHERE owner_id=$1",
      [s.identity.ownerId],
    );
    await expect(s.billing.checkout(s.identity)).rejects.toMatchObject({
      code: "BILLING_RECONCILIATION_REQUIRED",
    });
    expect(s.gateway.createCustomer).toHaveBeenCalledTimes(1);
  });
  it("rotates a checkout operation only after confirmed expiry", async () => {
    const s = await setup();
    await s.billing.checkout(s.identity);
    vi.mocked(s.gateway.checkout).mockResolvedValue({
      ...s.state.session,
      status: "expired",
      url: null,
    });
    await s.billing.checkout(s.identity);
    const calls = vi.mocked(s.gateway.createCheckout).mock.calls;
    expect(calls[0]![1]).not.toEqual(calls[1]![1]);
  });
  it("blocks another checkout when a previous complete session is still pending", async () => {
    const s = await setup();
    await s.billing.checkout(s.identity);
    s.state.session.status = "complete";
    await expect(s.billing.checkout(s.identity)).rejects.toMatchObject({
      code: "PAYMENT_PENDING",
    });
  });
  it("grants paid current access and preserves access until a scheduled cancellation", async () => {
    const s = await setup();
    await s.billing.checkout(s.identity);
    s.state.subscriptions = [{ ...active(), cancelAtPeriodEnd: true }];
    expect(await s.billing.status(s.identity)).toMatchObject({
      entitled: true,
      cancelAtPeriodEnd: true,
    });
    await expect(s.billing.checkout(s.identity)).rejects.toMatchObject({
      code: "SUBSCRIPTION_EXISTS",
    });
  });
  it.each([
    "past_due",
    "unpaid",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "trialing",
    "paused",
  ])("does not grant paid entitlement for %s", async (status) => {
    const s = await setup();
    await s.billing.checkout(s.identity);
    s.state.subscriptions = [{ ...active(), status }];
    expect((await s.billing.status(s.identity)).entitled).toBe(false);
  });
  it("rejects unpaid, wrong-price, expired or multiple subscriptions", async () => {
    const s = await setup();
    await s.billing.checkout(s.identity);
    for (const subscription of [
      { ...active(), paid: false },
      { ...active(), eligible: false },
      { ...active(), periodEnd: 1 },
    ]) {
      s.state.subscriptions = [subscription];
      expect((await s.billing.status(s.identity)).entitled).toBe(false);
    }
    s.state.subscriptions = [active(), { ...active(), id: "sub_second" }];
    expect(await s.billing.status(s.identity)).toMatchObject({
      entitled: false,
      needsReview: true,
    });
  });
  it("handles duplicate and delayed events using current Stripe state", async () => {
    const s = await setup();
    await s.billing.checkout(s.identity);
    s.state.subscriptions = [active()];
    const event = {
      id: "evt_paid_fixture",
      type: "invoice.paid",
      customerId: s.customerId,
    };
    expect((await s.billing.event(event)).outcome).toBe("reconciled");
    expect((await s.billing.event(event)).outcome).toBe("duplicate");
    s.state.subscriptions = [{ ...active(), status: "canceled" }];
    await s.billing.event({
      ...event,
      id: "evt_old_update_fixture",
      type: "customer.subscription.updated",
    });
    expect((await s.billing.status(s.identity)).entitled).toBe(false);
  });
  it("retains risk holds across later paid events and never maps unknown customers by metadata/email", async () => {
    const s = await setup();
    await s.billing.checkout(s.identity);
    s.state.subscriptions = [active()];
    expect(
      (
        await s.billing.event({
          id: "evt_unknown",
          type: "invoice.paid",
          customerId: "cus_unknown",
        })
      ).outcome,
    ).toBe("unmapped");
    await s.billing.event({
      id: "evt_risk_fixture",
      type: "charge.refunded",
      customerId: s.customerId,
      riskReason: "refund_review",
    });
    await s.billing.event({
      id: "evt_after_risk",
      type: "invoice.paid",
      customerId: s.customerId,
    });
    expect(await s.billing.status(s.identity)).toMatchObject({
      entitled: false,
      needsReview: true,
    });
  });
  it("rolls back event receipt on provider failure so Stripe can retry", async () => {
    const s = await setup();
    await s.billing.checkout(s.identity);
    vi.mocked(s.gateway.subscriptions).mockRejectedValueOnce(
      new Error("Unavailable"),
    );
    const event = {
      id: "evt_retry_fixture",
      type: "invoice.paid",
      customerId: s.customerId,
    };
    await expect(s.billing.event(event)).rejects.toThrow("Unavailable");
    expect(
      await query(
        database.db,
        "SELECT event_id FROM cgt.stripe_events WHERE event_id=$1",
        [event.id],
      ),
    ).toHaveLength(0);
    expect((await s.billing.event(event)).outcome).toBe("reconciled");
  });
});

describe("Stripe webhook verification", () => {
  const secret = "synthetic-webhook-secret-not-a-provider-credential";
  const client = stripeClient("synthetic-test-fixture");
  const gateway = new StripeGateway(client, config, "bpc_fixture");
  const payload = (overrides = {}) =>
    JSON.stringify({
      id: "evt_signed_fixture",
      object: "event",
      type: "invoice.paid",
      api_version: STRIPE_API_VERSION,
      livemode: false,
      data: {
        object: {
          id: "in_fixture",
          object: "invoice",
          customer: "cus_fixture",
        },
      },
      ...overrides,
    });
  const sign = (raw: string, timestamp?: number) =>
    client.webhooks.generateTestHeaderString({
      payload: raw,
      secret,
      timestamp,
    });
  it("accepts the exact signed raw body and rejects tampering, stale signatures and wrong contexts", async () => {
    const raw = payload();
    expect(await gateway.event(raw, sign(raw), secret)).toMatchObject({
      customerId: "cus_fixture",
    });
    await expect(
      gateway.event(raw + " ", sign(raw), secret),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
    await expect(
      gateway.event(raw, sign(raw, 1), secret),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
    for (const change of [
      { livemode: true },
      { account: "acct_other" },
      { api_version: "2026-03-25.dahlia" },
    ]) {
      const invalid = payload(change);
      await expect(
        gateway.event(invalid, sign(invalid), secret),
      ).rejects.toMatchObject({ code: "INVALID_EVENT_CONTEXT" });
    }
  });
  it("rejects unsigned and oversized requests without processing an event", async () => {
    const s = await setup();
    const handler = createStripeWebhookHandler(s.billing, gateway, secret);
    expect(
      (
        await handler(
          new Request(config.origin, { method: "POST", body: payload() }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handler(
          new Request(config.origin, {
            method: "POST",
            body: "x".repeat(1024 * 1024 + 1),
            headers: { "stripe-signature": "invalid" },
          }),
        )
      ).status,
    ).toBe(413);
  });
});

it("reconciles missed lifecycle changes in bounded operator batches and preserves risk holds", async () => {
  const s = await setup();
  await query(
    database.db,
    "UPDATE cgt.billing_accounts SET reconciled_at=now()",
  );
  await s.billing.checkout(s.identity);
  s.state.subscriptions = [active()];
  await query(
    database.db,
    "UPDATE cgt.billing_accounts SET reconciled_at=now()-interval '1 day' WHERE owner_id=$1",
    [s.identity.ownerId],
  );
  const first = await s.billing.reconcileBatch();
  expect(first.updated).toBeGreaterThan(0);
  expect((await s.billing.status(s.identity)).entitled).toBe(true);
  s.state.subscriptions[0]!.paid = false;
  s.state.subscriptions[0]!.status = "past_due";
  await query(
    database.db,
    "UPDATE cgt.billing_accounts SET reconciled_at=now()-interval '1 day' WHERE owner_id=$1",
    [s.identity.ownerId],
  );
  await s.billing.reconcileBatch();
  const rows = await query<{ entitled: boolean }>(
    database.db,
    "SELECT entitled FROM cgt.billing_accounts WHERE owner_id=$1",
    [s.identity.ownerId],
  );
  expect(rows[0]?.entitled).toBe(false);
  await query(
    database.db,
    "UPDATE cgt.billing_accounts SET risk_hold=true,risk_reason='qualification test',reconciled_at=now()-interval '1 day' WHERE owner_id=$1",
    [s.identity.ownerId],
  );
  s.state.subscriptions = [active()];
  expect((await s.billing.reconcileBatch()).needsReview).toBeGreaterThan(0);
  expect((await s.billing.status(s.identity)).entitled).toBe(false);
});
