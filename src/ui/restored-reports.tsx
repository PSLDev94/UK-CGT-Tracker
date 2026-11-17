"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Table, Download } from "lucide-react";
import { workspaceApi } from "./api";
import type { Overview } from "./workspace-types";
import { Notice, Button } from "./primitives";
export function RestoredReports() {
  const [data, setData] = useState<Overview | null>(null);
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    workspaceApi<Overview>({ action: "overview" })
      .then((d) => {
        if (active) {
          setData(d);
          setYear(d.calculations[0]?.tax_year ?? "");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const calculation = data?.calculations.find((c) => c.tax_year === year);
  function download() {
    if (!calculation) return;
    const r = calculation.result;
    const rows = [
      [
        "PREVIEW ONLY - NOT A TAX RETURN",
        "Tax year",
        r.taxYear,
        "Status",
        r.status,
      ],
      [
        "Date",
        "Security",
        "Quantity",
        "Proceeds GBP",
        "Allowable costs GBP",
        "Gain GBP",
        "Matching rules",
      ],
      ...r.disposals.map((d) => [
        d.date,
        d.securityId,
        d.quantity,
        d.proceedsGBP,
        d.allowableCostGBP ?? "UNRESOLVED",
        d.gainGBP ?? "UNRESOLVED",
        d.matches.map((m) => m.rule).join("; "),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              '"' +
              String(value)
                .replace(/^[=+@\-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `CGT-Calculation-Preview-${r.taxYear}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Reports &amp; Exports
        </h1>
        <p className="text-gray-600 mt-1">
          Review your saved calculations and export their evidence.
        </p>
      </div>
      {error && (
        <Notice tone="error">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </Notice>
      )}
      {!data && !error && <Notice>Loading saved calculations…</Notice>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[
          {
            title: "CGT Summary PDF",
            text: "A breakdown of gains, disposals and matching. PDF reports are still being qualified for the rebuilt calculation engine.",
            icon: FileText,
          },
          {
            title: "SA108 Reference Guide",
            text: "Year-specific filing figures require independent review. Read the restored guide while downloadable tax reports are being qualified.",
            icon: FileText,
          },
          {
            title: "Calculation Export (CSV)",
            text: "Export the disposals and matching rules from a saved calculation. This preview is not a complete transaction archive or a tax return.",
            icon: Table,
          },
        ].map((card, i) => (
          <section
            key={card.title}
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
            {i === 2 ? (
              <>
                <label className="text-sm mb-2" htmlFor="export-year">
                  Tax year
                </label>
                <select
                  id="export-year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="border rounded-md px-3 py-2 mb-3"
                  disabled={!data?.calculations.length}
                >
                  {!data?.calculations.length && (
                    <option value="">No saved calculations</option>
                  )}
                  {data?.calculations.map((c) => (
                    <option key={c.id} value={c.tax_year}>
                      {c.tax_year}
                    </option>
                  ))}
                </select>
                <Button onClick={download} disabled={!calculation}>
                  <Download size={16} aria-hidden="true" />
                  Download CSV preview
                </Button>
              </>
            ) : (
              <>
                <Button disabled>Download PDF — in qualification</Button>
                {i === 1 && (
                  <Link
                    href="/guide/sa108-how-to-fill-in"
                    className="text-sm text-blue-600 mt-3"
                  >
                    Read the SA108 guide
                  </Link>
                )}
              </>
            )}
          </section>
        ))}
      </div>
      <Notice tone="warning">
        These are calculation previews for review. Account coverage, other
        gains, allowances and reliefs must be checked before filing.
      </Notice>
    </div>
  );
}
