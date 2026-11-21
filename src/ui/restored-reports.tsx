"use client";
import { latestCalculation } from "./latest-calculation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { api, ApiError, workspaceApi } from "./api";
import { hasActiveTrades, type Overview } from "./workspace-types";
import type { BillingStatus } from "@/server/billing";
import { Notice, Button, SelectField, money } from "./primitives";
import { evidenceIssue, noDisposalsLabel, purchaseIssue, reportIssueMessage } from "@/domain/reports/eligibility";
import { annualRoundingNote, roundingComparisonLabel, roundingDifferences } from "@/domain/reports/rounding";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";
import { billingUrl, reportDestination, type PdfFormat } from "../domain/reports/destination";
import { TAX_YEARS } from "../domain/values";
import { displayDate, netOutcome } from "./format";
import { statementSaleLimit, type ReportKind } from "../domain/reports/report";
import { adjustment2024Note, adjustment2024Url, confirmedRatePeriods, ratePeriodsNote, sa108Collection, sa108Edition } from "@/domain/reports/filing-guidance";
import { SaleAmounts } from "./sale-amounts";
import { ReportRecovery } from "./report-recovery";
import { DashboardShell } from "./dashboard-shell";
import { useSubscriptionSalesOpen, useWorkspaceBillingEnabled } from "./public-account";
import { calculationSourceHref } from "./disposal-location";
import styles from "./annual-statement.module.css";

const cards = [
  {
    kind: "summary",
    title: "CGT Summary PDF",
    text: "A short statement of your gains, losses, costs and account coverage.",
    name: "summary PDF",
  },
  {
    kind: "evidence",
    title: "Calculation Evidence PDF",
    text: "Disposals, matching rules, Section 104 pools and traceable transaction references.",
    name: "evidence PDF",
  },
] as const;
interface Feedback {
  year: string;
  kind: ReportKind;
  text: string;
  error?: boolean;
  code?: string;
}
const linkClass = "text-blue-700 underline";

function FilingGuidance({ year }: { year: string }) {
  const label = year.replace("-", "–");
  if (year === "2025-26") {
    return <Link className={linkClass} href="/guide/sa108-how-to-fill-in">Read the {label} SA108 filing guide</Link>;
  }
  const edition = sa108Edition(year);
  if (!edition) {
    return <a className={linkClass} href={sa108Collection} target="_blank" rel="noopener noreferrer">Check HMRC for the {label} SA108 form and notes (opens in a new tab)</a>;
  }
  return (
    <div>
      {year === "2024-25" && <p className="mb-2">{adjustment2024Note} <a className={linkClass} href={adjustment2024Url}>HMRC’s adjustment guidance</a>.</p>}
      <p>HMRC filing documents for {label} (PDFs open in a new tab)</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        <li><a className={linkClass} href={edition.form} target="_blank" rel="noopener noreferrer">{label} SA108 form</a></li>
        <li><a className={linkClass} href={edition.notes} target="_blank" rel="noopener noreferrer">{label} SA108 notes</a></li>
      </ul>
    </div>
  );
}

export function RestoredReports() {
  const params = useSearchParams();
  const [defaultYear, setDefaultYear] = useState("");
  const requestedYear = params.get("year") ?? "";
  const year = Object.hasOwn(TAX_YEARS, requestedYear) ? requestedYear : defaultYear;
  const checkout = params.get("checkout");
  return (
    <DashboardShell selectedYear={year}>
      <ReportContents
        year={year}
        setDefaultYear={setDefaultYear}
        requestedFormat={reportDestination(requestedYear, params.get("format"))?.format}
        outcome={checkout === "returned" || checkout === "cancelled" ? checkout : null}
      />
    </DashboardShell>
  );
}

