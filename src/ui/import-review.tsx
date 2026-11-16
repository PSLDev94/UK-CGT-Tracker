"use client";
import { Button, Notice } from "./primitives";
import type { Preview } from "./workspace-types";

export function ImportReviewPanel({
  preview,
  busy,
  onPage,
  onCommit,
  onDiscard,
}: {
  preview: Preview;
  busy: boolean;
  onPage: (page: number) => void;
  onCommit: () => void;
  onDiscard: () => void;
}) {
  const { review } = preview;
  const pages = Math.max(1, Math.ceil(review.counts.total / review.pageSize));
  return (
    <section className="panel" aria-labelledby="review-title">
      <div className="panel-heading">
        <h2 id="review-title">Review before saving</h2>
        <span className="tag">
          {review.counts.total.toLocaleString("en-GB")} source records
        </span>
      </div>
      <p>
        Every record must be accounted for. No transactions from this preview
        have been saved.
      </p>
      <div className="metrics">
        {[
          ["Included", review.counts.accepted],
          ["Excluded", review.counts.excluded],
          ["Duplicate", review.counts.duplicate],
          ["Needs review", review.counts.needsReview],
        ].map(([label, count]) => (
          <div className="metric" key={label}>
            <strong>{count.toLocaleString("en-GB")}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {review.status !== "ready" && (
        <Notice tone="warning">
          {review.status === "unsupported"
            ? "This format is not verified. No transactions can be saved."
            : "This file is not ready to save. Resolve the records below, or discard an all-duplicate preview."}{" "}
          Correct the source file and upload it again.
        </Notice>
      )}
      {review.issues.length > 0 && (
        <details open>
          <summary>
            {review.issueCount} file{" "}
            {review.issueCount === 1 ? "issue" : "issues"}
          </summary>
          <ul>
            {review.issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.record}-${index}`}>
                {issue.record ? `Record ${issue.record}: ` : ""}
                {issue.message}
              </li>
            ))}
          </ul>
          {review.issueCount > review.issues.length && (
            <p>
              Showing the first 100 issues. All record-level reasons are
              available in the review pages below.
            </p>
          )}
        </details>
      )}
      <div
        className="table-scroll"
        role="region"
        aria-label="Import review records"
        tabIndex={0}
      >
        <table>
          <caption>
            Record classifications · page {review.page} of {pages}
          </caption>
          <thead>
            <tr>
              <th scope="col">Record</th>
              <th scope="col">Outcome</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {review.records.map((row) => (
              <tr key={row.record}>
                <td className="number">{row.record}</td>
                <td>
                  {
                    {
                      accepted: "Included",
                      excluded: "Excluded",
                      duplicate: "Duplicate",
                      needs_review: "Needs review",
                    }[row.status]
                  }
                </td>
                <td className="reason">
                  {row.reason}
                  {row.trade && (
                    <small style={{ display: "block" }}>
                      {row.trade.date} · {row.trade.side} · {row.trade.quantity}{" "}
                      · {row.trade.securityId}
                    </small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <div className="actions">
        {review.status === "ready" && (
          <Button busy={busy} onClick={onCommit}>
            {busy
              ? "Saving…"
              : `Save ${review.counts.accepted.toLocaleString("en-GB")} transactions`}
          </Button>
        )}
        <Button busy={busy} variant="secondary" onClick={onDiscard}>
          Discard preview
        </Button>
      </div>
    </section>
  );
}
