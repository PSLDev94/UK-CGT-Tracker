import { createHash } from "node:crypto";
import { BROKERS, type BrokerId } from "../domain/imports/brokers";
import {
  MAX_CSV_BYTES,
  reviewCsv,
  type ImportReview,
} from "../domain/imports/review";
import { calculateGains, ENGINE_VERSION } from "../domain/cgt/calculate";
import type { Trade } from "../domain/cgt/types";
import { calendarDate, TAX_YEARS, ukCalendarDate } from "../domain/values";
import { type Connection, OwnedDatabase, query } from "./database";
import { AppError, requireLabel, requireUuid } from "./errors";
import type { Identity } from "./identity";
import {
  validateDetails,
  type ImportDetails,
  type SupportingDetails,
} from "../domain/imports/supporting-details";
import type { ReportSnapshot, ReportSource } from "../domain/reports/report";

interface Portfolio {
  id: string;
  revision: number;
  name: string;
}
interface Account {
  id: string;
  portfolio_id: string;
  broker: BrokerId;
  label: string;
  account_type: "GIA";
}
interface Draft {
  id: string;
  account_id: string;
  csv: string;
  format: "native" | "canonical-v1";
  reviewed_revision: number;
  ordinary_shares_confirmed: boolean;
  supporting_details: ImportDetails;
  review_version: number;
}
interface Import {
  id: string;
  status: "committed" | "reversed";
  account_id: string;
}

const missing = () =>
  new AppError(
    404,
    "NOT_FOUND",
    "This item is unavailable. Return to your workspace and try again.",
  );
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function account(tx: Connection, id: string): Promise<Account> {
  const row = (
    await query<Account>(
      tx,
      "SELECT * FROM cgt.broker_accounts WHERE id = $1",
      [requireUuid(id)],
    )
  )[0];
  if (!row) throw missing();
  return row;
}

async function lockPortfolio(tx: Connection, id: string): Promise<Portfolio> {
  const row = (
    await query<Portfolio>(
      tx,
      "SELECT id, revision, name FROM cgt.portfolios WHERE id = $1 FOR UPDATE",
      [requireUuid(id)],
    )
  )[0];
  if (!row) throw missing();
  return row;
}

async function invalidate(tx: Connection, portfolioId: string): Promise<void> {
  await query(
    tx,
    "UPDATE cgt.portfolios SET revision = revision + 1 WHERE id = $1",
    [portfolioId],
  );
  await query(
    tx,
    "DELETE FROM cgt.published_calculations WHERE portfolio_id = $1",
    [portfolioId],
  );
}

async function preview(
  tx: Connection,
  a: Account,
  csv: string,
  format: Draft["format"],
  ordinarySharesConfirmed = false,
  supportingDetails: ImportDetails = {},
): Promise<ImportReview> {
  // No provider-imposed page limit: this returns the full account's active keys.
  const existing = await query<{ source_key: string; content_digest: string }>(
    tx,
    "SELECT source_key, content_digest FROM cgt.transactions WHERE account_id = $1 AND active",
    [a.id],
  );
  return reviewCsv(csv, {
    broker: a.broker,
    accountId: a.id,
    accountType: a.account_type,
    format,
    ordinarySharesConfirmed,
    supportingDetails,
    latestTradeDate: ukCalendarDate(new Date()),
    existing: new Map(
      existing.map((row) => [row.source_key, row.content_digest]),
    ),
  });
}

export class Workspace {
  constructor(private readonly db: OwnedDatabase) {}

  async consumeRequest(
    identity: Identity,
    bucket: "general" | "upload" | "calculate" | "billing",
  ) {
    const maximum = bucket === "general" ? 60 : 10;
    const allowed = await this.db.run(identity, (tx) =>
      query(
        tx,
        `INSERT INTO cgt.request_limits(owner_id,bucket) VALUES($1,$2)
      ON CONFLICT(owner_id,bucket) DO UPDATE SET
        window_start=CASE WHEN cgt.request_limits.window_start <= now()-interval '1 minute' THEN now() ELSE cgt.request_limits.window_start END,
        request_count=CASE WHEN cgt.request_limits.window_start <= now()-interval '1 minute' THEN 1 ELSE cgt.request_limits.request_count+1 END
      WHERE cgt.request_limits.request_count < $3 OR cgt.request_limits.window_start <= now()-interval '1 minute'
      RETURNING request_count`,
        [identity.ownerId, bucket, maximum],
      ),
    );
    if (!allowed.length)
      throw new AppError(
        429,
        "TOO_MANY_REQUESTS",
        "Too many requests. Wait one minute, then try again.",
      );
  }

