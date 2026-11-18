"use client";

import { useEffect, useState, type ReactNode } from "react";
import { workspaceApi } from "./api";
import { Button } from "./primitives";
import { ImportTradeDetails } from "./import-trade-detail";
import type { ImportTradeDetail } from "../domain/imports/trade-detail";

type Receipt = {
  page: number;
  pageSize: number;
  total: number;
  legacy: boolean;
  records: {
    record: number;
    status: "accepted" | "excluded" | "duplicate";
    reason: string;
    tradeDetail?: ImportTradeDetail;
  }[];
};

const labels = {
  accepted: "Included",
  excluded: "Excluded",
  duplicate: "Duplicate",
};

export function ImportHistoryDetail({
  importId,
  children,
}: {
  importId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    workspaceApi<Receipt>(
      { action: "import-detail", importId, page },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setReceipt(result);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(caught.message);
      });
    return () => controller.abort();
  }, [open, page, importId, attempt]);
  const move = (next: number) => {
    setError("");
    setReceipt(null);
    setPage(next);
  };
  return (
    <details
      className="import-history-detail min-w-0 break-words"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>View import details</summary>
      {open && (
        <>
          <h3 className="mt-4">Saved source rows</h3>
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
                    className="border-b border-gray-200 py-2"
                  >
                    <dt className="font-semibold">
                      Record {row.record} · {labels[row.status]}
                    </dt>
                    <dd>
                      {row.reason}
                      {row.tradeDetail && <ImportTradeDetails record={row.record} trade={row.tradeDetail} />}
                    </dd>
                  </div>
                ))}
              </dl>
              {receipt.total > receipt.pageSize && (
                <div className="pagination">
                  <Button
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => move(page - 1)}
                  >
                    Previous rows
                  </Button>
                  <span>
                    Page {page} of {Math.ceil(receipt.total / receipt.pageSize)}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={page * receipt.pageSize >= receipt.total}
                    onClick={() => move(page + 1)}
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
  );
}