function ReportContents({
  year,
  setDefaultYear,
  requestedFormat,
  outcome,
}: {
  year: string;
  setDefaultYear: (year: string) => void;
  requestedFormat?: PdfFormat;
  outcome?: "returned" | "cancelled" | null;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [entitlement, setEntitlement] = useState<BillingStatus | null>(null);
  const billingEnabled = useWorkspaceBillingEnabled();
  const salesOpen = useSubscriptionSalesOpen();
  const recoveringAccess = entitlement && !entitlement.entitled &&
    (entitlement.needsReview || !["none", "canceled", "incomplete_expired"].includes(entitlement.status));
  const pdfSalesClosed = !billingEnabled || (!salesOpen && entitlement !== null && !entitlement.entitled && !recoveringAccess);
  const [billingError, setBillingError] = useState("");
  const [lastFeedback, setFeedback] = useState<Feedback | null>(null);
  const feedback = lastFeedback?.year === year ? lastFeedback : null;
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
  const loadOverview = useCallback((signal: AbortSignal) =>
    workspaceApi<Overview>({ action: "overview", surface: "reports" }, signal).then((overview) => {
      if (signal.aborted) return;
      setData(overview);
      setDefaultYear(latestCalculation(overview.calculations)?.tax_year || overview.staleReportYears?.[0] || "");
    }), [setDefaultYear]);
  useEffect(() => {
    const controller = new AbortController();
    if (billingEnabled) void checkBilling(controller.signal);
    void loadOverview(controller.signal).catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [billingEnabled, checkBilling, loadOverview, reloadAttempt]);
  const focusedTarget = useRef("");
  useEffect(() => {
    if (!requestedFormat) {
      focusedTarget.current = "";
      return;
    }
    if (!data || (billingEnabled && !entitlement && !billingError)) return;
    const key = year + requestedFormat + (outcome ?? "");
    if (focusedTarget.current === key) return;
    focusedTarget.current = key;
    document.getElementById(pdfSalesClosed ? "report-pdf-availability" : `report-${requestedFormat}`)?.focus();
  }, [
    requestedFormat,
    year,
    outcome,
    data,
    entitlement,
    billingError,
    billingEnabled,
    pdfSalesClosed,
  ]);
  const calculation = data?.calculations.find((c) => c.tax_year === year);
  const staleYears = data?.staleReportYears ?? [];
  const reportYears = [...(data?.calculations.map((run) => run.tax_year) ?? []), ...staleYears].sort().reverse();
  const draft = data?.drafts[0];
  const uploadPath = year
    ? `/dashboard/upload?year=${encodeURIComponent(year)}`
    : "/dashboard/upload";
  const calculationPath = year ? "/dashboard/calculations?year=" + encodeURIComponent(year) : "/dashboard/calculations";
  let nextAction = { href: calculationPath, label: year ? "Recalculate this year" : "Calculate your gains" };
  if (draft) {
    nextAction = {
      href: "/dashboard/upload?" + new URLSearchParams({ draft: draft.id, ...(year ? { year } : {}) }),
      label: "Resolve preview",
    };
  } else if (!data?.accounts.length) {
    nextAction = { href: "/dashboard/accounts", label: "Add your first broker account" };
  } else if (!hasActiveTrades(data)) {
    nextAction = { href: uploadPath, label: "Upload a broker CSV" };
  }

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
        if (body?.error?.code === "REPORT_UNAVAILABLE") {
          // Another session may have saved new trades or recalculated this year.
          setData(null);
          try {
            await loadOverview(controller.signal);
          } catch {
            if (!controller.signal.aborted) setError("Your saved reports changed. Reload to see the current years.");
          }
          return;
        }
        setFeedback({
          year,
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
        year,
        kind,
        text: `Your ${year} download is ready. Check your downloads.`,
      });
    } catch {
      if (!controller.signal.aborted)
        setFeedback({
          year,
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
          <Link className={linkClass} href={draft ? nextAction.href : uploadPath}>
            Resolve preview
          </Link>
        ) : null}
      </Notice>
    );
  }

  const result = calculation?.result;
  const noDisposals = result?.disposals.length === 0;
  const purchaseBlock = result && calculation ? purchaseIssue(result, calculation.coverage_confirmed) : null;
  const differences = result ? roundingDifferences(result) : [];
  const confirmed =
    calculation?.coverage_confirmed && result?.status === "complete";
  const periods = result && calculation ? confirmedRatePeriods(result, calculation.coverage_confirmed) : [];
  const accounts = calculation?.coverage_accounts;
  const evidenceProblem = calculation?.evidenceIssue === undefined && result
    ? evidenceIssue(result)
    : calculation?.evidenceIssue;
  const recoveryCard = requestedFormat === "evidence" && !evidenceProblem ? "evidence" : "summary";
  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <h1>Reports &amp; Exports</h1>
        {data && (
          <div className={styles.yearPicker}>
            <SelectField
              id="export-year"
              label="Tax year"
              value={year}
              disabled={!reportYears.length || !!busy}
              onChange={(e) => {
                const choice = e.target.value;
                setFeedback(null);
                window.history.pushState(
                  null,
                  "",
                  `/dashboard/reports?year=${encodeURIComponent(choice)}`,
                );
              }}
            >
              {!reportYears.includes(year) && (
                <option value={year}>{year || "No saved calculations"}</option>
              )}
              {reportYears.map((optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}{staleYears.includes(optionYear) ? " · Needs recalculation" : ""}
                </option>
              ))}
            </SelectField>
          </div>
        )}
      </header>
      {error && (
        <Notice tone="error">
          {error}{" "}
          <button
            className={linkClass}
            onClick={() => {
              setError("");
              setReloadAttempt(attempt => attempt + 1);
            }}
          >
            Reload report
          </button>
        </Notice>
      )}
      {!data && !error && <Notice>Loading saved calculations…</Notice>}
      {data && (
        <>
          <ReportRecovery years={staleYears} previousInputs={data.previousCalculationInputs} draftId={draft?.id} />
          {(draft || !calculation) && !staleYears.includes(year) ? (
            <Notice tone="warning">
              {draft
                ? "A saved preview needs your review before reports can be downloaded."
                : year
                  ? `There is no current saved calculation for ${year}.`
                  : "There are no saved calculations yet."}{" "}
              <Link className={linkClass} href={nextAction.href}>
                {nextAction.label}
              </Link>
            </Notice>
          ) : null}
          {result && (
            <section
              aria-label="Calculation summary"
              className={styles.sheet}
            >
              <div className={styles.balance}>
                <div>
                  <h2>Annual statement <span>{year.replace("-", "–")}</span></h2>
                  {result.summary && !noDisposals ? (
                    <p className={styles.netAmount}>
                      {netOutcome(result.summary.netGainGBP)}{" "}
                      <strong>{money(result.summary.netGainGBP.replace(/^-/, ""))}</strong>
                    </p>
                  ) : (
                    <p className={styles.pending}>
                      {noDisposals ? noDisposalsLabel(result, calculation!.coverage_confirmed)
                        : result.issues.every(i => i.code === "MISSING_ACQUISITION_HISTORY") ? "Total awaiting complete history" : "Total pending review"}
                    </p>
                  )}
                  <p className={styles.allowances}>Share gains and losses before personal allowances, reliefs and other gains.</p>
                </div>
                <div className={styles.scope}>
                  <p>{confirmed ? "Account coverage confirmed." : "Draft calculation. History or account coverage is incomplete."}</p>
                  <p>History through {displayDate(result.historyThrough)}.</p>
                  <Link className={linkClass} href={calculationPath}>View calculation for {year}</Link>
                </div>
              </div>
              {result.issues.filter(issue => issue.scope === "pool").map(issue => (
                <p className="text-sm" key={issue.securityId}>
                  <strong>{issue.securityId} · Tax-pool balance unresolved.</strong>{" "}
                  {reportIssueMessage(issue)}
                </p>
              ))}
              {(noDisposals || result.hasLaterSales) && (
                <p>
                  {result.hasLaterSales ? <>Your portfolio already includes sales later in {year}. <Link className={linkClass} href={calculationPath + "#historyThrough"}>Extend the history cutoff and recalculate</Link>.</>
                    : <>Check the reporting year and history cutoff or <Link className={linkClass} href={uploadPath}>upload a file containing sales</Link>.</>}
                </p>
              )}
              <div className={styles.downloads}>
                {!draft && (
                  <div id="report-csv">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                    <span className="text-sm text-gray-600">Free</span>
                    </div>
                    {downloadFeedback("csv")}
                  </div>
                )}
                {purchaseBlock?.code === "REPORT_INCOMPLETE" && !entitlement?.entitled && !draft && (
                  <Notice tone="warning">{purchaseBlock.message}{" "}<Link className={linkClass} href={calculationPath}>Review calculation</Link></Notice>
                )}
                {pdfSalesClosed && !draft && (
                  <p id="report-pdf-availability" tabIndex={-1}>New PDF subscriptions are currently closed.</p>
                )}
                {!pdfSalesClosed && calculation && !draft && (!purchaseBlock || entitlement?.entitled) && (
                  <div role="group" aria-label="PDF reports" className="flex flex-wrap items-start gap-x-3 gap-y-2">
                    {cards.map((card) => {
                      const target = { year, format: card.kind };
                      const issue = card.kind === "evidence" ? evidenceProblem : null;
                      if (recoveringAccess && !issue && card.kind !== recoveryCard) return null;
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
                          aria-label={card.title}
                          className="scroll-mt-4 min-w-0 max-w-full"
                        >
                          {requestedFormat === card.kind &&
                            !issue &&
                            !(outcome === "returned" && (billingError || recoveringAccess)) &&
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
                          {issue ? (
                            <Notice tone="warning">
                              {issue.message}{" "}
                              {issue.code === "REPORT_TOO_LARGE" ? (
                                <>
                                  <a href="#report-csv" className={linkClass}>
                                    Free CSV evidence
                                  </a>
                                  {" · "}
                                  <a href="#report-summary" className={linkClass}>
                                    Summary PDF{" "}
                                    {entitlement?.entitled
                                      ? "(included)"
                                      : `(${ANNUAL_REPORT_PRICE}/year)`}
                                  </a>
                                </>
                              ) : (
                                <Link
                                  className={linkClass}
                                  href={`/dashboard/calculations?year=${year}`}
                                >
                                  Recalculate this year
                                </Link>
                              )}
                            </Notice>
                          ) : locked ? (
                            <>
                              {recoveringAccess && (
                                <p className="caption mb-2">Both PDF downloads need billing attention.</p>
                              )}
                              <Link
                                className="button primary"
                                href={billingUrl(recoveringAccess && requestedFormat ? { year, format: requestedFormat } : target)}
                              >
                                {entitlement.needsReview
                                  ? "Review subscription"
                                  : recoveringAccess || entitlement.entitled
                                    ? "Manage PDF access"
                                    : `Get ${card.name} · ${ANNUAL_REPORT_PRICE}/year`}
                              </Link>
                            </>
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
                {!pdfSalesClosed && !draft && (!purchaseBlock || entitlement?.entitled) && (
                  <details className="text-sm">
                    <summary>What each PDF includes</summary>
                    <dl className="mt-2 space-y-2">
                      {cards.map((card) => (
                        <div key={card.kind}>
                          <dt className="font-semibold">{card.title}</dt>
                          <dd>{card.text}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </div>
              <div className={styles.support}>
                {!noDisposals && calculation && (
                  <section className={styles.sales} aria-label="Sales in this statement">
                    <h3>Sales in this statement</h3>
                    <table className={styles.ledger}>
                      <thead>
                        <tr><th scope="col">Share sold</th><th scope="col">Sale date</th><th scope="col">Gain / loss</th></tr>
                      </thead>
                      <tbody>
                        {result.disposals.slice(0, statementSaleLimit).map((sale, index) => {
                          const source = sale.sourceIds[0];
                          const name = (source && data.statementSaleNames?.[source]) || sale.securityId;
                          const date = displayDate(sale.date);
                          return <tr key={sale.securityId + sale.date}>
                            <th scope="row">
                              <Link aria-label={`${name} sale on ${date}`} href={calculationSourceHref(year, source ? `${calculation.id}.${index}.0` : undefined)}>
                                {name}
                              </Link>
                              {name !== sale.securityId && <span className={styles.securityId}>{sale.securityId}</span>}
                              <time dateTime={sale.date} className={styles.compactDate}>{date}</time>
                            </th>
                            <td><time dateTime={sale.date}>{date}</time></td>
                            <td>{money(sale.gainGBP)}</td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                    {result.disposals.length > statementSaleLimit && (
                      <Link className={linkClass} href={calculationPath}>View all {result.disposals.length} disposal groups</Link>
                    )}
                  </section>
                )}
                {result.summary && !noDisposals && (
                  <section className={styles.arithmetic} aria-label="Annual amounts">
                    <h3>Annual amounts</h3>
                    <SaleAmounts
                      breakdown={result.saleBreakdown}
                      net={result.summary.proceedsGBP}
                      matched={result.summary.allowableCostsGBP}
                      gain={result.summary.netGainGBP} summary={result.summary}
                    />
                    <dl className="flex flex-wrap gap-x-7 gap-y-2 text-sm">
                      {[
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
                  </section>
                )}
              </div>
              {periods.length > 0 && (
                <section className="space-y-2" aria-label="2024–25 rate periods">
                  <h3 className="font-semibold">2024–25 rate periods</h3>
                  <dl className="space-y-2 text-sm">
                    {periods.map(p => (
                      <div key={p.from}>
                        <dt className="font-semibold">{displayDate(p.from)} to {displayDate(p.through)}</dt>
                        <dd className="tabular-nums">Gains {money(p.gainsGBP)} · Losses {money(p.lossesGBP)} · Net {money(p.netGainGBP)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="caption">{ratePeriodsNote}</p>
                </section>
              )}
              {differences.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold">
                    How rounding affects this year
                  </summary>
                  <p className="mt-2">
                    {annualRoundingNote(result)}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {differences.map((d) => (
                      <li key={d.label}>
                        {d.label}: {money(d.comparison)} {roundingComparisonLabel(result).toLowerCase()},{" "}
                        {money(d.adjustment)} rounding difference,{" "}
                        {money(d.reported)} reported.
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {!confirmed && (
                <div className="text-sm">
                  {result.status === "blocked" ? (
                    <>
                      <p>Draft exports list the available evidence. Resolve the issues before relying on an annual total.</p>
                      <ul>{[...new Set(result.issues.map(reportIssueMessage))].map(text => <li key={text}>{text}</li>)}</ul>
                      {result.issues.some(i => i.code === "MISSING_ACQUISITION_HISTORY") && (
                        <Link className={linkClass} href={uploadPath}>Upload earlier acquisitions</Link>
                      )}
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
                <div className="text-sm text-gray-600">
                  <p id="report-confirmed-accounts" className="font-medium">Confirmed accounts</p>
                  <ul aria-labelledby="report-confirmed-accounts" className="mt-1 max-w-prose list-disc space-y-1 pl-5">
                    {data.accounts.filter((a) => accounts.includes(a.id)).map((a) => (
                      <li className="break-words" key={a.id}>{a.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="space-y-1 text-sm text-gray-600">
                <FilingGuidance year={year} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
