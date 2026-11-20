import { reviewedCalculationInputs } from "./reviewed-opening-pools";
import { createHash } from "node:crypto";
import { evidenceIssue, purchaseIssue, type ReportIssue } from "../domain/reports/eligibility";
import { matchingSaleNames, statementSaleLimit } from "../domain/reports/report";
import type { ReportDestination } from "../domain/reports/destination";
import { BROKERS, type BrokerId } from "../domain/imports/brokers";
import {
  MAX_CSV_BYTES,
  reviewCsv,
  type ImportReview,
} from "../domain/imports/review";
import { calculateGains, ENGINE_VERSION } from "../domain/cgt/calculate";
import { CURRENT_SCOPE_DECLARATION as scopeDeclaration, type Calculation, type Trade } from "../domain/cgt/types";
import { calendarDate, TAX_YEARS, ukCalendarDate } from "../domain/values";
import { type Connection, OwnedDatabase, query } from "./database";
import { activeImportIssue } from "./import-integrity";
import { AppError, requireLabel, requireUuid } from "./errors";
import type { Identity } from "./identity";
import { draftSummary, type DraftSummary } from "../domain/imports/draft-summary";
import {
  validateDetails,
  type ImportDetails,
  type SupportingDetails,
} from "../domain/imports/supporting-details";
import type { ReportKind, ReportSnapshot, ReportSource } from "../domain/reports/report";
import { importTradeDetail, type ImportTradeDetail } from "../domain/imports/trade-detail";

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
  ibkr_client_account_id?: string | null;
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
  display_summary: DraftSummary | null;
}
interface Import {
  id: string;
  status: "committed" | "reversed";
  account_id: string;
}

interface ReceiptRecord {
  record: number;
  status: "accepted" | "duplicate" | "excluded";
  reason: string;
  tradeDetail?: ImportTradeDetail;
  statementReference?: string;
}

const missing = () =>
  new AppError(
    404,
    "NOT_FOUND",
    "This item is unavailable. Return to your workspace and try again.",
  );
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");


interface EvidenceRun {
  result: Calculation;
  input_digest: string;
  portfolio_id: string;
  portfolio_revision: number;
  coverage_accounts: string[];
}

/** Read just the broker label and lookup key. Large portfolios share bounded, indexed queries. */
async function brokerInstrumentNames(tx: Connection, keys: string[], keyColumn: "t.source_key" | "t.security_id") {
  const byKey = new Map<string, string>();
  const distinct = [...new Set(keys)];
  const batchSize = 1000;
  for (let offset = 0; offset < distinct.length; offset += batchSize) {
    const rows = await query<{ key: string; name: string }>(tx, `
      SELECT ${keyColumn} AS key, min(n.name) AS name
      FROM cgt.transactions t
      CROSS JOIN LATERAL (SELECT t.provenance->'native'->'fields' AS fields) f
      CROSS JOIN LATERAL (SELECT coalesce(nullif(btrim(f.fields->>'Name'),''),
        nullif(btrim(f.fields->>'Stock name'),''), nullif(btrim(f.fields->>'Title'),''),
        nullif(btrim(CASE WHEN t.provenance#>>'{native,format}' LIKE 'ii-%'
          THEN regexp_replace(f.fields->>'Description', '^(purchase|bought|buy|sale|sold|sell)([[:space:]]+of)?([[:space:]]+|$)', '', 'i')
          ELSE f.fields->>'Description' END),'')) AS name) n
      WHERE t.active AND ${keyColumn} = ANY($1::text[]) AND n.name IS NOT NULL
      GROUP BY ${keyColumn} HAVING count(DISTINCT lower(n.name)) = 1 AND length(min(n.name)) <= 200
    `, [distinct.slice(offset, offset + batchSize)]);
    for (const row of rows) byKey.set(row.key, row.name);
  }
  return byKey;
}

async function disposalNames(tx: Connection, disposals: Calculation["disposals"]) {
  const bySource = await brokerInstrumentNames(tx, disposals.flatMap(sale => sale.sourceIds), "t.source_key");
  return matchingSaleNames(disposals, key => bySource.get(key));
}

