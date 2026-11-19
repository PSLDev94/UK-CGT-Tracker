"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";
import { authHref } from "./return-path";
import {
  billingUrl,
  reportUrl,
  type ReportDestination,
} from "@/domain/reports/destination";
import type { ReportIssue } from "@/domain/reports/eligibility";
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
type Outcome = "returned" | "cancelled" | "portal" | null;
type Action = "status" | "checkout" | "portal";
type Status = BillingStatus & {
  returnReport?: ReportDestination | null;
  checkedReport?: ReportDestination | null;
  reportIssue?: ReportIssue | null;
};

// Only a random navigation namespace is kept in the tab. The selected year and
// document stay in an owner-bound HttpOnly cookie on the billing API.
function billingTab() {
  try {
    const key = "cgt-billing-tab";
    const existing = sessionStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
    const tab = crypto.randomUUID();
    sessionStorage.setItem(key, tab);
    return tab;
  } catch {
    // Private browsing without session storage still supports one return per browser.
    return undefined;
  }
}

export function BillingPanel({
  target,
  outcome,
}: {
  target: ReportDestination | null;
  outcome: Outcome;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<Action | null>("status");
  const [error, setError] = useState("");
  const [signIn, setSignIn] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const destination = target ?? (outcome ? status?.returnReport : null);
  const targetYear = target?.year,
    targetFormat = target?.format;
  const statusTarget = useCallback(
    () => ({
      ...(targetYear && targetFormat
        ? { year: targetYear, format: targetFormat }
        : {}),
      ...(outcome ? { returning: true } : {}),
    }),
    [targetYear, targetFormat, outcome],
  );
  const acceptStatus = useCallback(
    (confirmed: Status) => {
      setStatus(confirmed);
      if (
        confirmed.returnReport &&
        outcome &&
        (outcome === "cancelled" || outcome === "portal" || confirmed.entitled)
      ) {
        router.replace(reportUrl(confirmed.returnReport, outcome));
      }
    },
    [outcome, router],
  );
  const showError = useCallback((e: unknown) => {
    setSignIn(e instanceof ApiError && [401, 403].includes(e.status));
    setError(
      e instanceof ApiError && e.status !== 0
        ? e.message
        : "Billing could not be confirmed. Refresh the status before trying again.",
    );
  }, []);
  const load = useCallback(
    async (action: Action, report?: ReportDestination | null) => {
      if (controller.current && !controller.current.signal.aborted) return;
      const request = new AbortController();
      controller.current = request;
      try {
        const tab = billingTab();
        if (action === "status") {
          const confirmed = await api<Status>(
            "/api/v2/billing",
            { action, tab, ...statusTarget() },
            request.signal,
          );
          if (request.signal.aborted) return;
          acceptStatus(confirmed);
        } else {
          const result = await api<{ url: string }>(
            "/api/v2/billing",
            { action, tab, ...report },
            request.signal,
          );
          const url = new URL(result.url);
          if (
            url.origin !==
            (action === "checkout"
              ? "https://checkout.stripe.com"
              : "https://billing.stripe.com")
          )
            throw new Error("Unexpected destination");
          window.location.assign(url.href);
        }
      } catch (e) {
        if (request.signal.aborted) return;
        if (
          action === "checkout" &&
          report &&
          e instanceof ApiError &&
          [
            "REPORT_TOO_LARGE",
            "REPORT_NEEDS_REFRESH",
            "REPORT_UNAVAILABLE",
            "NO_DISPOSALS",
            "REPORT_INCOMPLETE",
            "PENDING_IMPORTS",
          ].includes(e.code)
        ) {
          const issue = {
            code: e.code as ReportIssue["code"],
            message: e.message,
          };
          setStatus(
            (previous) =>
              previous && {
                ...previous,
                checkedReport: report,
                reportIssue: issue,
              },
          );
        } else showError(e);
      } finally {
        if (controller.current === request) {
          controller.current = null;
          if (!request.signal.aborted) setBusy(null);
        }
      }
    },
    [acceptStatus, showError, statusTarget],
  );
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    api<Status>(
      "/api/v2/billing",
      { action: "status", tab: billingTab(), ...statusTarget() },
      request.signal,
    )
      .then((confirmed) => {
        if (!request.signal.aborted) acceptStatus(confirmed);
      })
      .catch((e) => {
        if (!request.signal.aborted) showError(e);
      })
      .finally(() => {
        if (controller.current === request) {
          controller.current = null;
          if (!request.signal.aborted) setBusy(null);
        }
      });
    return () => controller.current?.abort();
  }, [acceptStatus, showError, statusTarget]);
  function userAction(action: Action, report?: ReportDestination | null) {
    if (controller.current && !controller.current.signal.aborted) return;
    setBusy(action);
    setError("");
    setSignIn(false);
    void load(action, report);
  }
  const awaiting =
    outcome === "returned" && status?.status === "none" && !status.needsReview;
  const canCheckout =
    status &&
    (!destination ||
      (status.checkedReport?.year === destination.year &&
        status.checkedReport.format === destination.format &&
        !status.reportIssue)) &&
    !awaiting &&
    !status.needsReview &&
    ["none", "canceled", "incomplete_expired"].includes(status.status);
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Your subscription</h1>
        <p className="mt-2 text-gray-600">
          Download PDF summaries and matching evidence with CGT Tracker annual
          reports.
        </p>
      </div>
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-7">
        <p className="text-2xl font-bold tabular-nums">
          {ANNUAL_REPORT_PRICE}{" "}
          <span className="text-base font-normal">per year</span>
        </p>
        <p>
          Imports, calculations and CSV evidence are free. The subscription
          renews annually until cancelled.
        </p>
        <p className="text-sm text-gray-600">
          Staging uses Stripe test payments. No real money is charged.
        </p>
        {destination && (
          <p className="font-medium">
            {destination.year} ·{" "}
            {destination.format === "summary"
              ? "CGT summary PDF"
              : "Calculation evidence PDF"}
          </p>
        )}
        {destination && status?.reportIssue && (
          <Notice tone="warning">
            {status.reportIssue.message}{" "}
            {status.reportIssue.code === "REPORT_INCOMPLETE" && (
              <Link className="underline" href={`/dashboard/calculations?year=${destination.year}`}>Review the calculation for {destination.year}</Link>
            )}
            {status.reportIssue.code === "NO_DISPOSALS" && (
              <Link className="underline" href={`/dashboard/reports?year=${destination.year}#report-csv`}>
                Review the year and free CSV evidence
              </Link>
            )}
            {status.reportIssue.code === "REPORT_TOO_LARGE" && (
              <>
                <Link
                  className="underline"
                  href={`/dashboard/reports?year=${destination.year}#report-csv`}
                >
                  Free CSV evidence
                </Link>
                {" · "}
                <Link
                  className="underline"
                  href={reportUrl({
                    year: destination.year,
                    format: "summary",
                  })}
                >
                  Summary PDF{" "}
                  {status.entitled
                    ? "(included)"
                    : `(${ANNUAL_REPORT_PRICE}/year)`}
                </Link>
              </>
            )}
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {signIn && (
          <Link
            className="text-blue-700 underline"
            href={authHref(
              "/login",
              destination ? billingUrl(destination) : "/billing",
            )}
          >
            Sign in to continue
          </Link>
        )}
        {busy === "status" && <Notice>Checking your subscription…</Notice>}
        {status && (
          <>
            <h2 className="text-lg font-semibold">
              {awaiting
                ? "Awaiting payment confirmation"
                : (labels[status.status] ?? "Subscription status unavailable")}
            </h2>
            {outcome === "cancelled" && (
              <Notice>
                Checkout cancelled. Your saved calculation is still available.
              </Notice>
            )}
            {awaiting && (
              <Notice>
                Stripe has returned you to CGT Tracker. Refresh the status to
                check whether your PDF access is ready.
              </Notice>
            )}
            {status.entitled && (
              <Notice tone="success">Your PDF access is active.</Notice>
            )}
            {status.periodEnd && (
              <p>
                {status.cancelAtPeriodEnd
                  ? "Scheduled to end"
                  : status.entitled
                    ? "Current paid period ends"
                    : "Current billing period ends"}{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "long",
                  timeZone: "Europe/London",
                }).format(new Date(status.periodEnd))}
                .
              </p>
            )}
            {status.needsReview ? (
              <Notice tone="warning">
                We need to review this subscription. Your records and CSV remain
                available.{" "}
                <Link
                  className="underline"
                  href={
                    destination
                      ? `/dashboard/contact?${new URLSearchParams({ topic: "billing", year: destination.year, format: destination.format })}`
                      : "/dashboard/contact?topic=billing"
                  }
                >
                  Contact billing support
                </Link>
                .
              </Notice>
            ) : (
              ["past_due", "incomplete", "unpaid", "paused"].includes(
                status.status,
              ) && (
                <Notice tone="warning">
                  Review your payment details in Stripe, then refresh billing
                  status here.
                </Notice>
              )
            )}
            <div className="actions">
              {canCheckout && (
                <Button
                  busy={busy === "checkout"}
                  disabled={!!busy}
                  onClick={() => userAction("checkout", destination)}
                >
                  Open test checkout
                </Button>
              )}
              {status.canManage &&
                (!canCheckout || status.status === "canceled") && (
                  <Button
                    variant="secondary"
                    busy={busy === "portal"}
                    disabled={!!busy}
                    onClick={() => userAction("portal", destination)}
                  >
                    Manage subscription
                  </Button>
                )}
            </div>
          </>
        )}
      </section>
      <div className="actions">
        <Button
          variant="secondary"
          busy={busy === "status"}
          disabled={!!busy}
          onClick={() => userAction("status")}
        >
          Refresh billing status
        </Button>
        <Link
          className="text-blue-700 underline"
          href={destination ? reportUrl(destination) : "/dashboard/reports"}
        >
          {destination ? `Back to ${destination.year} report` : "View reports"}
        </Link>
      </div>
    </div>
  );
}
