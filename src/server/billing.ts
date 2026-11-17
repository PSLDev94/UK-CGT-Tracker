import { randomUUID } from "node:crypto";
import { assertIdentity, type Identity } from "./identity";
import { query, type Database, type Connection } from "./database";
import { AppError } from "./errors";

export interface BillingConfig {
  origin: string;
  accountId: string;
  priceId: string;
  livemode: boolean;
}
export interface SubscriptionState {
  id: string;
  status: string;
  eligible: boolean;
  paid: boolean;
  periodEnd: number;
  cancelAtPeriodEnd: boolean;
}
export interface CheckoutState {
  id: string;
  status: "open" | "complete" | "expired";
  url: string | null;
  subscriptionId?: string | null;
}
export interface BillingEvent {
  id: string;
  type: string;
  customerId: string | null;
  riskReason?: string;
}
export interface BillingGateway {
  createCustomer(key: string): Promise<string>;
  subscriptions(customerId: string): Promise<SubscriptionState[]>;
  createCheckout(customerId: string, key: string): Promise<CheckoutState>;
  checkout(id: string): Promise<CheckoutState>;
  portal(customerId: string): Promise<string>;
}
interface BillingRow {
  owner_id: string;
  stripe_customer_id: string | null;
  stripe_account_id: string;
  livemode: boolean;
  customer_operation: string;
  customer_started_at: Date | string;
  checkout_operation: string;
  checkout_started_at: Date | string;
  checkout_session_id: string | null;
  risk_hold: boolean;
}
export interface BillingStatus {
  status: string;
  entitled: boolean;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  needsReview: boolean;
  canManage: boolean;
  testMode: boolean;
}

export class Billing {
  constructor(
    private readonly db: Database,
    private readonly gateway: BillingGateway,
    private readonly config: BillingConfig,
  ) {}