async function transactionSources(tx: Connection, sourceKeys: string[]): Promise<ReportSource[]> {
  if (!sourceKeys.length) return [];
  return query<ReportSource>(
    tx,
    `
      SELECT t.source_key AS key, a.label, a.broker, t.source_record AS record, t.import_id::text AS "importReference",
        left(coalesce(nullif(f.fields->>'Name',''), nullif(f.fields->>'Stock name',''),
                      nullif(f.fields->>'Ticker',''), nullif(f.fields->>'Symbol',''),
                      nullif(f.fields->>'Description','')),120) AS instrument,
        coalesce(nullif(t.provenance->>'executionReference',''), nullif(f.fields->>'ID',''), nullif(f.fields->>'Reference',''),
                 nullif(f.fields->>'TradeID',''), nullif(f.fields->>'Order ID',''),
                 nullif(btrim(f.details->>'transactionId'),'')) AS reference,
        nullif(btrim(f.details->>'reference'),'') AS "statementReference",
        CASE WHEN t.provenance->>'originalCurrency' <> 'GBP' THEN jsonb_build_object(
          'currency', t.provenance->>'originalCurrency', 'consideration', t.provenance->>'consideration',
          'fees', t.provenance->>'fees', 'gbpPerUnit', t.provenance->>'gbpPerUnit',
          'considerationGBP', trim_scale(cgt.ledger_gbp(t.consideration_gbp, t.provenance->>'consideration', t.provenance->>'gbpPerUnit'))::text,
          'feesGBP', trim_scale(cgt.ledger_gbp(t.fees_gbp, t.provenance->>'fees', t.provenance->>'gbpPerUnit'))::text
        ) END AS conversion,
        CASE WHEN t.provenance->>'originalCurrency'='GBP' AND f.details->>'currency' <> 'GBP'
          AND coalesce(f.fields->>'Price per Share', f.fields->>'Price / share') IS NOT NULL
          THEN jsonb_build_object('instrumentCurrency', f.details->>'currency',
            'price', coalesce(f.fields->>'Price per Share', f.fields->>'Price / share'),
            'quantity', trim_scale(t.quantity)::text, 'gbpPerUnit', f.details->>'gbpPerUnit',
            'considerationGBP', trim_scale(t.consideration_gbp)::text, 'feesGBP', trim_scale(t.fees_gbp)::text)
        END AS "sterlingSettlement"
      FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
      CROSS JOIN LATERAL (SELECT t.provenance->'native'->'fields' AS fields,
                                 t.provenance->'native'->'supportingDetails' AS details) f
      WHERE t.active AND t.source_key=ANY($1::text[]) ORDER BY t.source_key
    `,
    [sourceKeys],
  );
}

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
  // All readers of a published result require a matching revision. Keep the
  // pointer so recalculation can refer to the inputs the investor last saved,
  // even when that save reused an earlier immutable run.
  await query(
    tx,
    "UPDATE cgt.portfolios SET revision = revision + 1 WHERE id = $1",
    [portfolioId],
  );
}

async function publishedReportYears(tx: Connection, portfolioId: string) {
  const rows = await query<{ tax_year: string }>(
    tx,
    `SELECT p.tax_year FROM cgt.published_calculations p
     JOIN cgt.calculation_runs r ON r.id=p.run_id
     JOIN cgt.portfolios f ON f.id=p.portfolio_id AND f.revision=r.portfolio_revision
     WHERE p.portfolio_id=$1 ORDER BY p.tax_year DESC`,
    [portfolioId],
  );
  return rows.map((row) => row.tax_year);
}

const cashEvidence = (source: Record<string, string>) =>
  Object.fromEntries(Object.entries(source).filter(([key,value]) => value && !["Notes","Title","Name"].includes(key)));

