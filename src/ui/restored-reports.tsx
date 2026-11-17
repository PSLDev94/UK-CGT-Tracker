"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Table, Download } from "lucide-react";
import { workspaceApi } from "./api";
import type { Overview } from "./workspace-types";
import { Notice, Button, SelectField } from "./primitives";
import type { ReportKind } from "../domain/reports/report";

const cards: {
  kind: ReportKind;
  title: string;
  text: string;
  icon: typeof FileText;
}[] = [
  {
    kind: "summary",
    title: "CGT Summary PDF",
    text: "Gains, losses, costs and history coverage from your saved calculation. PDF downloads require an active subscription.",
    icon: FileText,
  },
  {
    kind: "evidence",
    title: "Calculation Evidence PDF",
    text: "Disposals, same-day and 30-day matching, Section 104 pools and transaction references for your records or accountant.",
    icon: FileText,
  },
  {
    kind: "csv",
    title: "Calculation Export (CSV)",
    text: "Disposals, individual matches, pools and unresolved issues in spreadsheet format. Available without a subscription.",
    icon: Table,
  },
];
export function RestoredReports() {
  const [data, setData] = useState<Overview | null>(null),
    [year, setYear] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState<ReportKind | null>(null),
    [subscriptionNeeded, setSubscriptionNeeded] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    workspaceApi<Overview>({ action: "overview" }, controller.signal)
      .then((d) => {
        if (!controller.signal.aborted) {
          setData(d);
          setYear(d.calculations[0]?.tax_year ?? "");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, []);
  const calculation = data?.calculations.find((c) => c.tax_year === year);
  async function download(kind: ReportKind) {
    if (!calculation || busy) return;
    setBusy(kind);
    setError("");
    setMessage("");
    setSubscriptionNeeded(false);
    const controller = new AbortController();
    request.current = controller;
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
        setSubscriptionNeeded(response.status === 402);
        throw new Error(
          body?.error?.message ??
            "The report could not be downloaded. Try again.",
        );
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CGT-${kind}-${year}.${kind === "csv" ? "csv" : "pdf"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Report downloaded. Check the completeness status before using the figures.",
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Connection interrupted. Try the download again.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(null);
    }
  }
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Reports &amp; Exports
        </h1>
        <p className="text-gray-600 mt-1">
          Download the calculation and supporting evidence for your records.
        </p>
      </div>
      {error && (
        <Notice tone="error">
          {error}{" "}
          {subscriptionNeeded ? (
            <Link href="/billing">View subscription</Link>
          ) : !data ? (
            <button
              className="underline"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          ) : null}
        </Notice>
      )}
      {message && <Notice tone="success">{message}</Notice>}
      {!data && !error && <Notice>Loading saved calculations…</Notice>}
      {data && !data.calculations.length && (
        <Notice>
          No saved calculations yet.{" "}
          <Link href="/dashboard">Calculate your gains</Link> after importing
          your accounts.
        </Notice>
      )}
      <div className="max-w-sm">
        <SelectField
          id="export-year"
          label="Tax year"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setMessage("");
            setError("");
          }}
          disabled={!data?.calculations.length || !!busy}
        >
          {!data?.calculations.length && (
            <option value="">No saved calculations</option>
          )}
          {data?.calculations.map((c) => (
            <option key={c.id} value={c.tax_year}>
              {c.tax_year}
            </option>
          ))}
        </SelectField>
      </div>
      {calculation && (
        <Notice
          tone={
            calculation.result.status === "complete" &&
            calculation.coverage_confirmed
              ? "info"
              : "warning"
          }
        >
          {calculation.result.status === "complete" &&
          calculation.coverage_confirmed
            ? "Complete calculation with confirmed account coverage. Check all source records and your wider tax position before filing."
            : "Draft report: the calculation or account coverage is incomplete. Missing amounts will be labelled unresolved."}
        </Notice>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <section
            key={card.kind}
            className="bg-white rounded-xl shadow-sm border p-6 flex flex-col"
          >
            <span
              className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${i === 2 ? "bg-amber-50 text-amber-700" : i === 1 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600"}`}
            >
              <card.icon aria-hidden="true" size={24} />
            </span>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {card.title}
            </h2>
            <p className="text-sm text-gray-600 mb-6 flex-1">{card.text}</p>
            <Button
              disabled={!calculation || !!busy}
              busy={busy === card.kind}
              onClick={() => download(card.kind)}
            >
              <Download size={16} aria-hidden="true" />
              {busy === card.kind
                ? "Preparing report…"
                : card.kind === "csv"
                  ? "Download CSV evidence"
                  : "Download PDF"}
            </Button>
          </section>
        ))}
      </div>
      <Notice tone="warning">
        These reports calculate ordinary-share gains and losses, not personal
        tax owed. They do not apply allowances, other gains or reliefs, and are
        not completed HMRC forms.{" "}
        <Link href="/guide/sa108-how-to-fill-in">
          Read the SA108 filing guide
        </Link>
        .
      </Notice>
    </div>
  );
}