  private checkRow(row: BillingRow) {
    if (
      row.stripe_account_id !== this.config.accountId ||
      row.livemode !== this.config.livemode
    ) {
      throw new AppError(
        409,
        "BILLING_ENVIRONMENT_MISMATCH",
        "Billing needs a support review before continuing.",
      );
    }
  }
  private async locked<T>(
    owner: string,
    work: (tx: Connection, row: BillingRow) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction().execute(async (tx) => {
      const [row] = await query<BillingRow>(
        tx,
        "SELECT * FROM cgt.billing_accounts WHERE owner_id=$1 FOR UPDATE",
        [owner],
      );
      if (!row)
        throw new AppError(
          404,
          "BILLING_NOT_FOUND",
          "No billing account is connected yet.",
        );
      this.checkRow(row);
      return work(tx, row);
    });
  }
  private retryWindow(start: Date | string) {
    // Stripe may prune idempotency keys after 24 hours. An ambiguous older
    // operation requires reconciliation, never a blind new customer/checkout.
    if (Date.now() - new Date(start).getTime() > 23 * 3600000) {
      throw new AppError(
        409,
        "BILLING_RECONCILIATION_REQUIRED",
        "A previous billing request needs a support review. No new checkout was created.",
      );
    }
  }
  private async ensureCustomer(identity: Identity) {
    assertIdentity(identity);
    // This insert commits before any network call and survives provider/DB errors.
    await query(
      this.db,
      `INSERT INTO cgt.billing_accounts(owner_id,stripe_account_id,livemode,subscription_status)
      VALUES($1,$2,$3,'none') ON CONFLICT(owner_id) DO NOTHING`,
      [identity.ownerId, this.config.accountId, this.config.livemode],
    );
    return this.locked(identity.ownerId, async (tx, row) => {
      if (row.stripe_customer_id) return row.stripe_customer_id;
      this.retryWindow(row.customer_started_at);
      const customerId = await this.gateway.createCustomer(
        `cgt-customer-${row.customer_operation}`,
      );
      await query(
        tx,
        "UPDATE cgt.billing_accounts SET stripe_customer_id=$2 WHERE owner_id=$1",
        [identity.ownerId, customerId],
      );
      return customerId;
    });
  }
  private async reconcile(
    tx: Connection,
    row: BillingRow,
  ): Promise<{ status: BillingStatus; subscriptions: SubscriptionState[] }> {
    const subscriptions = row.stripe_customer_id
      ? await this.gateway.subscriptions(row.stripe_customer_id)
      : [];
    const current = subscriptions.filter(
      (s) => !["canceled", "incomplete_expired"].includes(s.status),
    );
    // Multiple subscriptions must be resolved, not hidden behind a random winner.
    const candidate = current.length === 1 ? current[0] : undefined;
    const entitled =
      !row.risk_hold &&
      !!candidate &&
      candidate.status === "active" &&
      candidate.eligible &&
      candidate.paid &&
      candidate.periodEnd * 1000 > Date.now();
    const needsReview =
      row.risk_hold ||
      current.length > 1 ||
      (!!candidate && !candidate.eligible);
    const status = needsReview
      ? "needs_review"
      : (candidate?.status ?? (subscriptions.length ? "canceled" : "none"));
    const periodEnd = candidate?.periodEnd
      ? new Date(candidate.periodEnd * 1000).toISOString()
      : null;
    await query(
      tx,
      `UPDATE cgt.billing_accounts SET stripe_subscription_id=$2, subscription_status=$3,
      current_period_end=$4, cancel_at_period_end=$5, entitled=$6, reconciled_at=now() WHERE owner_id=$1`,
      [
        row.owner_id,
        candidate?.id ?? null,
        status,
        periodEnd,
        candidate?.cancelAtPeriodEnd ?? false,
        entitled,
      ],
    );
    return {
      subscriptions,
      status: {
        status,
        entitled,
        periodEnd,
        cancelAtPeriodEnd: candidate?.cancelAtPeriodEnd ?? false,
        needsReview,
        canManage: !!row.stripe_customer_id,
        testMode: !this.config.livemode,
      },
    };
  }
  /** Operator-only batch entry point: no public HTTP route or user-supplied owner. */
  async reconcileBatch(afterOwner = "", limit = 50) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new Error("Invalid reconciliation batch size");
    const rows = await query<{ owner_id: string }>(
      this.db,
      `SELECT owner_id FROM cgt.billing_accounts
      WHERE stripe_account_id=$1 AND livemode=$2 AND stripe_customer_id IS NOT NULL AND owner_id>$3
      AND (reconciled_at IS NULL OR reconciled_at<now()-interval '15 minutes')
      ORDER BY owner_id LIMIT $4`,
      [this.config.accountId, this.config.livemode, afterOwner, limit],
    );
    let updated = 0,
      failed = 0,
      needsReview = 0;
    for (const row of rows) {
      try {
        const result = await this.locked(row.owner_id, (tx, current) =>
          this.reconcile(tx, current),
        );
        updated++;
        if (result.status.needsReview) needsReview++;
      } catch {
        failed++;
      }
    }
    return {
      checked: rows.length,
      updated,
      failed,
      needsReview,
      nextCursor: rows.length === limit ? rows.at(-1)!.owner_id : null,
    };
  }

  async status(identity: Identity): Promise<BillingStatus> {
    assertIdentity(identity);
    const rows = await query(
      this.db,
      "SELECT owner_id FROM cgt.billing_accounts WHERE owner_id=$1",
      [identity.ownerId],
    );
    if (!rows.length)
      return {
        status: "none",
        entitled: false,
        periodEnd: null,
        cancelAtPeriodEnd: false,
        needsReview: false,
        canManage: false,
        testMode: !this.config.livemode,
      };
    return this.locked(
      identity.ownerId,
      async (tx, row) => (await this.reconcile(tx, row)).status,
    );
  }
  async checkout(identity: Identity): Promise<{ url: string }> {
    await this.ensureCustomer(identity);
    for (let retry = 0; retry < 2; retry++) {
      const result = await this.locked(identity.ownerId, async (tx, row) => {
        const { status, subscriptions } = await this.reconcile(tx, row);
        if (
          status.needsReview ||
          subscriptions.some(
            (s) => !["canceled", "incomplete_expired"].includes(s.status),
          )
        ) {
          throw new AppError(
            409,
            "SUBSCRIPTION_EXISTS",
            "Manage your existing subscription instead of starting another one.",
          );
        }
        if (row.checkout_session_id) {
          const existing = await this.gateway.checkout(row.checkout_session_id);
          if (existing.status === "open" && existing.url)
            return { url: existing.url };
          if (
            existing.status === "complete" &&
            !subscriptions.some(
              (s) =>
                s.id === existing.subscriptionId &&
                ["canceled", "incomplete_expired"].includes(s.status),
            )
          )
            throw new AppError(
              409,
              "PAYMENT_PENDING",
              "Your previous checkout is being reconciled. Check billing again before starting another payment.",
            );
          // Commit the new durable operation before contacting Stripe on the next pass.
          await query(
            tx,
            `UPDATE cgt.billing_accounts SET checkout_operation=$2,checkout_started_at=now(),checkout_session_id=NULL WHERE owner_id=$1`,
            [identity.ownerId, randomUUID()],
          );
          return null;
        }
        this.retryWindow(row.checkout_started_at);
        const checkout = await this.gateway.createCheckout(
          row.stripe_customer_id!,
          `cgt-checkout-${row.checkout_operation}`,
        );
        if (checkout.status !== "open" || !checkout.url)
          throw new AppError(
            409,
            "PAYMENT_PENDING",
            "Check billing again before starting another payment.",
          );
        await query(
          tx,
          "UPDATE cgt.billing_accounts SET checkout_session_id=$2 WHERE owner_id=$1",
          [identity.ownerId, checkout.id],
        );
        return { url: checkout.url };
      });
      if (result) return result;
    }
    throw new AppError(
      409,
      "BILLING_BUSY",
      "Billing changed during this request. Try again.",
    );
  }
  async portal(identity: Identity): Promise<{ url: string }> {
    assertIdentity(identity);
    return this.locked(identity.ownerId, async (_tx, row) => {
      if (!row.stripe_customer_id)
        throw new AppError(
          404,
          "BILLING_NOT_FOUND",
          "No Stripe customer is connected yet.",
        );
      return { url: await this.gateway.portal(row.stripe_customer_id) };
    });
  }
  async event(event: BillingEvent) {
    const [account] = event.customerId
      ? await query<{ owner_id: string }>(
          this.db,
          "SELECT owner_id FROM cgt.billing_accounts WHERE stripe_customer_id=$1 AND stripe_account_id=$2 AND livemode=$3",
          [event.customerId, this.config.accountId, this.config.livemode],
        )
      : [];
    if (!account) return { received: true, outcome: "unmapped" };
    return this.locked(account.owner_id, async (tx, row) => {
      const existing = await query(
        tx,
        "SELECT event_id FROM cgt.stripe_events WHERE stripe_account_id=$1 AND livemode=$2 AND event_id=$3",
        [this.config.accountId, this.config.livemode, event.id],
      );
      if (existing.length) return { received: true, outcome: "duplicate" };
      if (event.riskReason) {
        // Refunds/disputes/fraud require explicit review; late ordinary events
        // cannot erase this hold or grant access again.
        await query(
          tx,
          "UPDATE cgt.billing_accounts SET risk_hold=true,risk_reason=$2 WHERE owner_id=$1",
          [row.owner_id, event.riskReason],
        );
        row.risk_hold = true;
      }
      await this.reconcile(tx, row);
      await query(
        tx,
        "INSERT INTO cgt.stripe_events(stripe_account_id,livemode,event_id,event_type) VALUES($1,$2,$3,$4)",
        [this.config.accountId, this.config.livemode, event.id, event.type],
      );
      return { received: true, outcome: "reconciled" };
    });
  }
}
