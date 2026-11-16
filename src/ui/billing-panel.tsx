"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BillingStatus } from "@/server/billing";
import { api, ApiError } from "./api";
import { Button, Notice } from "./primitives";

const labels: Record<string, string> = {
  none: "No subscription",
  active: "Active",
  past_due: "Payment overdue",
  unpaid: "Payment unpaid",
  canceled: "Cancelled",
  incomplete: "Payment incomplete",
  incomplete_expired: "Checkout expired",
  trialing: "Trial",
  paused: "Paused",
  needs_review: "Needs a billing review",
};

export function BillingPanel() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState<"status" | "checkout" | "portal" | null>(
    "status",
  );
  const [error, setError] = useState("");
  const [signIn, setSignIn] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const run = useCallback(async (action: "status" | "checkout" | "portal") => {
    if (pending.current && !controller.current?.signal.aborted) return;
    pending.current = true;
    const request = new AbortController();
    controller.current = request;
    setBusy(action);
    setError("");
    setSignIn(false);
    try {
      if (action === "status")
        setStatus(
          await api<BillingStatus>(
            "/api/v2/billing",
            { action },
            request.signal,
          ),
        );
      else {
        const result = await api<{ url: string }>(
          "/api/v2/billing",
          { action },
          request.signal,
        );
        const destination = new URL(result.url);
        if (
          destination.origin !==
          (action === "checkout"
            ? "https://checkout.stripe.com"
            : "https://billing.stripe.com")
        )
          throw new Error("Unexpected destination");
        window.location.assign(destination.href);
      }
    } catch (failure) {
      if (request.signal.aborted) return;
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) {
        setStatus(null);
        setSignIn(true);
      }
      setError(
        failure instanceof ApiError && failure.status !== 0
          ? failure.message
          : "Billing could not be confirmed. Refresh the status before trying again; a checkout request may have reached Stripe.",
      );
    } finally {
      if (controller.current === request) {
        if (!request.signal.aborted) setBusy(null);
        pending.current = false;
      }
    }
  }, []);
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    pending.current = true;
    api<BillingStatus>("/api/v2/billing", { action: "status" }, request.signal)
      .then((result) => {
        if (!request.signal.aborted) setStatus(result);
      })
      .catch((failure) => {
        if (request.signal.aborted) return;
        setSignIn(
          failure instanceof ApiError && [401, 403].includes(failure.status),
        );
        setError(
          failure instanceof ApiError && failure.status !== 0
            ? failure.message
            : "Billing could not be confirmed. Refresh the status before trying again; a checkout request may have reached Stripe.",
        );
      })
      .finally(() => {
        if (controller.current === request) {
          pending.current = false;
          if (!request.signal.aborted) setBusy(null);
        }
      });
    return () => request.abort();
  }, []);
  const canCheckout =
    status &&
    !status.needsReview &&
    ["none", "canceled", "incomplete_expired"].includes(status.status);
  return (
    <section className="auth-wrap panel" aria-labelledby="billing-title">
      <p className="eyebrow">RELAUNCH PREVIEW · BILLING TEST</p>
      <h1 id="billing-title">Your subscription.</h1>
      <p>
        This preview uses Stripe test payments. No real money is charged and
        tax-filing reports are not yet available.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {signIn && (
        <p>
          <Link href="/account/sign-in">Sign in with a verified email</Link> to
          manage your subscription.
        </p>
      )}
      {busy === "status" && <Notice>Checking your subscription…</Notice>}
      {status && (
        <>
          <h2>{labels[status.status] ?? "Billing status unavailable"}</h2>
          <p>
            Annual plan: <strong>£49 per year</strong>. This amount is used only
            for sandbox testing.
          </p>
          <p>
            {status.entitled
              ? "Test payment confirmed."
              : "No paid access is currently confirmed."}{" "}
            Returning from checkout does not confirm a payment; refresh to check
            its status.
          </p>
          {status.periodEnd && (
            <p>
              {status.cancelAtPeriodEnd
                ? "Scheduled to end"
                : "Current billing period ends"}{" "}
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "long",
                timeZone: "Europe/London",
              }).format(new Date(status.periodEnd))}
              .
            </p>
          )}
          {status.needsReview && (
            <Notice tone="warning">
              Billing needs a review before another checkout can start. Your
              saved investment records remain available.
            </Notice>
          )}
          <div className="actions">
            {canCheckout && (
              <Button
                onClick={() => void run("checkout")}
                busy={busy === "checkout"}
                disabled={busy !== null}
              >
                Open test checkout
              </Button>
            )}
            {status.canManage && (
              <Button
                variant="secondary"
                onClick={() => void run("portal")}
                busy={busy === "portal"}
                disabled={busy !== null}
              >
                Manage subscription
              </Button>
            )}
          </div>
          {status.canManage && (
            <p className="muted">
              Manage payment details and cancellation securely in Stripe.
            </p>
          )}
        </>
      )}
      <div className="actions">
        <Button
          variant="secondary"
          busy={busy === "status"}
          disabled={busy !== null}
          onClick={() => void run("status")}
        >
          Refresh billing status
        </Button>
        <Link href="/workspace">Back to workspace</Link>
      </div>
    </section>
  );
}