  async importHistory(identity: Identity, page: number) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new AppError(400, "INVALID_PAGE", "Choose a valid history page.");
    return this.db.run(identity, async (tx) => {
      const total = (
        await query<{ count: number }>(
          tx,
          "SELECT count(*)::int AS count FROM cgt.imports",
        )
      )[0]!.count;
      const imports = await query(
        tx,
        `SELECT id,account_id,status,record_count,accepted_count,excluded_count,duplicate_count,
        created_at,reversed_at,reversal_reason FROM cgt.imports ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET $1`,
        [(page - 1) * 25],
      );
      return { imports, total, page, pageSize: 25 };
    });
  }

  async importDetail(identity: Identity, importId: string, page: number) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new AppError(
        400,
        "INVALID_PAGE",
        "Choose a valid source-row page.",
      );
    const start = (page - 1) * 25;
    return this.db.run(identity, async (tx) => {
      const receipt = (
        await query<{
          total: number;
          records: { record: number; status: string; reason: string }[];
        }>(
          tx,
          `SELECT jsonb_array_length(i.record_receipts) AS total, ARRAY(
          SELECT jsonb_build_object(
            'record', i.record_receipts->n->'record',
            'status', i.record_receipts->n->'status',
            'reason', i.record_receipts->n->'reason'
          ) FROM generate_series($2::int, least($2::int + 24, jsonb_array_length(i.record_receipts) - 1)) AS n
          ORDER BY n
        ) AS records FROM cgt.imports AS i WHERE i.id = $1`,
          [requireUuid(importId), start],
        )
      )[0];
      if (!receipt) throw missing();
      return { ...receipt, page, pageSize: 25 };
    });
  }

  async overview(identity: Identity) {
    return this.db.run(identity, async (tx) => {
      // Unique owner index serialises concurrent first visits; no advisory key collisions.
      await query(
        tx,
        `INSERT INTO cgt.portfolios(owner_id, name) VALUES ($1, 'Personal investments') ON CONFLICT (owner_id) DO NOTHING`,
        [identity.ownerId],
      );
      const portfolios = await query<Portfolio>(
        tx,
        "SELECT id, revision, name FROM cgt.portfolios",
      );
      const accounts = await query<Account>(
        tx,
        "SELECT id, portfolio_id, broker, label, account_type FROM cgt.broker_accounts ORDER BY label, id",
      );
      const imports = await query(
        tx,
        `SELECT id, account_id, status, record_count, accepted_count, excluded_count,
        duplicate_count, created_at, reversed_at, reversal_reason FROM cgt.imports ORDER BY created_at DESC, id DESC LIMIT 100`,
      );
      const calculations = await query(
        tx,
        `SELECT r.id, r.tax_year, r.status, r.history_through, r.result, r.coverage_confirmed, r.coverage_accounts, r.created_at
        FROM cgt.published_calculations p JOIN cgt.calculation_runs r ON r.id = p.run_id ORDER BY r.tax_year DESC`,
      );
      const drafts = await query(
        tx,
        "SELECT id, account_id, created_at, expires_at FROM cgt.import_drafts WHERE expires_at > now() ORDER BY created_at DESC",
      );
      return {
        portfolio: portfolios[0]!,
        accounts,
        imports,
        drafts,
        calculations,
      };
    });
  }

  async reportSources(
    identity: Identity,
    sourceKeys: string[],
  ): Promise<ReportSource[]> {
    if (!sourceKeys.length) return [];
    return this.db.run(identity, (tx) =>
      query<ReportSource>(
        tx,
        `
      SELECT t.source_key AS key, a.label, a.broker, t.source_record AS record,
        left(coalesce(nullif(f.fields->>'Name',''), nullif(f.fields->>'Stock name',''),
                      nullif(f.fields->>'Ticker',''), nullif(f.fields->>'Symbol','')),120) AS instrument,
        left(coalesce(nullif(f.fields->>'ID',''), nullif(f.fields->>'Reference',''),
                      nullif(f.fields->>'TradeID',''), nullif(f.fields->>'Order ID','')),120) AS reference
      FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
      CROSS JOIN LATERAL (SELECT t.provenance->'native'->'fields' AS fields) f
      WHERE t.source_key=ANY($1::text[])
    `,
        [sourceKeys],
      ),
    );
  }

  async reportSnapshot(
    identity: Identity,
    runId: string,
  ): Promise<ReportSnapshot> {
    return this.db.run(identity, async (tx) => {
      const rows = await query<ReportSnapshot>(
        tx,
        `SELECT r.id,r.input_digest,r.created_at,r.coverage_confirmed,r.result,
          (SELECT coalesce(jsonb_agg(jsonb_build_object('label',a.label,'broker',a.broker,'confirmed',r.coverage_accounts ? a.id::text) ORDER BY a.label,a.id),'[]'::jsonb)
           FROM cgt.broker_accounts a WHERE a.portfolio_id=r.portfolio_id) AS accounts
        FROM cgt.calculation_runs r JOIN cgt.published_calculations p ON p.run_id=r.id
        JOIN cgt.portfolios f ON f.id=r.portfolio_id AND f.revision=r.portfolio_revision
        WHERE r.id=$1`,
        [requireUuid(runId)],
      );
      if (!rows[0])
        throw new AppError(
          404,
          "REPORT_UNAVAILABLE",
          "This calculation is unavailable or has changed. Recalculate and choose the latest report.",
        );
      const pending = await query(
        tx,
        "SELECT id FROM cgt.import_drafts WHERE expires_at>now() LIMIT 1",
      );
      if (pending.length)
        throw new AppError(
          409,
          "PENDING_IMPORTS",
          "Finish or discard your import previews before downloading a report.",
        );
      return rows[0];
    });
  }

  async addAccount(
    identity: Identity,
    input: {
      portfolioId: string;
      broker: string;
      label: string;
      accountType: string;
    },
  ) {
    if (input.accountType !== "GIA")
      throw new AppError(
        400,
        "UNSUPPORTED_ACCOUNT",
        "Add a taxable general investment account. ISA and pension accounts must stay separate.",
      );
    if (!BROKERS.some((b) => b.id === input.broker))
      throw new AppError(
        400,
        "INVALID_BROKER",
        "Select one of the listed brokers.",
      );
    const label = requireLabel(input.label);
    return this.db.run(identity, async (tx) => {
      await lockPortfolio(tx, input.portfolioId);
      const count = await query<{ count: number }>(
        tx,
        "SELECT count(*)::int AS count FROM cgt.broker_accounts WHERE portfolio_id = $1",
        [input.portfolioId],
      );
      if (count[0]!.count >= 50)
        throw new AppError(
          409,
          "ACCOUNT_LIMIT",
          "This workspace has reached its 50-account limit.",
        );
      const rows = await query<Account>(
        tx,
        `INSERT INTO cgt.broker_accounts(portfolio_id,owner_id,broker,account_type,label)
        VALUES ($1,$2,$3,'GIA',$4) RETURNING id, portfolio_id, broker, account_type, label`,
        [input.portfolioId, identity.ownerId, input.broker, label],
      );
      await invalidate(tx, input.portfolioId);
      return rows[0]!;
    });
  }

  async prepareImport(
    identity: Identity,
    input: {
      accountId: string;
      csv: string;
      format: Draft["format"];
      ordinarySharesConfirmed?: boolean;
    },
  ) {
    if (
      typeof input.csv !== "string" ||
      !input.csv.trim() ||
      Buffer.byteLength(input.csv, "utf8") > MAX_CSV_BYTES
    ) {
      throw new AppError(
        400,
        "INVALID_FILE",
        "Choose a non-empty UTF-8 CSV no larger than 10 MiB.",
      );
    }
    if (!["native", "canonical-v1"].includes(input.format))
      throw new AppError(400, "INVALID_FORMAT", "Choose the file format.");
    if (
      input.ordinarySharesConfirmed !== undefined &&
      typeof input.ordinarySharesConfirmed !== "boolean"
    )
      throw new AppError(
        400,
        "INVALID_CONFIRMATION",
        "Use the ordinary-share confirmation checkbox.",
      );
    return this.db.run(identity, async (tx) => {
      const a = await account(tx, input.accountId);
      const p = await lockPortfolio(tx, a.portfolio_id);
      await query(
        tx,
        "DELETE FROM cgt.import_drafts WHERE expires_at <= now()",
      );
      const drafts = await query<{ count: number }>(
        tx,
        "SELECT count(*)::int AS count FROM cgt.import_drafts",
      );
      if (drafts[0]!.count >= 5)
        throw new AppError(
          409,
          "DRAFT_LIMIT",
          "Discard an earlier preview before uploading another file. You can keep five previews for 24 hours.",
        );
      const review = await preview(
        tx,
        a,
        input.csv,
        input.format,
        input.ordinarySharesConfirmed,
      );
      const rows = await query<{ id: string }>(
        tx,
        `INSERT INTO cgt.import_drafts(owner_id,account_id,csv,format,reviewed_revision,ordinary_shares_confirmed)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          identity.ownerId,
          a.id,
          input.csv,
          input.format,
          p.revision,
          input.ordinarySharesConfirmed === true,
        ],
      );
      return {
        broker: a.broker,
        draftId: rows[0]!.id,
        accountId: a.id,
        revision: p.revision,
        reviewVersion: 0,
        review,
      };
    });
  }

  async discardDraft(identity: Identity, draftId: string) {
    return this.db.run(identity, async (tx) => {
      const draft = (
        await query<{ account_id: string }>(
          tx,
          "SELECT account_id FROM cgt.import_drafts WHERE id = $1",
          [requireUuid(draftId)],
        )
      )[0];
      if (!draft) return;
      const a = await account(tx, draft.account_id);
      await lockPortfolio(tx, a.portfolio_id);
      await query(tx, "DELETE FROM cgt.import_drafts WHERE id = $1", [
        requireUuid(draftId),
      ]);
    });
  }

  async reviewImport(identity: Identity, draftId: string) {
    return this.db.run(identity, async (tx) => {
      let draft = (
        await query<Draft>(
          tx,
          "SELECT * FROM cgt.import_drafts WHERE id = $1 AND expires_at > now()",
          [requireUuid(draftId)],
        )
      )[0];
      if (!draft)
        throw new AppError(
          404,
          "PREVIEW_EXPIRED",
          "This preview has expired or was discarded. Upload the file again to continue.",
        );
      const a = await account(tx, draft.account_id);
      const p = await lockPortfolio(tx, a.portfolio_id);
      draft = (
        await query<Draft>(
          tx,
          "SELECT * FROM cgt.import_drafts WHERE id=$1 AND expires_at>now()",
          [draftId],
        )
      )[0]!;
      if (!draft)
        throw new AppError(
          404,
          "PREVIEW_EXPIRED",
          "This preview has expired or was discarded.",
        );
      const review = await preview(
        tx,
        a,
        draft.csv,
        draft.format,
        draft.ordinary_shares_confirmed,
        draft.supporting_details,
      );
      await query(
        tx,
        "UPDATE cgt.import_drafts SET reviewed_revision = $2 WHERE id = $1",
        [draftId, p.revision],
      );
      return {
        draftId,
        accountId: a.id,
        revision: p.revision,
        reviewVersion: draft.review_version,
        review,
      };
    });
  }

  async supplyImportDetails(
    identity: Identity,
    draftId: string,
    record: number,
    details: SupportingDetails,
    expectedReviewVersion: number,
  ) {
    try {
      validateDetails({ [record]: details });
    } catch (error) {
      throw new AppError(400, "INVALID_DETAILS", (error as Error).message);
    }
    return this.db.run(identity, async (tx) => {
      let draft = (
        await query<Draft>(
          tx,
          "SELECT * FROM cgt.import_drafts WHERE id=$1 AND expires_at>now()",
          [requireUuid(draftId)],
        )
      )[0];
      if (!draft) throw missing();
      const a = await account(tx, draft.account_id),
        p = await lockPortfolio(tx, a.portfolio_id);
      draft = (
        await query<Draft>(
          tx,
          "SELECT * FROM cgt.import_drafts WHERE id=$1 AND expires_at>now()",
          [draftId],
        )
      )[0];
      if (!draft) throw missing();
      if (draft.review_version !== expectedReviewVersion)
        throw new AppError(
          409,
          "DETAILS_CHANGED",
          "This preview changed in another window. Reopen it before updating details.",
        );
      const before = await preview(
        tx,
        a,
        draft.csv,
        draft.format,
        draft.ordinary_shares_confirmed,
        draft.supporting_details,
      );
      if (!before.records.find((r) => r.record === record)?.canSupplyDetails)
        throw new AppError(
          400,
          "INVALID_RECORD",
          "This record cannot be resolved with supporting trade details. Check the export format and activity.",
        );
      const supporting = { ...draft.supporting_details, [record]: details };
      const review = await preview(
        tx,
        a,
        draft.csv,
        draft.format,
        draft.ordinary_shares_confirmed,
        supporting,
      );
      const next = draft.review_version + 1;
      await query(
        tx,
        "UPDATE cgt.import_drafts SET supporting_details=$2::jsonb,review_version=$3,reviewed_revision=$4 WHERE id=$1",
        [draftId, JSON.stringify(supporting), next, p.revision],
      );
      return {
        draftId,
        accountId: a.id,
        revision: p.revision,
        reviewVersion: next,
        broker: a.broker,
        review,
      };
    });
  }

  async commitImport(
    identity: Identity,
    draftId: string,
    expectedRevision: number,
    expectedReviewVersion = 0,
  ) {
    requireUuid(draftId);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
      throw new AppError(
        400,
        "INVALID_REVISION",
        "Review this file again before importing.",
      );
    return this.db.run(identity, async (tx) => {
      // The draft UUID is also the immutable import UUID: retries return the same receipt.
      const done = (
        await query<Import>(
          tx,
          "SELECT id, status, account_id FROM cgt.imports WHERE id = $1",
          [draftId],
        )
      )[0];
      if (done)
        return {
          outcome: "already_committed" as const,
          importId: done.id,
          status: done.status,
        };
      let draft = (
        await query<Draft>(
          tx,
          "SELECT * FROM cgt.import_drafts WHERE id = $1 AND expires_at > now()",
          [draftId],
        )
      )[0];
      if (!draft) {
        // READ COMMITTED takes a new snapshot per statement. Another request may
        // have saved the import and deleted its draft after our first lookup.
        const completed = (
          await query<Import>(
            tx,
            "SELECT id, status, account_id FROM cgt.imports WHERE id = $1",
            [draftId],
          )
        )[0];
        if (completed)
          return {
            outcome: "already_committed" as const,
            importId: completed.id,
            status: completed.status,
          };
        throw new AppError(
          404,
          "PREVIEW_EXPIRED",
          "This preview has expired or was discarded. Upload the file again; saved transactions are unaffected.",
        );
      }
      const a = await account(tx, draft.account_id);
      const p = await lockPortfolio(tx, a.portfolio_id);
      // A concurrent request may have committed this very draft while we waited.
      const retry = (
        await query<Import>(
          tx,
          "SELECT id, status, account_id FROM cgt.imports WHERE id = $1",
          [draftId],
        )
      )[0];
      if (retry)
        return {
          outcome: "already_committed" as const,
          importId: retry.id,
          status: retry.status,
        };
      const stillAvailable = await query(
        tx,
        "SELECT id FROM cgt.import_drafts WHERE id = $1 AND expires_at > now()",
        [draftId],
      );
      if (!stillAvailable.length)
        throw new AppError(
          404,
          "PREVIEW_EXPIRED",
          "This preview was discarded or expired. Upload the file again to continue.",
        );
      draft = (
        await query<Draft>(
          tx,
          "SELECT * FROM cgt.import_drafts WHERE id=$1 AND expires_at>now()",
          [draftId],
        )
      )[0]!;
      if (!draft)
        throw new AppError(
          404,
          "PREVIEW_EXPIRED",
          "This preview has expired or was discarded.",
        );
      const review = await preview(
        tx,
        a,
        draft.csv,
        draft.format,
        draft.ordinary_shares_confirmed,
        draft.supporting_details,
      );
      if (
        p.revision !== expectedRevision ||
        p.revision !== draft.reviewed_revision ||
        draft.review_version !== expectedReviewVersion
      ) {
        await query(
          tx,
          "UPDATE cgt.import_drafts SET reviewed_revision = $2 WHERE id = $1",
          [draftId, p.revision],
        );
        return {
          outcome: "review_changed" as const,
          accountId: a.id,
          revision: p.revision,
          reviewVersion: draft.review_version,
          review,
        };
      }
      if (review.status !== "ready")
        return {
          outcome: "needs_review" as const,
          accountId: a.id,
          revision: p.revision,
          reviewVersion: draft.review_version,
          review,
        };
      const c = review.counts;
      await query(
        tx,
        `INSERT INTO cgt.imports(id,account_id,owner_id,file_digest,parser_version,status,
        record_count,accepted_count,excluded_count,duplicate_count,review_count,record_receipts)
        VALUES ($1,$2,$3,$4,$5,'committed',$6,$7,$8,$9,0,$10::jsonb)`,
        [
          draftId,
          a.id,
          identity.ownerId,
          review.fileDigest,
          review.parserVersion,
          c.total,
          c.accepted,
          c.excluded,
          c.duplicate,
          JSON.stringify(
            review.records.map(
              ({ record, status, reason, sourceKey, digest }) => ({
                record,
                status,
                reason,
                sourceKey,
                digest,
              }),
            ),
          ),
        ],
      );
      const accepted = review.records
        .filter((row) => row.status === "accepted")
        .map((row) => ({
          source_key: row.sourceKey!,
          content_digest: row.digest!,
          source_record: row.record,
          security_id: row.trade!.securityId,
          trade_date: row.trade!.date,
          side: row.trade!.side,
          quantity: row.trade!.quantity,
          consideration_gbp: row.trade!.considerationGBP,
          fees_gbp: row.trade!.feesGBP,
          provenance: row.provenance!,
        }));
      // Bounded batches avoid the PostgreSQL parameter ceiling on large histories.
      for (let offset = 0; offset < accepted.length; offset += 1000) {
        await query(
          tx,
          `INSERT INTO cgt.transactions(account_id,import_id,owner_id,source_key,content_digest,source_record,
          security_id,trade_date,side,quantity,consideration_gbp,fees_gbp,provenance)
          SELECT $1,$2,$3,x.* FROM jsonb_to_recordset($4::jsonb) AS x(source_key text,content_digest text,source_record int,
            security_id text,trade_date date,side text,quantity numeric,consideration_gbp numeric,fees_gbp numeric,provenance jsonb)`,
          [
            a.id,
            draftId,
            identity.ownerId,
            JSON.stringify(accepted.slice(offset, offset + 1000)),
          ],
        );
      }
      await invalidate(tx, a.portfolio_id);
      await query(tx, "DELETE FROM cgt.import_drafts WHERE id = $1", [draftId]);
      return { outcome: "committed" as const, importId: draftId, counts: c };
    });
  }

  async reverseImport(identity: Identity, importId: string, reason: string) {
    requireUuid(importId);
    reason = requireLabel(reason);
    return this.db.run(identity, async (tx) => {
      const row = (
        await query<Import>(
          tx,
          "SELECT id, account_id, status FROM cgt.imports WHERE id = $1",
          [importId],
        )
      )[0];
      if (!row) throw missing();
      const a = await account(tx, row.account_id);
      await lockPortfolio(tx, a.portfolio_id);
      const changed = await query(
        tx,
        `UPDATE cgt.imports SET status='reversed', reversed_at=now(), reversal_reason=$2
        WHERE id=$1 AND status='committed' RETURNING id`,
        [importId, reason],
      );
      if (changed.length) {
        await query(
          tx,
          "UPDATE cgt.transactions SET active=false WHERE import_id=$1",
          [importId],
        );
        await invalidate(tx, a.portfolio_id);
      }
      return { importId, status: "reversed" as const };
    });
  }

  async calculate(
    identity: Identity,
    input: {
      portfolioId: string;
      taxYear: string;
      historyThrough: string;
      confirmedAccountIds: string[];
    },
  ) {
    if (!Object.hasOwn(TAX_YEARS, input.taxYear))
      throw new AppError(400, "INVALID_YEAR", "Choose an available tax year.");
    try {
      calendarDate(input.historyThrough);
    } catch {
      throw new AppError(
        400,
        "INVALID_DATE",
        "Enter a valid history date in YYYY-MM-DD format.",
      );
    }
    if (input.historyThrough > ukCalendarDate(new Date()))
      throw new AppError(
        400,
        "FUTURE_HISTORY",
        "You cannot confirm transaction history for a future date.",
      );
    if (
      !Array.isArray(input.confirmedAccountIds) ||
      input.confirmedAccountIds.some((id) => typeof id !== "string")
    )
      throw new AppError(
        400,
        "INVALID_COVERAGE",
        "Confirm which accounts have complete transaction history.",
      );
    return this.db.run(identity, async (tx) => {
      const p = await lockPortfolio(tx, input.portfolioId);
      const accounts = await query<{ id: string }>(
        tx,
        "SELECT id FROM cgt.broker_accounts WHERE portfolio_id=$1 ORDER BY id",
        [p.id],
      );
      const accountIds = accounts.map((row) => row.id);
      const confirmed = [...new Set(input.confirmedAccountIds)].sort();
      const coverageConfirmed =
        accountIds.length > 0 &&
        JSON.stringify(accountIds) === JSON.stringify(confirmed);
      const pending = await query<{ count: number }>(
        tx,
        `SELECT count(*)::int AS count FROM cgt.import_drafts d
        JOIN cgt.broker_accounts a ON a.id=d.account_id WHERE a.portfolio_id=$1 AND d.expires_at>now()`,
        [p.id],
      );
      if (pending[0]!.count > 0)
        throw new AppError(
          409,
          "PENDING_IMPORTS",
          "Finish or discard your import previews before calculating. Unresolved files may change the result.",
        );
      const trades = await query<Trade>(
        tx,
        `SELECT t.source_key AS id,t.security_id AS "securityId",t.trade_date::text AS date,t.side,
        t.quantity::text AS quantity,t.consideration_gbp::text AS "considerationGBP",t.fees_gbp::text AS "feesGBP"
        FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
        WHERE a.portfolio_id=$1 AND t.active AND t.trade_date <= $2::date ORDER BY t.trade_date,t.source_key`,
        [p.id, input.historyThrough],
      );
      if (!trades.length)
        throw new AppError(
          409,
          "NO_TRANSACTIONS",
          "Import your transaction history before calculating gains.",
        );
      const result = calculateGains(trades, {
        taxYear: input.taxYear as keyof typeof TAX_YEARS,
        historyThrough: input.historyThrough,
      });
      const digest = fingerprint({
        trades,
        taxYear: input.taxYear,
        historyThrough: input.historyThrough,
        revision: p.revision,
        confirmed,
      });
      const runs = await query<{ id: string }>(
        tx,
        `INSERT INTO cgt.calculation_runs(portfolio_id,owner_id,tax_year,engine_version,input_digest,
        status,history_through,result,portfolio_revision,coverage_confirmed,coverage_accounts)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
        [
          p.id,
          identity.ownerId,
          input.taxYear,
          ENGINE_VERSION,
          digest,
          result.status,
          input.historyThrough,
          JSON.stringify(result),
          p.revision,
          coverageConfirmed,
          JSON.stringify(confirmed),
        ],
      );
      const runId =
        runs[0]?.id ??
        (
          await query<{ id: string }>(
            tx,
            `SELECT id FROM cgt.calculation_runs WHERE portfolio_id=$1 AND tax_year=$2 AND engine_version=$3 AND input_digest=$4`,
            [p.id, input.taxYear, ENGINE_VERSION, digest],
          )
        )[0]!.id;
      await query(
        tx,
        `INSERT INTO cgt.published_calculations(portfolio_id,owner_id,tax_year,run_id) VALUES($1,$2,$3,$4)
        ON CONFLICT(portfolio_id,tax_year) DO UPDATE SET run_id=excluded.run_id`,
        [p.id, identity.ownerId, input.taxYear, runId],
      );
      return {
        runId,
        result,
        coverageConfirmed,
        portfolioRevision: p.revision,
      };
    });
  }
}
