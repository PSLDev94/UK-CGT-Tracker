"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./workspace-records.module.css";
import { workspaceApi } from "./api";
import { Button } from "./primitives";
import { ImportTradeDetails, tradeSummary } from "./import-trade-detail";
import type { ImportTradeDetail } from "../domain/imports/trade-detail";
import type { HistoryImport } from "./workspace-types";

type Receipt = {
  status: HistoryImport["status"];
  accountLabel: string;
  reversalReason: string | null;
  page: number;
  pageSize: number;
  total: number;
  legacy: boolean;
  records: {
    record: number;
    status: "accepted" | "excluded" | "duplicate";
    reason: string;
    tradeDetail?: ImportTradeDetail;
    statementReference?: string;
  }[];
};

const labels = {
  accepted: "Included",
  excluded: "Excluded",
  duplicate: "Duplicate",
};

export function ReceiptReference({ id }: { id: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  return <div>
    <p>Receipt {id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id}{" "}
      <button type="button" className="text-button" onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setStatus("copied");
        } catch {
          setStatus("manual");
        }
      }}>Copy full receipt ID</button>
    </p>
    <span role="status">{status === "copied" && "Receipt ID copied."}</span>
    {status === "manual" && <label>Full receipt ID
      <input readOnly value={id} onFocus={(event) => event.target.select()} />
    </label>}
  </div>;
}

export function ImportReceiptStatus({ accountLabel, status, reversalReason }: {
  accountLabel: string;
  status: HistoryImport["status"];
  reversalReason?: string | null;
}) {
  return <>
    <strong>{accountLabel}</strong>{" "}
    <span className="tag">{status === "reversed" ? "Reversed" : "Saved"}</span>
    {status === "reversed" && <>
      <p>These transactions are excluded from future calculations.</p>
      {reversalReason && <p>Reversal reason: {reversalReason}</p>}
    </>}
  </>;
}

export function ImportReceiptIdentity({ item }: { item: HistoryImport }) {
  return (
    <>
      <p className="font-medium">
        {item.firstTrade ? (
          <>{item.accepted_count > 1 && "First included trade · "}{tradeSummary(item.firstTrade)}</>
        ) : item.accepted_count ? "Trade summary unavailable" : "No trades included"}
      </p>
      <p className="caption">Receipt {item.id.slice(0, 8)}…{item.id.slice(-4)}</p>
    </>
  );
}

export function ImportHistoryDetail({
  importId,
  children,
  sourceRecord,
  listStatus,
  initiallyOpen = false,
}: {
  importId: string;
  children?: ReactNode;
  sourceRecord?: number;
  listStatus?: HistoryImport["status"];
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [page, setPage] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const reversed = listStatus === "reversed" || receipt?.status === "reversed";
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    workspaceApi<Receipt>(
      { action: "import-detail", importId, page: page ?? 1, record: page === null ? sourceRecord : undefined },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setReceipt(result);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(caught.message);
      });
    return () => controller.abort();
  }, [open, page, importId, attempt, sourceRecord]);
  useEffect(() => {
    if (receipt && sourceRecord !== undefined && page === null) {
      document.getElementById(`receipt-record-${sourceRecord}`)?.focus();
    }
  }, [receipt, sourceRecord, page]);
  const move = (next: number) => {
    setError("");
    setReceipt(null);
    setPage(next);
  };
  return (
    <>
    {initiallyOpen && receipt && (
      <div className="break-words">
        <ImportReceiptStatus accountLabel={receipt.accountLabel} status={receipt.status} reversalReason={receipt.reversalReason} />
      </div>
    )}
    <details
      className="import-history-detail min-w-0 break-words"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>View import details</summary>
      {open && (
        <>
          {initiallyOpen ? <h2 className="mt-4">Saved source rows</h2> : <h3 className="mt-4">Saved source rows</h3>}
          {error ? (
            <div role="alert">
              <p>{error}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setError("");
                  setAttempt((n) => n + 1);
                }}
              >
                Retry source rows
              </Button>
            </div>
          ) : !receipt ? (
            <p role="status">Loading source rows…</p>
          ) : receipt.total ? (
            <>
              {receipt.legacy && <p>This older import retained its included trades. Other source-row outcomes are unavailable.</p>}
              <dl>
                {receipt.records.map((row) => (
                  <div
                    key={row.record}
                    id={row.record === sourceRecord ? `receipt-record-${row.record}` : undefined}
                    tabIndex={row.record === sourceRecord ? -1 : undefined}
                    className={`border-b border-gray-200 py-2 ${row.record === sourceRecord ? styles.receiptSource : ""}`}
                  >
                    <dt className="font-semibold">
                      Record {row.record} · {row.status === "accepted" && reversed ? "Included when imported" : labels[row.status]}
                    </dt>
                    <dd>
                      {row.record === sourceRecord && <span className={styles.receiptSourceLabel}>Source for this calculation</span>}
                      {row.reason}
                      {row.statementReference && <p className="caption">Statement reference on this import: {row.statementReference}</p>}
                      {row.tradeDetail && <ImportTradeDetails record={row.record} trade={row.tradeDetail} />}
                    </dd>
                  </div>
                ))}
              </dl>
              {receipt.total > receipt.pageSize && (
                <div className="pagination">
                  <Button
                    variant="secondary"
                    disabled={receipt.page === 1}
                    onClick={() => move(receipt.page - 1)}
                  >
                    Previous rows
                  </Button>
                  <span>
                    Page {receipt.page} of {Math.ceil(receipt.total / receipt.pageSize)}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={receipt.page * receipt.pageSize >= receipt.total}
                    onClick={() => move(receipt.page + 1)}
                  >
                    Next rows
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p>Only the import totals are available for this file.</p>
          )}
          {children}
        </>
      )}
    </details>
    </>
  );
}
