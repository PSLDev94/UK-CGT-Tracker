"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Download } from "lucide-react";
import { api, ApiError, workspaceApi } from "./api";
import type { Overview } from "./workspace-types";
import type { BillingStatus } from "@/server/billing";
import { Notice, Button, SelectField, money } from "./primitives";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";
import { billingUrl, type PdfFormat } from "../domain/reports/destination";
import { displayDate, netOutcome } from "./format";
import type { ReportKind } from "../domain/reports/report";

const cards = [
  {
    kind: "summary",
    title: "CGT Summary PDF",
    text: "A short statement of your gains, losses, costs and account coverage.",
    name: "summary PDF",
    icon: FileText,
  },
  {
    kind: "evidence",
    title: "Calculation Evidence PDF",
    text: "Disposals, matching rules, Section 104 pools and traceable transaction references.",
    name: "evidence PDF",
    icon: FileText,
  },
] as const;
interface Feedback {
  kind: ReportKind;
  text: string;
  error?: boolean;
  code?: string;
}
const linkClass = "text-blue-700 underline";

export function RestoredReports({
  requestedYear = "",
  requestedFormat,
  outcome,
}: {
  requestedYear?: string;
  requestedFormat?: PdfFormat;
  outcome?: "returned" | "cancelled" | null;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [year, setYear] = useState(requestedYear);
  const [error, setError] = useState("");
  const [entitlement, setEntitlement] = useState<BillingStatus | null>(null);
  const [billingError, setBillingError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const request = useRef<AbortController | null>(null);

  const checkBilling = useCallback(
    (signal?: AbortSignal) =>
      api<BillingStatus>("/api/v2/billing", { action: "report-access" }, signal)
        .then((status) => {
          if (!signal?.aborted) {
            setEntitlement(status);
            setBillingError("");
          }
        })
        .catch((error: unknown) => {
          if (!signal?.aborted) {
            setEntitlement(null);
            setBillingError(
              error instanceof ApiError && error.status === 429
                ? error.message
                : "Check your connection and retry PDF access.",
            );
          }
        }),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    void checkBilling(controller.signal);
    workspaceApi<Overview>(
      { action: "overview", surface: "reports" },
      controller.signal,
    )
      .then((d) => {
        if (!controller.signal.aborted) {
          setData(d);
          setYear(requestedYear || d.calculations[0]?.tax_year || "");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [checkBilling, requestedYear]);
  const focusedTarget = useRef("");
  useEffect(() => {
    if (!requestedFormat || !data || (!entitlement && !billingError)) return;
    const key = requestedYear + requestedFormat + (outcome ?? "");
    if (focusedTarget.current === key) return;
    focusedTarget.current = key;
    document.getElementById(`report-${requestedFormat}`)?.focus();
  }, [
    requestedFormat,
    requestedYear,
    outcome,
    data,
    entitlement,
    billingError,
  ]);
  const calculation = data?.calculations.find((c) => c.tax_year === year);
  const draft = data?.drafts[0];
  const uploadPath = year
    ? `/dashboard/upload?year=${encodeURIComponent(year)}`
    : "/dashboard/upload";
  const fixPath = draft
    ? `/dashboard/upload?${new URLSearchParams({ draft: draft.id, ...(year ? { year } : {}) })}`
    : year
      ? `/dashboard/calculations?year=${encodeURIComponent(year)}`
      : "/dashboard/calculations";

  async function download(kind: ReportKind) {
    if (!calculation || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(kind);
    setFeedback(null);
    try {
      const response = await fetch("/api/v2/reports", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: calculation.id, kind }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(45000),
        ]),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setFeedback({
          kind,
          error: true,
          text:
            body?.error?.message ??
            "The report could not be downloaded. Try again.",
          code:
            body?.error?.code ??
            (response.status === 402 ? "SUBSCRIPTION_REQUIRED" : undefined),
        });
        if (response.status === 402) await checkBilling(controller.signal);
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `CGT-${kind}-${year}.${kind === "csv" ? "csv" : "pdf"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback({
        kind,
        text: `Your ${year} download is ready. Check your downloads.`,
      });
    } catch {
      if (!controller.signal.aborted)
        setFeedback({
          kind,
          error: true,
          text: "The download was interrupted. Try again.",
        });
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(null);
    }
  }

  function downloadFeedback(kind: ReportKind) {
    if (feedback?.kind !== kind) return null;
    return (
      <Notice tone={feedback.error ? "error" : "success"}>
        {feedback.text}{" "}
        {feedback.code === "PENDING_IMPORTS" ? (
          <Link className={linkClass} href={draft ? fixPath : uploadPath}>
            Resolve preview
          </Link>
        ) : feedback.code === "REPORT_UNAVAILABLE" ? (
          <Link
            className={linkClass}
            href={`/dashboard/calculations?year=${encodeURIComponent(year)}`}
          >
            Recalculate this year
          </Link>
        ) : null}
      </Notice>
    );
  }

  const result = calculation?.result;
  const confirmed =
    calculation?.coverage_confirmed && result?.status === "complete";
  const accounts = calculation?.coverage_accounts;
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Reports &amp; Exports
        </h1>
        <p className="text-gray-600 mt-1">
          Review your saved share gains and download the evidence.
        </p>
      </div>
      {error && (
        <Notice tone="error">
          {error}{" "}
          <button
            className={linkClass}
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </Notice>
      )}
      {!data && !error && <Notice>Loading saved calculations…</Notice>}
      {data && (
        <>
          <div className="max-w-sm">
            <SelectField
              id="export-year"
              label="Tax year"
              value={year}
              disabled={!data.calculations.length || !!busy}
              onChange={(e) => {
                const choice = e.target.value;
                setYear(choice);
                setFeedback(null);
                window.history.replaceState(
                  null,
                  "",
                  `/dashboard/reports?year=${encodeURIComponent(choice)}`,
                );
              }}
            >
              {!calculation && (
                <option value={year}>{year || "No saved calculations"}</option>
              )}
              {data.calculations.map((c) => (
                <option key={c.id} value={c.tax_year}>
                  {c.tax_year}
                </option>
              ))}
            </SelectField>
          </div>
          {draft || !calculation ? (
            <Notice tone="warning">
              {draft
                ? "A saved preview needs your review before reports can be downloaded."
                : year
                  ? `There is no current saved calculation for ${year}.`
                  : "There are no saved calculations yet."}{" "}
              <Link className={linkClass} href={fixPath}>
                {draft
                  ? "Resolve preview"
                  : year
                    ? "Recalculate this year"
                    : "Calculate your gains"}
              </Link>
            </Notice>
          ) : null}
          {result && (
            <section
              aria-label="Calculation summary"
              className="rounded-xl border bg-white p-5 sm:p-6 space-y-3"
            >
              <h2 className="text-xl font-semibold">
                Last saved calculation · {year}
              </h2>
              <p className="text-xl font-bold tabular-nums">
                {result.summary
                  ? `${netOutcome(result.summary.netGainGBP)} ${money(result.summary.netGainGBP.replace(/^-/, ""))}`
                  : "Total awaiting complete history"}
              </p>
              <p>
                {confirmed
                  ? "Complete calculation with confirmed account coverage."
                  : "Draft calculation. History or account coverage is incomplete."}{" "}
                History through {displayDate(result.historyThrough)}.
              </p>
              {!draft && (
                <div id="report-csv">
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    busy={busy === "csv"}
                    onClick={() => void download("csv")}
                  >
                    <Download size={16} aria-hidden="true" />
                    {busy === "csv"
                      ? "Preparing CSV…"
                      : "Download CSV evidence"}
                  </Button>
                  <p className="mt-1 text-sm text-gray-600">
                    Free spreadsheet of disposals, matches, pools and issues.
                  </p>
                  {downloadFeedback("csv")}
                </div>
              )}
              {result.summary && (
                <dl className="flex flex-wrap gap-x-7 gap-y-2 text-sm">
                  {[
                    ["Proceeds", result.summary.proceedsGBP],
                    ["Allowable costs", result.summary.allowableCostsGBP],
                    ["Gains", result.summary.gainsGBP],
                    ["Losses", result.summary.lossesGBP],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-gray-600">{label}</dt>
                      <dd className="font-semibold tabular-nums">
                        {money(value!)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {!confirmed && (
                <div className="text-sm">
                  {result.status === "blocked" ? (
                    <>
                      <p>
                        Draft exports list the unmatched sales and available
                        evidence. A net total is withheld until the missing
                        purchases can be matched.
                      </p>
                      <Link className={linkClass} href={uploadPath}>
                        Upload earlier acquisitions
                      </Link>
                    </>
                  ) : (
                    <>
                      <p>
                        {result.status === "provisional"
                          ? "Draft exports use the saved history cutoff. Later purchases could change the matches and total."
                          : "Draft exports use the saved trades. The total may change if other taxable accounts are missing."}
                      </p>
                      <Link
                        className={linkClass}
                        href={`/dashboard/calculations?year=${encodeURIComponent(year)}`}
                      >
                        Review coverage for {year}
                      </Link>
                    </>
                  )}
                </div>
              )}
              {accounts?.length ? (
                <p className="text-sm text-gray-600">
                  Confirmed accounts:{" "}
                  {data.accounts
                    .filter((a) => accounts.includes(a.id))
                    .map((a) => a.label)
                    .join(", ")}
                </p>
              ) : null}
              <p className="text-sm text-gray-600">
                Personal allowances, reliefs and other gains are excluded.{" "}
                <Link className={linkClass} href="/guide/sa108-how-to-fill-in">
                  SA108 filing guide
                </Link>
              </p>
            </section>
          )}
          {calculation && !draft && (
            <div className="grid md:grid-cols-2 gap-6">
              {cards.map((card) => {
                const target = { year, format: card.kind };
                const locked =
                  entitlement &&
                  (!entitlement.entitled ||
                    (feedback?.kind === card.kind &&
                      feedback.code === "SUBSCRIPTION_REQUIRED"));
                return (
                  <section
                    tabIndex={-1}
                    id={`report-${card.kind}`}
                    key={card.kind}
                    className="scroll-mt-4 bg-white rounded-xl border p-5 flex flex-col"
                  >
                    <card.icon
                      aria-hidden="true"
                      size={24}
                      className="text-blue-600 mb-4"
                    />
                    <h2 className="text-lg font-bold mb-2">{card.title}</h2>
                    <p className="text-sm text-gray-600 mb-5 flex-1">
                      {card.text}
                    </p>
                    {requestedYear === year &&
                      requestedFormat === card.kind &&
                      !(outcome === "returned" && billingError) &&
                      outcome && (
                        <Notice
                          tone={
                            outcome === "cancelled"
                              ? "info"
                              : entitlement?.entitled
                                ? "success"
                                : "info"
                          }
                        >
                          {outcome === "cancelled"
                            ? "Checkout cancelled. Your report selection has been kept."
                            : entitlement?.entitled
                              ? "Payment confirmed. Your PDF is ready."
                              : "Checking PDF access."}
                        </Notice>
                      )}
                    {locked ? (
                      <Link
                        className="button primary"
                        href={billingUrl(target)}
                      >
                        {entitlement.needsReview
                          ? "Review subscription"
                          : ![
                                "none",
                                "canceled",
                                "incomplete_expired",
                              ].includes(entitlement.status)
                            ? "Manage PDF access"
                            : `Get ${card.name} · ${ANNUAL_REPORT_PRICE}/year`}
                      </Link>
                    ) : billingError ? (
                      <>
                        <Notice tone="warning">
                          PDF access could not be confirmed. {billingError}
                        </Notice>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setBillingError("");
                            void checkBilling();
                          }}
                        >
                          Retry PDF access
                        </Button>
                      </>
                    ) : (
                      <Button
                        disabled={!!busy || !entitlement}
                        busy={busy === card.kind}
                        onClick={() => void download(card.kind)}
                      >
                        <Download size={16} aria-hidden="true" />
                        {busy === card.kind
                          ? "Preparing report…"
                          : !entitlement
                            ? "Checking access…"
                            : `Download ${card.name}`}
                      </Button>
                    )}
                    {downloadFeedback(card.kind)}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