async function preview(
  tx: Connection,
  a: Account,
  csv: string,
  format: Draft["format"],
  ordinarySharesConfirmed = false,
  supportingDetails: ImportDetails = {},
): Promise<ImportReview> {
  const ibkr = a.broker === "ibkr";
  const fileDigest = createHash("sha256").update(csv).digest("hex");
  const peerReceipts = await query<{ id: string; label: string; file_digest: string }>(tx,
    `SELECT i.id,a.label,i.file_digest FROM cgt.imports i JOIN cgt.broker_accounts a ON a.id=i.account_id
     WHERE a.portfolio_id=$1 AND a.broker=$2 AND a.id<>$3 AND i.status='committed' AND NOT EXISTS(
       SELECT 1 FROM cgt.reviewed_statement_overlaps r WHERE r.account_id=$3 AND r.file_digest=$4 AND r.other_import_id=i.id)`,
    [a.portfolio_id,a.broker,a.id,fileDigest]);
  const peers = new Map(peerReceipts.map(r => [r.id, r.label + " (receipt " + r.id + ")"]));
  const existing = await query<{
    account_id: string; import_id: string; source_key: string; content_digest: string;
    supporting_details: SupportingDetails | null; native: boolean;
    instrument_gross: string | null; instrument_price: string | null;
    original: { originalCurrency: string; consideration: string; fees: string; gbpPerUnit: string } | null;
    external: string | null; binding: string | null; trade: Omit<Trade, "id"> | null;
  }>(tx, `SELECT t.account_id,t.import_id,t.source_key,t.content_digest,t.provenance->'native'->'supportingDetails' AS supporting_details,
      t.provenance ? 'native' AS native,t.provenance#>>'{native,fields,ClientAccountID}' AS external,
      a.ibkr_client_account_id AS binding,
      CASE WHEN t.account_id=$1 THEN t.provenance - 'native' END AS original,
      coalesce(t.provenance#>>'{native,fields,Total Shares Amount}',t.provenance#>>'{native,fields,Total Amount in Instrument Currency}') AS instrument_gross,
      t.provenance#>>'{native,fields,Price / share}' AS instrument_price,
      CASE WHEN t.account_id=$1 THEN jsonb_build_object('securityId',security_id,'date',trade_date::text,'side',side,
        'quantity',quantity::text,'considerationGBP',trim_scale(cgt.ledger_gbp(t.consideration_gbp,t.provenance->>'consideration',t.provenance->>'gbpPerUnit'))::text,
        'feesGBP',trim_scale(cgt.ledger_gbp(t.fees_gbp,t.provenance->>'fees',t.provenance->>'gbpPerUnit'))::text) END AS trade
      FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
      WHERE t.active AND a.portfolio_id=$2 AND a.broker=$3`,
    [a.id,a.portfolio_id,a.broker]);
  const peerKeys = new Map<string, Map<string,string>>();
  for (const row of existing) {
    const receipt = peers.get(row.import_id);
    if (!receipt || ibkr) continue;
    let keys = peerKeys.get(row.account_id);
    if (!keys) peerKeys.set(row.account_id, keys = new Map());
    keys.set(row.source_key, receipt);
  }
  const ibkrOtherAccounts = new Map<string,string>();
  const ibkrUnboundKeys = new Map<string,Set<string>>();
  let binding = a.ibkr_client_account_id;
  for (const row of existing) {
    if (!ibkr) break;
    const external = row.external || row.binding;
    if (row.account_id === a.id) binding ??= external;
    else if (external) ibkrOtherAccounts.set(external, row.account_id);
    else {
      let records = ibkrUnboundKeys.get(row.account_id);
      if (!records) ibkrUnboundKeys.set(row.account_id, records = new Set());
      records.add(row.source_key);
    }
  }
  const identical = peerReceipts.find(r => r.file_digest === fileDigest);
  const review = reviewCsv(csv, {
    otherAccountExecutions: peerKeys,
    identicalStatementReceipt: !ibkr && identical ? peers.get(identical.id) : undefined,
    broker: a.broker, accountId: a.id, accountType: a.account_type, format,
    ordinarySharesConfirmed, supportingDetails, latestTradeDate: ukCalendarDate(new Date()),
    ibkrClientAccountId: binding, ibkrOtherAccounts, ibkrUnboundKeys,
    ibkrUnverifiedHistory: ibkr && !binding && existing.some(row => row.account_id === a.id),
    existing: new Map(existing.filter(row => row.account_id === a.id).map(row => [row.source_key, {
      digest: row.content_digest, supportingDetails: row.supporting_details ?? undefined,
      native: row.native, trade: row.trade ?? undefined, original: row.original ?? undefined,
      instrumentGross: row.instrument_gross, instrumentPrice: row.instrument_price,
    }])),
  });
  if (review.counts.duplicate && !review.counts.accepted && !review.issues.length && !review.counts.needsReview) {
    const [legacy] = await query<{id:string}>(tx, `SELECT id FROM cgt.unverified_import_receipts
      WHERE account_id=$1 AND file_digest=$2 LIMIT 1`, [a.id, fileDigest]);
    if (legacy) return { ...review, status: "ready", revalidatesReceiptId: legacy.id };
  }
  return review;
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
        `SELECT i.*, (
          SELECT jsonb_build_object('date', t.trade_date::text, 'side', t.side,
            'securityId', t.security_id, 'quantity', trim_scale(t.quantity)::text)
          FROM cgt.transactions t WHERE t.import_id = i.id
          ORDER BY t.source_record LIMIT 1
        ) AS "firstTrade"
        FROM (
          SELECT id,account_id,status,record_count,accepted_count,excluded_count,duplicate_count,
            created_at,reversed_at,reversal_reason FROM cgt.imports
          ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET $1
        ) i ORDER BY i.created_at DESC,i.id DESC`,
        [(page - 1) * 25],
      );
      return { imports, total, page, pageSize: 25 };
    });
  }

  async importDetail(identity: Identity, importId: string, page: number, sourceRecord?: number) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new AppError(
        400,
        "INVALID_PAGE",
        "Choose a valid source-row page.",
      );
    requireUuid(importId);
    if (sourceRecord !== undefined && (!Number.isSafeInteger(sourceRecord) || sourceRecord < 1))
      throw new AppError(400, "INVALID_RECORD", "Choose a valid source record.");
    return this.db.run(identity, async (tx) => {
      if (sourceRecord !== undefined) {
        // Archived receipts may contain only included trades, with gaps in their record numbers.
        const position = await query<{ offset: number | null }>(
          tx,
          `SELECT CASE WHEN jsonb_array_length(i.record_receipts) > 0 THEN
            (SELECT (n - 1)::int FROM jsonb_array_elements(i.record_receipts) WITH ORDINALITY AS r(row, n)
             WHERE (row->>'record')::int = $2 LIMIT 1)
            WHEN EXISTS (SELECT 1 FROM cgt.transactions WHERE import_id = i.id AND source_record = $2)
            THEN (SELECT count(*)::int FROM cgt.transactions WHERE import_id = i.id AND source_record < $2)
            END AS "offset" FROM cgt.imports i WHERE i.id = $1`,
          [importId, sourceRecord],
        );
        if (position[0]?.offset == null) throw missing();
        page = Math.floor(position[0].offset / 25) + 1;
      }
      const start = (page - 1) * 25;
      const receipt = (
        await query<{
          status: Import["status"];
          accountLabel: string;
          reversalReason: string | null;
          total: number;
          legacy: boolean;
          records: ReceiptRecord[];
        }>(
          tx,
          `SELECT i.status, a.label AS "accountLabel", i.reversal_reason AS "reversalReason",
          jsonb_array_length(i.record_receipts) = 0 AS legacy,
          CASE WHEN jsonb_array_length(i.record_receipts) = 0
            THEN (SELECT count(*)::int FROM cgt.transactions t WHERE t.import_id = i.id)
            ELSE jsonb_array_length(i.record_receipts) END AS total, ARRAY(
          SELECT jsonb_build_object(
            'record', i.record_receipts->n->'record',
            'status', i.record_receipts->n->'status',
            'reason', i.record_receipts->n->'reason',
            'statementReference', i.record_receipts->n->'statementReference'
          ) FROM generate_series($2::int, least($2::int + 24, jsonb_array_length(i.record_receipts) - 1)) AS n
          ORDER BY n
        ) AS records FROM cgt.imports AS i
          JOIN cgt.broker_accounts a ON a.id = i.account_id WHERE i.id = $1`,
          [requireUuid(importId), start],
        )
      )[0];
      if (!receipt) throw missing();
      const accepted = receipt.records
        .filter((row) => row.status === "accepted")
        .map((row) => row.record);
      if (accepted.length || (receipt.legacy && receipt.total > start)) {
        const transactions = await query<
          Omit<Trade, "id"> & {
            record: number;
            provenance: Parameters<typeof importTradeDetail>[1];
          }
        >(
          tx,
          `SELECT t.source_record AS record, t.security_id AS "securityId",
          t.trade_date::text AS date, t.side, t.quantity::text, cgt.ledger_gbp(t.consideration_gbp,t.provenance->>'consideration',t.provenance->>'gbpPerUnit')::text AS "considerationGBP",
          cgt.ledger_gbp(t.fees_gbp,t.provenance->>'fees',t.provenance->>'gbpPerUnit')::text AS "feesGBP", t.provenance FROM cgt.transactions t
          WHERE t.import_id = $1 AND ($2::boolean OR t.source_record = ANY($3::int[]))
          ORDER BY t.source_record LIMIT 25 OFFSET $4`,
          [importId, receipt.legacy, accepted, receipt.legacy ? start : 0],
        );
        if (receipt.legacy) {
          receipt.records = transactions.map(({ record }) => ({
            record,
            status: "accepted",
            reason: "Saved trade from this import.",
          }));
        }
        const detailsByRow = new Map(
          transactions.map((trade) => [
            trade.record,
            importTradeDetail(trade, trade.provenance),
          ]),
        );
        for (const row of receipt.records) {
          const detail = detailsByRow.get(row.record);
          if (detail) row.tradeDetail = detail;
        }
      }
      return { ...receipt, page, pageSize: 25 };
    });
  }

  async overview(
    identity: Identity,
    includeImportCount = false,
    includeReportEligibility = false,
    receiptId?: string,
    namedInstruments: boolean | "statement-sales" | "calculation-sales" = false,
  ) {
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
      const imports = await query<Import & { accepted_count: number }>(
        tx,
        `SELECT id, account_id, status, record_count, accepted_count, excluded_count,
        duplicate_count, created_at, reversed_at, reversal_reason FROM cgt.imports ORDER BY created_at DESC, id DESC LIMIT 100`,
      );
      // A portfolio's only active trades may precede the recent receipt page.
      const hasActiveTrades = imports.some((item) => item.status === "committed" && item.accepted_count > 0) ||
        (imports.length === 100 && (await query<{ present: boolean }>(
          tx, "SELECT EXISTS (SELECT 1 FROM cgt.transactions WHERE active) AS present",
        ))[0]!.present);
      // Read only the requested receipt. Its saved trades also cover older, paginated imports.
      const savedReceipt = receiptId
        ? (await query(
            tx,
            `SELECT i.id, i.account_id, i.accepted_count,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'year', start_year::text || '-' || right((start_year + 1)::text, 2),
                  'count', sale_count) ORDER BY start_year DESC)
                FROM (
                  SELECT extract(year FROM t.trade_date)::int -
                    CASE WHEN to_char(t.trade_date, 'MMDD') < '0406' THEN 1 ELSE 0 END AS start_year,
                    count(*)::int AS sale_count
                  FROM cgt.transactions t
                  WHERE t.import_id = i.id AND t.active AND t.side = 'SELL'
                  GROUP BY 1
                ) sales
              ), '[]'::jsonb) AS "disposalYears"
             FROM cgt.imports i WHERE i.id = $1 AND i.status = 'committed'`,
            [requireUuid(receiptId)],
          ))[0] ?? null
        : null;
      // The Accounts summary includes older imports beyond the recent list.
      const importCount =
        includeImportCount && imports.length === 100
          ? (
              await query<{ count: number }>(
                tx,
                "SELECT count(*)::int AS count FROM cgt.imports",
              )
            )[0]!.count
          : imports.length;
      const runs = await query<
        (EvidenceRun & {
          id: string;
          tax_year: string;
          status: string;
          history_through: string;
          coverage_confirmed: boolean;
          created_at: string;
        }) | { id: null; tax_year: string; previous_date: string; previous_accounts: string[]; recovery_reason: "portfolio" | "rules" | null }
      >(
        tx,
        `SELECT r.id, years.tax_year, r.status, r.history_through, ${includeReportEligibility ? "r.result" : "r.result - 'poolMovements'"} AS result,
        r.portfolio_id, r.portfolio_revision, r.input_digest, r.coverage_confirmed, r.coverage_accounts, r.created_at,
        coalesce(saved.history_through, years.history_through)::text AS previous_date,
        coalesce(saved.coverage_accounts, years.coverage_accounts) AS previous_accounts,
        CASE WHEN coalesce(saved.portfolio_revision, years.portfolio_revision) <> f.revision THEN 'portfolio'
             WHEN saved.id IS NOT NULL AND r.id IS NULL THEN 'rules' END AS recovery_reason
        FROM (SELECT DISTINCT ON (tax_year) tax_year, history_through, coverage_accounts, portfolio_revision
              FROM cgt.calculation_runs WHERE portfolio_id=$1
              ORDER BY tax_year, portfolio_revision DESC, created_at DESC, id DESC) years
        JOIN cgt.portfolios f ON f.id=$1
        LEFT JOIN cgt.published_calculations p ON p.portfolio_id=f.id AND p.tax_year=years.tax_year
        LEFT JOIN cgt.calculation_runs saved ON saved.id=p.run_id
        LEFT JOIN cgt.calculation_runs r ON r.id=p.run_id
          AND r.portfolio_revision=f.revision
          AND r.engine_version=$2 AND r.result->>'engineVersion'=$2 AND r.result->>'scopeDeclaration'=$3
        ORDER BY years.tax_year DESC`,
        [portfolios[0]!.id, ENGINE_VERSION, scopeDeclaration],
      );
      const calculations = [];
      const staleReportYears: string[] = [];
      const previousCalculationInputs = [];
      for (const run of runs) {
        if (run.id === null) {
          staleReportYears.push(run.tax_year);
          previousCalculationInputs.push({
            taxYear: run.tax_year, historyThrough: run.previous_date, confirmedAccountIds: run.previous_accounts,
            ...(run.recovery_reason && { recoveryReason: run.recovery_reason }),
          });
          continue;
        }
        const availability = includeReportEligibility
          ? { evidenceIssue: evidenceIssue(run.result) }
          : {};
        const {
          id,
          tax_year,
          status,
          history_through,
          coverage_confirmed,
          coverage_accounts,
          created_at,
          result,
        } = run;
        delete result.poolMovements; // The working ledger is rendered in the export, not the overview.
        calculations.push({
          id,
          tax_year,
          status,
          history_through,
          coverage_confirmed,
          coverage_accounts,
          created_at,
          result,
          ...availability,
        });
      }
      const drafts = await query<Pick<Draft, "id" | "account_id" | "display_summary"> & {
        created_at: string; expires_at: string;
      }>(
        tx,
        "SELECT id, account_id, created_at, expires_at, display_summary FROM cgt.import_drafts WHERE expires_at > now() ORDER BY created_at DESC, id",
      );
      const instrumentNames = namedInstruments === true
        ? Object.fromEntries(await brokerInstrumentNames(tx,
            calculations.flatMap(run => run.result.pools.map(pool => pool.securityId)), "t.security_id"))
        : undefined;
      const statementSaleNames = namedInstruments === "statement-sales" || namedInstruments === "calculation-sales"
        ? await disposalNames(tx, calculations.flatMap(run => namedInstruments === "statement-sales"
            ? run.result.disposals.slice(0, statementSaleLimit) : run.result.disposals))
        : undefined;
      return {
        portfolio: portfolios[0]!,
        accounts,
        imports,
        hasActiveTrades,
        ...(instrumentNames && { instrumentNames }),
        ...(statementSaleNames && { statementSaleNames }),
        ...(receiptId && { savedReceipt }),
        ...(includeImportCount && { importCount }),
        drafts,
        calculations,
        staleReportYears,
        previousCalculationInputs,
      };
    });
  }

  async reportSources(identity: Identity, sourceKeys: string[]): Promise<ReportSource[]> {
    return this.db.run(identity, (tx) => transactionSources(tx, sourceKeys));
  }

  async reportSnapshot(
    identity: Identity,
    runId: string,
    kind?: ReportKind,
  ): Promise<ReportSnapshot> {
    return this.currentSnapshot(identity, { id: requireUuid(runId) }, kind);
  }

  async selectedReportIssue(
    identity: Identity,
    target: ReportDestination,
    purpose: "purchase" | "download" = "download",
  ): Promise<ReportIssue | null> {
    try {
      const saved = await this.currentSnapshot(identity, { year: target.year });
      if (purpose === "purchase") {
        const issue = purchaseIssue(saved.result, saved.coverage_confirmed);
        if (issue) return issue;
      }
      return target.format === "evidence" ? evidenceIssue(saved.result) : null;
    } catch (error) {
      if (
        error instanceof AppError &&
        (error.code === "REPORT_UNAVAILABLE" ||
          error.code === "PENDING_IMPORTS")
      )
        return { code: error.code, message: error.message };
      throw error;
    }
  }

  private async currentSnapshot(
    identity: Identity,
    target: { id: string } | { year: string },
    kind?: ReportKind,
  ): Promise<ReportSnapshot> {
    return this.db.run(identity, async (tx) => {
      const rows = await query<ReportSnapshot & EvidenceRun>(
        tx,
        `SELECT r.id,r.input_digest,r.created_at,r.coverage_confirmed,r.result,r.portfolio_id,r.portfolio_revision,r.coverage_accounts,
          (SELECT coalesce(jsonb_agg(jsonb_build_object('label',a.label,'broker',a.broker,'confirmed',r.coverage_accounts ? a.id::text) ORDER BY a.label,a.id),'[]'::jsonb)
           FROM cgt.broker_accounts a WHERE a.portfolio_id=r.portfolio_id) AS accounts
        FROM cgt.calculation_runs r JOIN cgt.published_calculations p ON p.run_id=r.id
        JOIN cgt.portfolios f ON f.id=r.portfolio_id AND f.revision=r.portfolio_revision
        WHERE ${"id" in target ? "r.id" : "r.tax_year"}=$1
          AND r.engine_version=$2 AND r.result->>'engineVersion'=$2 AND r.result->>'scopeDeclaration'=$3`,
        ["id" in target ? target.id : target.year, ENGINE_VERSION, scopeDeclaration],
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
      const integrity = await activeImportIssue(tx, rows[0].portfolio_id, rows[0].result.historyThrough);
      if (integrity) throw new AppError(409, "REPORT_UNAVAILABLE", integrity);
      const snapshot = rows[0];
      if (kind === "csv" || kind === "evidence") {
        const issue = kind === "evidence" && evidenceIssue(snapshot.result);
        if (issue) throw new AppError(400, issue.code, issue.message);
        const keys = new Set<string>();
        for (const disposal of snapshot.result.disposals) {
          for (const key of disposal.sourceIds) keys.add(key);
          for (const match of disposal.matches)
            for (const key of match.acquisitionIds ?? []) keys.add(key);
        }
        for (const movement of snapshot.result.poolMovements ?? [])
          for (const key of movement.sourceIds) keys.add(key);
        snapshot.sources = await transactionSources(tx, [...keys]);
        if (snapshot.sources.length !== keys.size)
          throw new AppError(409, "REPORT_UNAVAILABLE",
            "The transaction evidence for this calculation is incomplete. Review the imports and recalculate before downloading.");
      }
      if (kind === "summary" || kind === "evidence") {
        const sales = kind === "summary" ? snapshot.result.disposals.slice(0, statementSaleLimit) : snapshot.result.disposals;
        snapshot.statementSaleNames = await disposalNames(tx, sales);
      }
      return snapshot;
    }, "repeatable read");
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
      fileName?: string;
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
        `INSERT INTO cgt.import_drafts(owner_id,account_id,csv,format,reviewed_revision,ordinary_shares_confirmed,display_summary)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
        [
          identity.ownerId,
          a.id,
          input.csv,
          input.format,
          p.revision,
          input.ordinarySharesConfirmed === true,
          JSON.stringify(draftSummary(review, input.fileName)),
        ],
      );
      return {
        broker: a.broker,
        draftId: rows[0]!.id,
        accountId: a.id,
        revision: p.revision,
        reviewVersion: 0,
        affectedReportYears: await publishedReportYears(tx, p.id),
        review,
      };
    });
  }

  async discardDraft(identity: Identity, draftId: string, expectedVersion = 0) {
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
      const removed = await query(tx,
        "DELETE FROM cgt.import_drafts WHERE id = $1 AND review_version = $2 RETURNING id",
        [draftId, expectedVersion],
      );
      if (removed.length) return;
      const remaining = await query(tx, "SELECT id FROM cgt.import_drafts WHERE id = $1", [draftId]);
      if (remaining.length)
        throw new AppError(
          409,
          "DETAILS_CHANGED",
          "This preview changed in another window. Reload the page to review the latest supporting details before discarding it.",
        );
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
        "UPDATE cgt.import_drafts SET reviewed_revision = $2, display_summary = $3::jsonb WHERE id = $1",
        [draftId, p.revision, JSON.stringify(draftSummary(review, draft.display_summary?.fileName))],
      );
      return {
        draftId,
        accountId: a.id,
        revision: p.revision,
        reviewVersion: draft.review_version,
        affectedReportYears: await publishedReportYears(tx, p.id),
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
        "UPDATE cgt.import_drafts SET supporting_details=$2::jsonb,review_version=$3,reviewed_revision=$4,display_summary=$5::jsonb WHERE id=$1",
        [draftId, JSON.stringify(supporting), next, p.revision, JSON.stringify(draftSummary(review, draft.display_summary?.fileName))],
      );
      return {
        draftId,
        accountId: a.id,
        revision: p.revision,
        reviewVersion: next,
        affectedReportYears: await publishedReportYears(tx, p.id),
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
          `SELECT id,status,account_id FROM cgt.imports WHERE id=$1
           UNION ALL SELECT i.id,i.status,i.account_id FROM cgt.receipt_revalidations r JOIN cgt.imports i ON i.id=r.import_id WHERE r.request_id=$1`,
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
            `SELECT id,status,account_id FROM cgt.imports WHERE id=$1
           UNION ALL SELECT i.id,i.status,i.account_id FROM cgt.receipt_revalidations r JOIN cgt.imports i ON i.id=r.import_id WHERE r.request_id=$1`,
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
          `SELECT id,status,account_id FROM cgt.imports WHERE id=$1
           UNION ALL SELECT i.id,i.status,i.account_id FROM cgt.receipt_revalidations r JOIN cgt.imports i ON i.id=r.import_id WHERE r.request_id=$1`,
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
          affectedReportYears: await publishedReportYears(tx, p.id),
          review,
        };
      }
      if (review.status !== "ready")
        return {
          outcome: "needs_review" as const,
          accountId: a.id,
          revision: p.revision,
          reviewVersion: draft.review_version,
          affectedReportYears: await publishedReportYears(tx, p.id),
          review,
        };
      if (review.revalidatesReceiptId) {
        const verified = review.records.map(r => ({record:r.record,status:r.status,sourceKey:r.sourceKey,
          ...(r.status==="excluded" && r.source && { cashFields: cashEvidence(r.source) })}));
        await query(tx, `INSERT INTO cgt.receipt_revalidations(request_id,import_id,account_id,owner_id,verified_records)
          VALUES($1,$2,$3,$4,$5::jsonb)`, [draftId,review.revalidatesReceiptId,a.id,identity.ownerId,JSON.stringify(verified)]);
        await invalidate(tx,a.portfolio_id);
        await query(tx,"DELETE FROM cgt.import_drafts WHERE id=$1",[draftId]);
        return { outcome: "committed" as const, importId: review.revalidatesReceiptId, counts: review.counts };
      }
      if (a.broker === "ibkr" && review.ibkrClientAccountId) {
        await query(tx, "UPDATE cgt.broker_accounts SET ibkr_client_account_id=$2 WHERE id=$1", [a.id, review.ibkrClientAccountId]);
      }
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
              ({ record, status, reason, sourceKey, digest, statementReference, source }) => ({
                record,
                status,
                reason,
                sourceKey,
                digest,
                statementReference,
                ...(status === "excluded" && source && { cashFields: cashEvidence(source) }),
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
          provenance: {
            ...row.provenance,
            executionReference: row.executionReference,
          },
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
        if (a.broker === "ibkr") await query(tx,
          "UPDATE cgt.broker_accounts SET ibkr_client_account_id=NULL WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM cgt.transactions WHERE account_id=$1 AND active)", [a.id]);
        await invalidate(tx, a.portfolio_id);
      }
      return { importId, status: "reversed" as const };
    });
  }

  async calculate(
    identity: Identity,
    input: {
      portfolioId: string;
      portfolioRevision?: number;
      taxYear: string;
      historyThrough: string;
      confirmedAccountIds: string[];
      personalScopeConfirmed: boolean;
      scopeDeclaration?: string;
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
    const taxYear = input.taxYear as keyof typeof TAX_YEARS;
    if (input.historyThrough < TAX_YEARS[taxYear].start)
      throw new AppError(400, "HISTORY_BEFORE_TAX_YEAR",
        `History must include at least ${TAX_YEARS[taxYear].start}, the first day of ${taxYear}.`);
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
      if (input.portfolioRevision !== undefined && input.portfolioRevision !== p.revision)
        throw new AppError(
          409,
          "PORTFOLIO_CHANGED",
          "Your portfolio changed. Review the updated history and confirm your accounts again before calculating.",
        );
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
      if (input.personalScopeConfirmed !== true || input.scopeDeclaration !== scopeDeclaration)
        throw new AppError(400, "SCOPE_CONFIRMATION_REQUIRED",
          "Confirm personal ownership, UK residence and ordinary market trades using their actual costs. If a relief, rebasing election or special valuation affects the shares, obtain a specialist review before calculating.");
      const integrity = await activeImportIssue(tx, p.id, input.historyThrough);
      if (integrity) throw new AppError(409, "IMPORT_REVIEW_REQUIRED", integrity);
      const { trades, openingPools } = await reviewedCalculationInputs(tx, p.id, taxYear, input.historyThrough);
      if (!trades.length && !openingPools.length)
        throw new AppError(
          409,
          "NO_TRANSACTIONS",
          "Import your transaction history before calculating gains.",
        );
      const result = calculateGains(trades, {
        taxYear, openingPools,
        historyThrough: input.historyThrough,
      });
      if (openingPools.length) result.reviewedOpeningPools = openingPools;
      result.scopeDeclaration = scopeDeclaration;
      const yearEnd = TAX_YEARS[input.taxYear as keyof typeof TAX_YEARS].end;
      if (input.historyThrough < yearEnd) {
        const [later] = await query<{ present: boolean }>(tx,
          `SELECT EXISTS (SELECT 1 FROM cgt.transactions t JOIN cgt.broker_accounts a ON a.id=t.account_id
            WHERE a.portfolio_id=$1 AND t.active AND t.side='SELL' AND t.trade_date>$2::date AND t.trade_date<=$3::date) AS present`,
          [p.id, input.historyThrough, yearEnd]);
        result.hasLaterSales = later!.present;
      }
      const digest = fingerprint({
        scopeDeclaration,
        trades,
        ...(openingPools.length && { openingPools }),
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
