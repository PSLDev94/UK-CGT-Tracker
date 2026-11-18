"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Disposal } from "../domain/cgt/types";
import type { ReportSource } from "../domain/reports/report";
import { workspaceApi } from "./api";
import { displayDate, money } from "./format";
import { SaleAmounts } from "./sale-amounts";
import { calculationSourceHref, disposalSourceKeys } from "./disposal-location";

const rules = {
  SAME_DAY: "Same day",
  THIRTY_DAY: "Within 30 days",
  SECTION_104: "Section 104 pool",
};
const pageSize = 25;

function DisposalSources({
  disposal,
  year,
  position,
  returnSource,
}: {
  disposal: Disposal;
  year: string;
  position: string;
  returnSource?: number;
}) {
  const keys = useMemo(() => disposalSourceKeys(disposal), [disposal]);
  const [page, setPage] = useState(() => Math.floor((returnSource ?? 0) / pageSize));
  const returnLink = useRef<HTMLAnchorElement>(null);
  const restored = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<ReportSource[] | null>(null);
  const [error, setError] = useState("");
  const requested = useMemo(
    () => keys.slice(page * pageSize, (page + 1) * pageSize),
    [keys, page],
  );
  useEffect(() => {
    if (!requested.length) return;
    const controller = new AbortController();
    workspaceApi<ReportSource[]>(
      { action: "disposal-sources", keys: requested },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setRows(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [requested, attempt]);
  useEffect(() => {
    const link = returnLink.current;
    if (rows && !restored.current && link?.getClientRects().length) {
      restored.current = true;
      link.focus({ preventScroll: true });
      link.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }, [rows]);
  function move(next: number) {
    setRows(null);
    setError("");
    setPage(next);
  }
  return (
    <div className="my-3 space-y-2 break-words">
      <h4 className="font-semibold">Broker receipts</h4>
      {!keys.length ? (
        <p>No source references were saved with this calculation.</p>
      ) : error ? (
        <p role="alert">
          {error}{" "}
          <button
            className="text-blue-700 underline"
            onClick={() => {
              setError("");
              setAttempt(attempt + 1);
            }}
          >
            Retry receipts
          </button>
        </p>
      ) : !rows ? (
        <p role="status">Loading receipts…</p>
      ) : (
        <ul className="space-y-2">
          {requested.map((key, i) => {
            const source = rows.find((row) => row.key === key);
            const index = page * pageSize + i;
            const location = position + "." + index;
            const role = disposal.sourceIds.includes(key)
              ? "Sale"
              : "Matched purchase";
            return (
              <li key={key}>
                <strong>{role}</strong>
                {source ? (
                  <>
                    {" · "}
                    {source.instrument || disposal.securityId} · {source.label}
                    {source.reference && <> · Trade {source.reference}</>}
                    {source.statementReference && (
                      <> · Statement {source.statementReference}</>
                    )}
                    {source.importReference && (
                      <>
                        <br />
                        <Link
                          ref={index === returnSource ? returnLink : undefined}
                          className="text-blue-700 underline"
                          onNavigate={() => {
                            // Preserve the source on the calculation's own Back/Forward entry.
                            window.history.replaceState(null, "", calculationSourceHref(year, location));
                          }}
                          href={
                            "/dashboard/history?" +
                            new URLSearchParams({
                              receipt: source.importReference,
                              record: String(source.record),
                              year,
                              source: location,
                            })
                          }
                        >
                          Receipt {source.importReference.slice(0, 8)}…
                          {source.importReference.slice(-4)} · record{" "}
                          {source.record}
                        </Link>
                      </>
                    )}
                  </>
                ) : (
                  <> {page * pageSize + i + 1} · Receipt unavailable</>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {keys.length > pageSize && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => move(page - 1)}>
            Previous sources
          </button>
          <span>
            Page {page + 1} of {Math.ceil(keys.length / pageSize)}
          </span>
          <button
            disabled={(page + 1) * pageSize >= keys.length}
            onClick={() => move(page + 1)}
          >
            Next sources
          </button>
        </div>
      )}
    </div>
  );
}

export function DisposalDetail({
  disposal,
  year,
  position,
  returnSource,
  children,
  className,
}: {
  disposal: Disposal;
  year: string;
  position: string;
  returnSource?: number;
  children: ReactNode;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const element = details.current;
    if (returnSource === undefined || !element?.getClientRects().length) return;
    element.open = true;
    // Keep a focus destination even if this source can no longer be loaded.
    element.querySelector("summary")?.focus();
  }, [returnSource]);
  return (
    <details
      ref={details}
      className={className}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer">{children}</summary>
      {open && (
        <>
          <p className="my-2">
            Quantity · {disposal.quantity}{" "}
            {Number(disposal.quantity) === 1 ? "share" : "shares"}
          </p>
          <SaleAmounts
            breakdown={disposal.saleBreakdown}
            net={disposal.proceedsGBP}
            matched={disposal.allowableCostGBP}
          />
          <ul className="match-list mt-3">
            {disposal.matches.map((match, i) => (
              <li key={i}>
                {rules[match.rule]} · {match.quantity}{" "}
                {Number(match.quantity) === 1 ? "share" : "shares"}
                {match.acquisitionDate
                  ? " bought " + displayDate(match.acquisitionDate)
                  : ""}
                . Cost {money(match.costGBP)}.
              </li>
            ))}
          </ul>
          <DisposalSources
            key={returnSource ?? "browse"}
            disposal={disposal}
            year={year}
            position={position}
            returnSource={returnSource}
          />
        </>
      )}
    </details>
  );
}
