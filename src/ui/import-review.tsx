"use client";
import { useEffect, useRef, useState } from "react";
import { ImportDetailsForm } from "./import-details-form";
import type { SupportingDetails } from "../domain/imports/supporting-details";
import { Button, Notice } from "./primitives";
import type { Preview } from "./workspace-types";

const groups = [
  { key: "needs_review", label: "Needs attention" },
  { key: "accepted", label: "Included" },
  { key: "excluded", label: "Excluded" },
  { key: "duplicate", label: "Duplicate" },
] as const;

export function ImportReviewPanel({
  preview,
  accountLabel,
  fileLabel,
  expiry,
  broker,
  busy,
  onPage,
  onCommit,
  onDiscard,
  onDetails,
  onDirty,
}: {
  preview: Preview;
  accountLabel: string;
  fileLabel: string;
  expiry?: string;
  broker: string;
  busy: boolean;
  onPage: (page: number) => void;
  onCommit: () => void;
  onDiscard: () => void;
  onDetails: (record: number, details: SupportingDetails) => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const { review } = preview;
  const [editing, setEditing] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const row = review.records.find((r) => r.record === editing);
  const pages = Math.max(1, Math.ceil(review.counts.total / review.pageSize));
  const next = review.records.find(
    (r) => r.canSupplyDetails && r.status === "needs_review",
  );
  useEffect(() => () => onDirty(false), [onDirty]);
  useEffect(() => {
    title.current?.focus();
  }, [editing, preview.draftId]);
  const changeDirty = (value: boolean) => {
    setDirty(value);
    onDirty(value);
  };
  const edit = (id: number) => {
    setSaved(null);
    setEditing(id);
  };
  return (
    <section className="panel" aria-labelledby="review-title">
      <h2 id="review-title" ref={title} tabIndex={-1}>
        {row ? `Resolve record ${row.record}` : "Review before saving"}
      </h2>
      <p>
        <strong>{fileLabel}</strong> · {accountLabel}
      </p>
      {row ? (
        <>
          <p>{row.reason}</p>
          <ImportDetailsForm
            key={row.record}
            row={row}
            broker={broker}
            busy={busy}
            onDirty={changeDirty}
            onSave={async (record, details) => {
              await onDetails(record, details);
              changeDirty(false);
              setSaved(record);
              setEditing(null);
            }}
          />
          <Button
            disabled={dirty || busy}
            variant="secondary"
            onClick={() => setEditing(null)}
          >
            Back to file review
          </Button>
        </>
      ) : (
        <>
          <p>
            {review.counts.total} source{" "}
            {review.counts.total === 1 ? "record" : "records"} ·{" "}
            {review.counts.needsReview}{" "}
            {review.counts.needsReview === 1 ? "needs" : "need"} attention.
            Nothing from this preview has been saved as transactions.
          </p>
          <div className="metrics">
            {[
              [review.counts.accepted, "Included"],
              [review.counts.excluded, "Excluded"],
              [review.counts.duplicate, "Duplicate"],
              [review.counts.needsReview, "Needs review"],
            ].map(([count, label]) => (
              <div className="metric" key={label}>
                <strong>{count}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          {saved !== null && (
            <Notice>
              Details checked for record {saved}.{" "}
              {review.counts.needsReview
                ? `${review.counts.needsReview} records still need attention.`
                : "All records have an outcome."}
            </Notice>
          )}
          {review.status !== "ready" && (
            <Notice tone="warning">
              {review.status === "unsupported"
                ? "This format is not verified. Check the export instructions and upload a supported file."
                : review.counts.duplicate === review.counts.total &&
                    review.counts.total > 0
                  ? "Every record in this file was already imported. Discard this preview to keep your existing records."
                  : "This file cannot be saved yet. Check the unresolved records and the original export. Keep all source rows in the file."}
            </Notice>
          )}
          <div className="actions">
            {review.status === "ready" && (
              <Button busy={busy} onClick={onCommit}>
                Save {review.counts.accepted.toLocaleString("en-GB")}{" "}
                {review.counts.accepted === 1 ? "transaction" : "transactions"}
              </Button>
            )}
            {next && (
              <Button busy={busy} onClick={() => edit(next.record)}>
                Resolve record {next.record}
              </Button>
            )}
            <Button busy={busy} variant="secondary" onClick={onDiscard}>
              Discard preview
            </Button>
          </div>
          {expiry && (
            <p className="caption">
              Preview expires{" "}
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/London",
              }).format(new Date(expiry))}{" "}
              (London).
            </p>
          )}
          {review.issues.length > 0 && (
            <details open={!next}>
              <summary>
                {review.issueCount} file{" "}
                {review.issueCount === 1 ? "issue" : "issues"}
              </summary>
              <ul>
                {review.issues.map((issue, i) => (
                  <li key={i}>
                    {issue.record ? `Record ${issue.record}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
              {review.issueCount > review.issues.length && (
                <p>
                  Showing the first {review.issues.length} issues. All row
                  outcomes are available below.
                </p>
              )}
            </details>
          )}
          <h3 className="mt-5">
            Record outcomes{pages > 1 && ` · page ${review.page} of ${pages}`}
          </h3>
          {groups.map((group) => {
            const records = review.records.filter(
              (item) => item.status === group.key,
            );
            if (!records.length) return null;
            return (
              <details
                key={group.key}
                open={group.key === "needs_review" || review.counts.total <= 5}
              >
                <summary>
                  {group.label} ({records.length}
                  {pages > 1 ? " on this page" : ""})
                </summary>
                <ul className="divide-y divide-gray-200">
                  {records.map((item) => (
                    <li className="py-2 break-words" key={item.record}>
                      <strong>Record {item.record}</strong>
                      <p>{item.reason}</p>
                      {item.trade && (
                        <p className="caption">
                          {item.trade.date} · {item.trade.side} ·{" "}
                          {item.trade.quantity} shares · {item.trade.securityId}
                        </p>
                      )}
                      {item.canSupplyDetails && (
                        <button
                          type="button"
                          disabled={busy}
                          className="text-button"
                          onClick={() => edit(item.record)}
                        >
                          Review details for record {item.record}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
          {pages > 1 && (
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={busy || review.page === 1}
                onClick={() => onPage(review.page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {review.page} of {pages}
              </span>
              <Button
                variant="secondary"
                disabled={busy || review.page === pages}
                onClick={() => onPage(review.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
