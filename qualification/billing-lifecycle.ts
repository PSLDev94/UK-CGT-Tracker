import { PDFDocument } from "pdf-lib";
import { expect } from "vitest";
import { Billing } from "../src/server/billing";
import { createStripeWebhookHandler } from "../src/server/billing-api";
import type { Database } from "../src/server/database";
import type { Identity } from "../src/server/identity";
import { createReportHandler } from "../src/server/reports-api";
import { STRIPE_API_VERSION } from "../src/server/stripe-gateway";
import type { Workspace } from "../src/server/workspace";
import { reportPageText } from "../tests/helpers/pdf-text";
import { config, stripeFixture } from "../tests/helpers/stripe-fixture";
import sandbox from "../tests/fixtures/billing-sandbox.json";

/** Exercise the actual SDK, webhook, persisted account and report bytes. Only
 * Stripe's HTTP responses, session reader and request budget are fixtures. */
export async function qualifyBillingLifecycle(
  db: Database,
  workspace: Workspace,
  owner: Identity,
  runId: string,
) {
  const { gateway, state } = stripeFixture();
  const billing = new Billing(db, gateway, config);
  const signingSecret = "fixture-signing-secret";
  const webhook = createStripeWebhookHandler(billing, gateway, signingSecret);
  const report = createReportHandler({
    origin: config.origin,
    readSession: async () => ({
      user: { id: owner.ownerId, emailVerified: true },
      session: { expiresAt: new Date(Date.now() + 60000) },
    }),
    consume: async () => {},
    snapshot: (identity, id) => workspace.reportSnapshot(identity, id),
    sources: (identity, keys) => workspace.reportSources(identity, keys),
    entitled: async (identity) => (await billing.status(identity)).entitled,
  });
  async function deliver(
    id: string,
    type: string,
    object: object,
    outcome = "reconciled",
  ) {
    const raw = JSON.stringify({
      id,
      type,
      object: "event",
      api_version: STRIPE_API_VERSION,
      livemode: false,
      account: config.accountId,
      data: { object },
    });
    const response = await webhook(
      new Request(config.origin + "/api/v2/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": gateway.client.webhooks.generateTestHeaderString({
            payload: raw,
            secret: signingSecret,
          }),
        },
        body: raw,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome });
  }
  async function checkReports(entitled: boolean, status: string) {
    expect(await billing.reportAccess(owner)).toMatchObject({
      entitled,
      status,
    });
    for (const kind of ["csv", "summary", "evidence"]) {
      const response = await report(
        new Request(config.origin + "/api/v2/reports", {
          method: "POST",
          headers: {
            origin: config.origin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ runId, kind }),
        }),
      );
      if (kind === "csv") {
        expect(response.status).toBe(200);
        expect(await response.text()).toContain("5.25");
      } else if (entitled) {
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/pdf");
        expect(
          reportPageText(await PDFDocument.load(await response.arrayBuffer())),
        ).toContain("5.25");
      } else {
        expect(response.status).toBe(402);
        expect(await response.json()).toMatchObject({
          error: { code: "SUBSCRIPTION_REQUIRED" },
        });
      }
    }
  }
  async function replay(
    name: keyof typeof sandbox,
    id: string,
    entitled: boolean,
  ) {
    const recorded = sandbox[name];
    state.subscription.status = recorded.subscriptionStatus;
    Object.assign(state.invoice, recorded.invoice);
    await deliver(id, recorded.event, state.invoice);
    await checkReports(entitled, recorded.subscriptionStatus);
  }

  state.hasSubscription = false;
  await billing.checkout(owner);
  await checkReports(false, "none");
  state.hasSubscription = true;
  await replay("authenticationRequired", "evt_3ds_required", false);
  await replay("authenticationFailed", "evt_3ds_failed", false);
  await replay("authenticationCompleted", "evt_3ds_paid", true);
  state.subscription.items.data[0]!.current_period_end += 365 * 86400;
  await replay("annualRenewal", "evt_renewal_paid", true);
  await replay("renewalDeclined", "evt_renewal_failed", false);
  const failedInvoice = { ...state.invoice };
  await replay("renewalRecovered", "evt_renewal_recovered", true);
  await deliver(
    "evt_renewal_failed",
    "invoice.payment_failed",
    failedInvoice,
    "duplicate",
  );
  await deliver("evt_delayed_failure", "invoice.payment_failed", failedInvoice);
  await checkReports(true, "active");
  state.subscription.cancel_at =
    state.subscription.items.data[0]!.current_period_end;
  await deliver(
    "evt_cancel_pending",
    "customer.subscription.updated",
    state.subscription,
  );
  expect(await billing.reportAccess(owner)).toMatchObject({
    cancelAtPeriodEnd: true,
  });
  await checkReports(true, "active");

  state.subscriptionsUnavailable = true;
  const dispute = {
    id: "dp_fixture",
    object: "dispute",
    charge: state.charge.id,
  };
  await deliver("evt_dispute", "charge.dispute.created", dispute);
  await checkReports(false, "needs_review");
  state.subscriptionsUnavailable = false;
  await deliver("evt_dispute", "charge.dispute.created", dispute, "duplicate");
  await deliver("evt_late_paid", "invoice.paid", state.invoice);
  await checkReports(false, "needs_review");
}
