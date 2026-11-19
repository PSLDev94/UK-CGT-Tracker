import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { testDatabase } from "./helpers/database";
import { authenticate, type Identity } from "../src/server/identity";
import {
  assertRuntimeRole,
  OwnedDatabase,
  query,
} from "../src/server/database";
import { Workspace } from "../src/server/workspace";
import { createReportHandler } from "../src/server/reports-api";
import { PDFDocument } from "pdf-lib";
import { reportPageText } from "./helpers/pdf-text";
import Papa from "papaparse";

const csv = readFileSync(
  new URL("./fixtures/canonical-trades.csv", import.meta.url),
  "utf8",
);
let database: Awaited<ReturnType<typeof testDatabase>>;
let workspace: Workspace;
const identity = (id: string) =>
  authenticate(new Headers(), async () => ({
    user: { id, emailVerified: true },
    session: { expiresAt: new Date(Date.now() + 3600000) },
  }));
async function owner(id: string) {
  await database.pg.exec("RESET ROLE");
  await database.pg.query(
    'INSERT INTO auth."user"(id,name,email,"emailVerified") VALUES($1,$1,$2,true)',
    [id, `${id}@example.test`],
  );
  await database.pg.exec("SET ROLE cgt_app");
  return identity(id);
}
async function setup(id: string) {
  const user = await owner(id);
  const { portfolio } = await workspace.overview(user);
  const account = await workspace.addAccount(user, {
    portfolioId: portfolio.id,
    broker: "trading212",
    label: "Invest",
    accountType: "GIA",
  });
  return { user, portfolio, account };
}
const prepare = (u: Identity, id: string, file = csv) =>
  workspace.prepareImport(u, {
    accountId: id,
    csv: file,
    format: "canonical-v1",
  });

beforeAll(async () => {
  database = await testDatabase("cgt_app");
  workspace = new Workspace(new OwnedDatabase(database.db));
}, 30000);
afterAll(async () => {
  await database.db.destroy();
});

describe("authenticated PostgreSQL application workflow", () => {
  it("refuses a forged identity even if it has the correct shape", async () => {
    await expect(
      workspace.overview({ ownerId: "forged" } as Identity),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("exports one revision's transaction references when a receipt is reversed during a PDF download", async () => {
    const { user, account, portfolio } = await setup("concurrent-report-reversal");
    const draft = await prepare(user, account.id);
    await workspace.commitImport(user, draft.draftId, draft.revision);
    const run = await workspace.calculate(user, {
      portfolioId: portfolio.id, taxYear: "2024-25", historyThrough: "2025-05-05",
      confirmedAccountIds: [account.id], personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2",
    });
    const handler = createReportHandler({
      origin: "https://cgt.test",
      readSession: async () => ({
        user: { id: user.ownerId, emailVerified: true },
        session: { expiresAt: new Date(Date.now() + 60_000) },
      }),
      snapshot: (identity, id, kind) => workspace.reportSnapshot(identity, id, kind),
      consume: async () => {},
      entitled: async () => {
        await workspace.reverseImport(user, draft.draftId, "Replace the synthetic source file");
        return true;
      },
    });
    const download = (kind: string) => handler(new Request("https://cgt.test/api/v2/reports", {
      method: "POST", headers: { origin: "https://cgt.test", "content-type": "application/json" },
      body: JSON.stringify({ runId: run.runId, kind }),
    }));
    const csv = await download("csv");
    expect(csv.status).toBe(200);
    const rows = Papa.parse<string[]>(await csv.text()).data;
    expect(rows.some(row => row.slice(1).join("|") === "USD|1000|10|0.8|800|8")).toBe(true);
    const document = await download("evidence");
    expect(document.status).toBe(200);
    const text = reportPageText(await PDFDocument.load(await document.arrayBuffer())).replace(/\s+/g, " ");
    expect(text).toContain("Execution reference: synthetic-sell");
    expect(text).toContain("Execution reference: synthetic-buy");
    expect(text).toContain("USD 1000 consideration and 10 fees");
    expect((await download("csv")).status).toBe(404);
    expect((await download("evidence")).status).toBe(404);
  });

  it("creates one shared portfolio across repeated visits", async () => {
    const user = await owner("one-portfolio");
    const first = await workspace.overview(user);
    expect((await workspace.overview(user)).portfolio.id).toBe(
      first.portfolio.id,
    );
  });

  it("counts only new sales from the requested receipt on either side of 6 April and protects its PDF purchase", async () => {
    const s = await setup("receipt-year-owner");
    const other = await setup("receipt-year-other");
    const [header, buy] = csv.trim().split("\n");
    const purchase = await prepare(s.user, s.account.id, [header, buy].join("\n"));
    await workspace.commitImport(s.user, purchase.draftId, purchase.revision);
    const receipt = async (id: string, user = s.user) =>
      (await workspace.overview(user, false, false, id)).savedReceipt;
    expect(await receipt(purchase.draftId)).toMatchObject({ accepted_count: 1, disposalYears: [] });
    const target = { year: "2024-25", format: "summary" } as const;
    await workspace.calculate(s.user, {
      portfolioId: s.portfolio.id, taxYear: target.year, historyThrough: "2025-05-05", personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2", confirmedAccountIds: [s.account.id],
    });
    for (const format of ["summary", "evidence"] as const) {
      expect(await workspace.selectedReportIssue(s.user, { ...target, format }, "purchase")).toMatchObject({ code: "NO_DISPOSALS" });
      expect(await workspace.selectedReportIssue(s.user, { ...target, format }, "download")).toBeNull();
    }
    const sale = (id: number, date: string) => `s${id},${date},SELL,US0378331005,1,20,0,GBP,1,ORDINARY_SHARE`;
    const mixed = await prepare(s.user, s.account.id, [header, buy, sale(1, "2024-04-05"), sale(2, "2024-04-06"), sale(3, "2024-05-07")].join("\n"));
    await workspace.commitImport(s.user, mixed.draftId, mixed.revision);
    expect(await receipt(mixed.draftId)).toMatchObject({
      accepted_count: 3, disposalYears: [{ year: "2024-25", count: 2 }, { year: "2023-24", count: 1 }],
    });
    expect(await receipt(mixed.draftId, other.user)).toBeNull();
    await workspace.reverseImport(s.user, mixed.draftId, "Test receipt reversal");
    expect(await receipt(mixed.draftId)).toBeNull();
  });

  it("does not read or mutate another user’s accounts, drafts or imports", async () => {
    const a = await setup("alice-workflow");
    const b = await setup("bob-workflow");
    const draft = await prepare(a.user, a.account.id);
    await expect(prepare(b.user, a.account.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      workspace.commitImport(b.user, draft.draftId, draft.revision),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      workspace.addAccount(b.user, {
        portfolioId: a.portfolio.id,
        broker: "hl",
        label: "Forged",
        accountType: "GIA",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await workspace.commitImport(a.user, draft.draftId, draft.revision);
    await expect(
      workspace.reverseImport(b.user, draft.draftId, "Wrong file"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      workspace.importDetail(b.user, draft.draftId, 1),
    ).rejects.toMatchObject({ status: 404 });
    expect((await workspace.overview(b.user)).imports).toHaveLength(0);
  });

  it("opens a linked source record beyond the first receipt page, including legacy imports", async () => {
    const s = await setup("receipt-record-link");
    const other = await setup("receipt-record-link-other");
    const [header, buy] = csv.trim().split("\n");
    const file = [header, ...Array.from({ length: 32 }, (_, i) => buy!.replace("synthetic-buy", "buy-" + i))].join("\n");
    const draft = await prepare(s.user, s.account.id, file);
    await workspace.commitImport(s.user, draft.draftId, draft.revision);
    const record = draft.review.records[31]!.record;
    async function verifyLinkedPage() {
      const receipt = await workspace.importDetail(s.user, draft.draftId, 1, record);
      expect(receipt.page).toBe(2);
      expect(receipt.records.find((row) => row.record === record)?.tradeDetail?.executionReference).toBe("buy-31");
    }
    await verifyLinkedPage();
    await expect(workspace.importDetail(other.user, draft.draftId, 1, record)).rejects.toMatchObject({ status: 404 });
    await expect(workspace.importDetail(s.user, draft.draftId, 1, 900)).rejects.toMatchObject({ status: 404 });
    await database.pg.exec("RESET ROLE");
    await database.pg.query("UPDATE cgt.imports SET record_receipts = '[]' WHERE id = $1", [draft.draftId]);
    await database.pg.exec("SET ROLE cgt_app");
    await verifyLinkedPage();
    expect(await workspace.importDetail(s.user, draft.draftId, 1, record)).toMatchObject({
      accountLabel: "Invest", status: "committed", reversalReason: null,
    });
    await workspace.reverseImport(s.user, draft.draftId, "Superseded export");
    expect(await workspace.importDetail(s.user, draft.draftId, 1, record)).toMatchObject({
      accountLabel: "Invest", status: "reversed", reversalReason: "Superseded export", legacy: true,
      records: expect.arrayContaining([expect.objectContaining({ record, status: "accepted" })]),
    });
  });

  it("retains owner-scoped filenames and trade summaries only for the lifetime of a preview", async () => {
    const s = await setup("draft-display");
    const other = await setup("draft-display-other");
    const upload = (fileName: string) => workspace.prepareImport(s.user, {
      accountId: s.account.id, format: "canonical-v1", csv, fileName,
    });
    const first = await upload("C:\\private\\First\u202e.csv");
    const second = await upload("/downloads/Second.csv");
    const drafts = async () => (await workspace.overview(s.user)).drafts;
    expect(await drafts()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.draftId, display_summary: {
        fileName: "First.csv", recordCount: 3, firstTradeDate: "2024-06-01", lastTradeDate: "2024-09-01", firstUnresolvedTrade: null,
      } }),
      expect.objectContaining({ id: second.draftId, display_summary: expect.objectContaining({ fileName: "Second.csv" }) }),
    ]));
    expect((await workspace.overview(other.user)).drafts).toEqual([]);
    await new OwnedDatabase(database.db).run(s.user, (tx) =>
      query(tx, "UPDATE cgt.import_drafts SET display_summary = NULL WHERE id = $1", [second.draftId]));
    await workspace.reviewImport(s.user, second.draftId);
    expect((await drafts()).find((d) => d.id === second.draftId)?.display_summary).toMatchObject({
      fileName: null, recordCount: 3, firstTradeDate: "2024-06-01",
    });
    await workspace.discardDraft(s.user, second.draftId);
    await workspace.commitImport(s.user, first.draftId, first.revision);
    expect(await drafts()).toEqual([]);
    expect(await workspace.importDetail(s.user, first.draftId, 1)).not.toHaveProperty("display_summary");
  });

  it("reconciles every record, commits once and removes the raw CSV", async () => {
    const s = await setup("commit-once");
    const draft = await prepare(s.user, s.account.id);
    expect(draft.review.counts).toEqual({
      total: 3,
      accepted: 2,
      excluded: 1,
      duplicate: 0,
      needsReview: 0,
    });
    expect(draft.accountId).toBe(s.account.id);
    expect(
      (await workspace.reviewImport(s.user, draft.draftId)).accountId,
    ).toBe(s.account.id);
    const result = await workspace.commitImport(
      s.user,
      draft.draftId,
      draft.revision,
    );
    expect(result.outcome).toBe("committed");
    const receipt = await workspace.importDetail(s.user, draft.draftId, 1);
    expect(receipt.total).toBe(3);
    expect(receipt.records.map((row) => row.status).sort()).toEqual([
      "accepted",
      "accepted",
      "excluded",
    ]);
    expect(receipt.records[0]).not.toHaveProperty("sourceKey");
    expect(receipt.records[0]?.tradeDetail).toMatchObject({
      side: "BUY", currency: "USD", consideration: "1000", fees: "10", netCash: "-1010",
      netCashGBP: "-808", gbpPerUnit: "0.8", executionReference: "synthetic-buy",
    });
    expect(receipt.records.find((row) => row.status === "excluded")?.tradeDetail).toBeUndefined();
    expect(
      (await workspace.importDetail(s.user, draft.draftId, 2)).records,
    ).toEqual([]);
    await expect(
      workspace.importDetail(s.user, draft.draftId, 0),
    ).rejects.toMatchObject({ code: "INVALID_PAGE" });
    expect(
      (await workspace.commitImport(s.user, draft.draftId, draft.revision))
        .outcome,
    ).toBe("already_committed");
    await new OwnedDatabase(database.db).run(s.user, async (tx) => {
      expect(await query(tx, "SELECT * FROM cgt.transactions")).toHaveLength(2);
      expect(await query(tx, "SELECT * FROM cgt.import_drafts")).toHaveLength(
        0,
      );
      const receipts = await query<{ record_receipts: unknown[] }>(
        tx,
        "SELECT record_receipts FROM cgt.imports",
      );
      expect(receipts[0]!.record_receipts).toHaveLength(3);
    });
    // Transaction-local identity must not leak to the next pooled request.
    expect(
      await query(database.db, "SELECT * FROM cgt.transactions"),
    ).toHaveLength(0);
  });

  it("requires another confirmation when the portfolio changes after preview", async () => {
    const s = await setup("stale-preview");
    const draft = await prepare(s.user, s.account.id);
    await workspace.addAccount(s.user, {
      portfolioId: s.portfolio.id,
      broker: "hl",
      label: "Other broker",
      accountType: "GIA",
    });
    const changed = await workspace.commitImport(
      s.user,
      draft.draftId,
      draft.revision,
    );
    expect(changed.outcome).toBe("review_changed");
    expect((await workspace.overview(s.user)).imports).toHaveLength(0);
    if (changed.outcome !== "review_changed")
      throw new Error("Expected changed review");
    expect(
      (await workspace.commitImport(s.user, draft.draftId, changed.revision))
        .outcome,
    ).toBe("committed");
  });

  it("rejects unsupported formats and malformed rows without partial writes", async () => {
    const s = await setup("unsupported");
    const draft = await workspace.prepareImport(s.user, {
      accountId: s.account.id,
      csv,
      format: "native",
    });
    expect(draft.review.status).toBe("unsupported");
    expect(
      (await workspace.commitImport(s.user, draft.draftId, draft.revision))
        .outcome,
    ).toBe("needs_review");
    expect((await workspace.overview(s.user)).imports).toHaveLength(0);
  });

  it("rolls back the receipt and all writes if persistence fails mid-import", async () => {
    const s = await setup("transaction-rollback");
    const draft = await prepare(s.user, s.account.id);
    await database.pg.exec(
      "RESET ROLE; REVOKE INSERT ON cgt.transactions FROM cgt_app; SET ROLE cgt_app",
    );
    try {
      await expect(
        workspace.commitImport(s.user, draft.draftId, draft.revision),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await database.pg.exec(
        "RESET ROLE; GRANT INSERT ON cgt.transactions TO cgt_app; SET ROLE cgt_app",
      );
    }
    expect((await workspace.overview(s.user)).imports).toHaveLength(0);
    expect(
      (await workspace.commitImport(s.user, draft.draftId, draft.revision))
        .outcome,
    ).toBe("committed");
  });

  it("refuses discarded or expired drafts and caps uncommitted sensitive files", async () => {
    const s = await setup("expiry");
    const draft = await prepare(s.user, s.account.id);
    await workspace.discardDraft(s.user, draft.draftId);
    await expect(
      workspace.commitImport(s.user, draft.draftId, draft.revision),
    ).rejects.toMatchObject({ code: "PREVIEW_EXPIRED" });
    const expiring = await prepare(s.user, s.account.id);
    await new OwnedDatabase(database.db).run(s.user, (tx) =>
      query(
        tx,
        "UPDATE cgt.import_drafts SET expires_at = now() - interval '1 second'",
      ),
    );
    await expect(
      workspace.commitImport(s.user, expiring.draftId, expiring.revision),
    ).rejects.toMatchObject({ code: "PREVIEW_EXPIRED" });
    for (let i = 0; i < 5; i++) await prepare(s.user, s.account.id);
    await expect(prepare(s.user, s.account.id)).rejects.toMatchObject({
      code: "DRAFT_LIMIT",
    });
  });

  it("calculates persisted trades, retains snapshots and invalidates them on reversal", async () => {
    const s = await setup("calculate-reverse");
    const draft = await prepare(s.user, s.account.id);
    await workspace.commitImport(s.user, draft.draftId, draft.revision);
    const input = {
      portfolioId: s.portfolio.id,
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
      personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2",
      confirmedAccountIds: [s.account.id],
    };
    const calculation = await workspace.calculate(s.user, input);
    expect(calculation.result.status).toBe("complete");
    expect(calculation.result.summary?.netGainGBP).toBe("391.00");
    expect(calculation.coverageConfirmed).toBe(true);
    expect((await workspace.calculate(s.user, input)).runId).toBe(
      calculation.runId,
    );
    expect((await workspace.overview(s.user)).calculations).toHaveLength(1);
    await workspace.reverseImport(
      s.user,
      draft.draftId,
      "Reimport with corrected values",
    );
    expect((await workspace.overview(s.user)).calculations).toHaveLength(0);
    await new OwnedDatabase(database.db).run(s.user, async (tx) => {
      expect(
        await query(tx, "SELECT * FROM cgt.calculation_runs"),
      ).toHaveLength(1);
      expect(
        await query(tx, "SELECT * FROM cgt.transactions WHERE NOT active"),
      ).toHaveLength(2);
    });
    const replacement = await prepare(s.user, s.account.id);
    expect(replacement.review.counts.accepted).toBe(2);
    expect(
      (
        await workspace.commitImport(
          s.user,
          replacement.draftId,
          replacement.revision,
        )
      ).outcome,
    ).toBe("committed");
  });

  it("names reports before saving and preserves recovery per year until that year is recalculated", async () => {
    const s = await setup("report-year-recovery");
    const otherDevice = new Workspace(new OwnedDatabase(database.db));
    const first = await prepare(s.user, s.account.id);
    expect(first.affectedReportYears).toEqual([]);
    await workspace.commitImport(s.user, first.draftId, first.revision);
    const input = {
      portfolioId: s.portfolio.id, historyThrough: "2026-05-05", personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2", confirmedAccountIds: [s.account.id],
    };
    const years = ["2025-26", "2024-25"];
    const oldIds = [];
    for (const taxYear of years) oldIds.push((await workspace.calculate(s.user, { ...input, taxYear })).runId);
    // Reusing inputs republishes their immutable run, even if a later run exists.
    await workspace.calculate(s.user, { ...input, taxYear: "2024-25", historyThrough: "2025-05-05", personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2", confirmedAccountIds: [] });
    expect((await workspace.calculate(s.user, { ...input, taxYear: "2024-25" })).runId).toBe(oldIds[1]);
    const earlier = csv.replaceAll("2024-", "2023-").replaceAll("synthetic-", "earlier-");
    const addition = await prepare(s.user, s.account.id, earlier);
    expect(addition.affectedReportYears).toEqual(years);
    expect((await otherDevice.reviewImport(s.user, addition.draftId)).affectedReportYears).toEqual(years);
    expect((await workspace.overview(s.user)).staleReportYears).toEqual([]);
    await otherDevice.discardDraft(s.user, addition.draftId);
    expect((await workspace.overview(s.user)).calculations.map((c) => c.tax_year)).toEqual(years);

    const retry = await prepare(s.user, s.account.id, earlier);
    const oldRevision = (await workspace.overview(s.user)).portfolio.revision;
    await workspace.commitImport(s.user, retry.draftId, retry.revision);
    const stale = await otherDevice.overview(s.user, false, true);
    expect(stale.calculations).toEqual([]);
    expect(stale.staleReportYears).toEqual(years);
    expect(stale.previousCalculationInputs).toEqual(years.map((taxYear) => ({
      taxYear, historyThrough: input.historyThrough, confirmedAccountIds: [s.account.id], recoveryReason: "portfolio",
    })));
    for (const runId of oldIds) {
      await expect(otherDevice.reportSnapshot(s.user, runId)).rejects.toMatchObject({ code: "REPORT_UNAVAILABLE" });
    }
    for (const format of ["summary", "evidence"] as const)
      expect(await otherDevice.selectedReportIssue(s.user, { year: "2024-25", format })).toMatchObject({ code: "REPORT_UNAVAILABLE" });
    await expect(otherDevice.calculate(s.user, { ...input, taxYear: "2024-25", portfolioRevision: oldRevision }))
      .rejects.toMatchObject({ code: "PORTFOLIO_CHANGED" });
    // Earlier deployments deleted this pointer when an import invalidated a year.
    await new OwnedDatabase(database.db).run(s.user, (tx) =>
      query(tx, "DELETE FROM cgt.published_calculations WHERE portfolio_id=$1 AND tax_year='2025-26'", [s.portfolio.id]));
    await otherDevice.calculate(s.user, { ...input, taxYear: "2024-25" });
    const refreshed = await workspace.overview(s.user);
    expect(refreshed.staleReportYears).toEqual(["2025-26"]);
    expect(refreshed.previousCalculationInputs).toEqual([
      { taxYear: "2025-26", historyThrough: input.historyThrough, confirmedAccountIds: [s.account.id], recoveryReason: "portfolio" },
    ]);
    expect(refreshed.calculations.map((c) => c.tax_year)).toEqual(["2024-25"]);
    const freshOwner = await owner("report-year-recovery-isolated");
    expect(await workspace.overview(freshOwner)).toMatchObject({ staleReportYears: [], previousCalculationInputs: [] });
  });

  it("accepts today in London just after BST midnight but rejects tomorrow", async () => {
    const s = await setup("london-history-cutoff");
    const draft = await prepare(s.user, s.account.id);
    await workspace.commitImport(s.user, draft.draftId, draft.revision);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2025-05-04T23:30:00Z"));
    try {
      const input = {
        portfolioId: s.portfolio.id,
        taxYear: "2024-25",
        historyThrough: "2025-05-05",
        personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2",
        confirmedAccountIds: [s.account.id],
      };
      expect((await workspace.calculate(s.user, input)).result.status).toBe(
        "complete",
      );
      await expect(
        workspace.calculate(s.user, { ...input, historyThrough: "2025-05-06" }),
      ).rejects.toMatchObject({ code: "FUTURE_HISTORY" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not assert coverage when an account is missing, and blocks pending previews", async () => {
    const s = await setup("coverage");
    const draft = await prepare(s.user, s.account.id);
    const input = {
      portfolioId: s.portfolio.id,
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
      personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2",
      confirmedAccountIds: [],
    };
    await expect(workspace.calculate(s.user, input)).rejects.toMatchObject({
      code: "PENDING_IMPORTS",
    });
    await workspace.commitImport(s.user, draft.draftId, draft.revision);
    expect((await workspace.calculate(s.user, input)).coverageConfirmed).toBe(
      false,
    );
    await expect(
      workspace.calculate(s.user, { ...input, historyThrough: "2099-01-01" }),
    ).rejects.toMatchObject({ code: "FUTURE_HISTORY" });
  });

  it("cannot access authentication secrets using financial credentials", async () => {
    await expect(
      query(database.db, 'SELECT * FROM auth."session"'),
    ).rejects.toThrow(/permission denied/);
    await expect(
      query(database.db, 'SELECT * FROM auth."account"'),
    ).rejects.toThrow(/permission denied/);
  });

  it("paginates the complete import history without losing or repeating receipts", async () => {
    const s = await setup("history-pages");
    for (let index = 0; index < 26; index++) {
      const draft = await prepare(
        s.user,
        s.account.id,
        csv
          .replace("synthetic-buy", `buy-${index}`)
          .replace("synthetic-sell", `sell-${index}`),
      );
      await workspace.commitImport(s.user, draft.draftId, draft.revision);
    }
    const first = await workspace.importHistory(s.user, 1);
    const second = await workspace.importHistory(s.user, 2);
    expect(first.total).toBe(26);
    expect(first.imports).toHaveLength(25);
    expect(second.imports).toHaveLength(1);
    expect(
      new Set(
        [...first.imports, ...second.imports].map(
          (row) => (row as { id: string }).id,
        ),
      ).size,
    ).toBe(26);
    await expect(workspace.importHistory(s.user, 0)).rejects.toMatchObject({
      code: "INVALID_PAGE",
    });
  });

  it("identifies same-minute buy and sell receipts, including reversed and legacy trades", async () => {
    const s = await setup("history-trade-identity");
    const account = await workspace.addAccount(s.user, {
      portfolioId: s.portfolio.id, broker: "ajbell", label: "AJ Bell", accountType: "GIA",
    });
    const [header] = csv.split("\n");
    const save = async (side: "BUY" | "SELL") => {
      const file = `${header}\nreceipt-${side},2025-07-01,${side},US0378331005,1,10,0,GBP,1,ORDINARY_SHARE\n`;
      const draft = await prepare(s.user, account.id, file);
      expect((await workspace.commitImport(s.user, draft.draftId, draft.revision)).outcome).toBe("committed");
      return draft.draftId;
    };
    const buy = await save("BUY");
    const sell = await save("SELL");
    await new OwnedDatabase(database.db).run(s.user, async (tx) => {
      await query(tx, "UPDATE cgt.imports SET created_at = '2026-11-18T12:30:00Z' WHERE account_id = $1", [account.id]);
      await query(tx, "UPDATE cgt.imports SET record_receipts = '[]'::jsonb WHERE id = $1", [sell]);
    });
    const details = { date: "2025-07-01", securityId: "US0378331005", quantity: "1" };
    const sale = { id: sell, account_id: account.id, firstTrade: { ...details, side: "SELL" } };
    expect((await workspace.importHistory(s.user, 1)).imports).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: buy, firstTrade: { ...details, side: "BUY" } }),
      expect.objectContaining({ ...sale, status: "committed" }),
    ]));
    await workspace.reverseImport(s.user, sell, "Synthetic receipt selection");
    expect((await workspace.importHistory(s.user, 1)).imports).toContainEqual(
      expect.objectContaining({ ...sale, status: "reversed" }),
    );
  });

  it("counts all imports in the Accounts summary beyond the recent receipts limit", async () => {
    const s = await setup("account-receipt-count");
    await new OwnedDatabase(database.db).run(s.user, (tx) =>
      query(tx, `INSERT INTO cgt.imports
          (account_id, owner_id, file_digest, parser_version, status, record_count,
           accepted_count, excluded_count, duplicate_count, review_count)
        SELECT $1, $2, lpad(i::text, 64, '0'), 'fixture', CASE WHEN i = 1 THEN 'reversed' ELSE 'committed' END,
          1, 1, 0, 0, 0 FROM generate_series(1, 101) AS i`, [s.account.id, s.user.ownerId]),
    );
    const overview = await workspace.overview(s.user, true);
    expect(overview.imports).toHaveLength(100);
    expect(overview.importCount).toBe(101);
    expect((await workspace.importHistory(s.user, 1)).imports[0]).toMatchObject({ firstTrade: null });
    expect(await workspace.overview(s.user)).not.toHaveProperty("importCount");
  });

  it("keeps the calculation step available when every recent receipt is reversed", async () => {
    const s = await setup("earlier-active-trades");
    const saved = await prepare(s.user, s.account.id, csv);
    await workspace.commitImport(s.user, saved.draftId, saved.revision);
    await new OwnedDatabase(database.db).run(s.user, (tx) =>
      query(tx, `INSERT INTO cgt.imports
        (account_id, owner_id, file_digest, parser_version, status, record_count,
         accepted_count, excluded_count, duplicate_count, review_count)
        SELECT $1, $2, lpad(i::text,64,'0'), 'fixture', 'reversed', 1,1,0,0,0
        FROM generate_series(1,100) AS i`, [s.account.id, s.user.ownerId]));
    const overview = await workspace.overview(s.user);
    expect(overview.imports).toHaveLength(100);
    expect(overview.imports.every((item) => item.status === "reversed")).toBe(true);
    expect(overview.hasActiveTrades).toBe(true);
    await workspace.reverseImport(s.user, saved.draftId, "Replace the original export");
    expect((await workspace.overview(s.user)).hasActiveTrades).toBe(false);
  });

  it("rejects privileged runtime credentials and accepts a dedicated least-privilege login", async () => {
    await expect(assertRuntimeRole(database.db, "cgt_app")).rejects.toThrow(
      /Unsafe/,
    );
    // Separate sessions: changing SESSION AUTHORIZATION must not contaminate later tests.
    for (const mixedPrivileges of [false, true]) {
      const isolated = await testDatabase("cgt_app");
      try {
        await isolated.pg.exec(
          "RESET ROLE; CREATE ROLE runtime_test LOGIN; GRANT cgt_app TO runtime_test",
        );
        if (mixedPrivileges)
          await isolated.pg.exec("GRANT cgt_billing TO runtime_test");
        await isolated.pg.exec(
          "SET SESSION AUTHORIZATION runtime_test; SET ROLE cgt_app",
        );
        if (mixedPrivileges)
          await expect(
            assertRuntimeRole(isolated.db, "cgt_app"),
          ).rejects.toThrow(/Unsafe/);
        else
          await expect(
            assertRuntimeRole(isolated.db, "cgt_app"),
          ).resolves.toBeUndefined();
      } finally {
        await isolated.db.destroy();
      }
    }
  }, 15000);

  it("limits expensive requests across application instances and resets expired windows", async () => {
    const s = await setup("rate-limit");
    for (let i = 0; i < 10; i++)
      await workspace.consumeRequest(s.user, "calculate");
    const otherInstance = new Workspace(new OwnedDatabase(database.db));
    await expect(
      otherInstance.consumeRequest(s.user, "calculate"),
    ).rejects.toMatchObject({ status: 429 });
    await new OwnedDatabase(database.db).run(s.user, (tx) =>
      query(
        tx,
        "UPDATE cgt.request_limits SET window_start=now()-interval '2 minutes'",
      ),
    );
    await expect(
      otherInstance.consumeRequest(s.user, "calculate"),
    ).resolves.toBeUndefined();
  });

  it("allows cleanup to delete only expired previews, without reading CSV contents", async () => {
    const s = await setup("cleanup");
    const expired = await prepare(s.user, s.account.id);
    const fresh = await prepare(s.user, s.account.id);
    await new OwnedDatabase(database.db).run(s.user, (tx) =>
      query(
        tx,
        "UPDATE cgt.import_drafts SET expires_at=now()-interval '1 second' WHERE id=$1",
        [expired.draftId],
      ),
    );
    await database.pg.exec("RESET ROLE; SET ROLE cgt_maintenance");
    try {
      await expect(
        query(database.db, "SELECT csv FROM cgt.import_drafts"),
      ).rejects.toThrow(/permission denied/);
      const removed = await query<{ id: string }>(
        database.db,
        "DELETE FROM cgt.import_drafts RETURNING id",
      );
      expect(removed.map((row) => row.id)).toContain(expired.draftId);
      expect(removed.map((row) => row.id)).not.toContain(fresh.draftId);
    } finally {
      await database.pg.exec("RESET ROLE; SET ROLE cgt_app");
    }
    expect(
      (await workspace.reviewImport(s.user, fresh.draftId)).review.status,
    ).toBe("ready");
  });
});

it("persists native classification confirmation through resume and server-side commit", async () => {
  const s = await setup("native-confirmation");
  const native = readFileSync(
    new URL("./fixtures/brokers/trading212-gbp.csv", import.meta.url),
    "utf8",
  );
  const unconfirmed = await workspace.prepareImport(s.user, {
    accountId: s.account.id,
    csv: native,
    format: "native",
  });
  expect(unconfirmed.review.status).toBe("needs_review");
  expect(
    (
      await workspace.commitImport(
        s.user,
        unconfirmed.draftId,
        unconfirmed.revision,
      )
    ).outcome,
  ).toBe("needs_review");
  const confirmed = await workspace.prepareImport(s.user, {
    accountId: s.account.id,
    csv: native,
    format: "native",
    ordinarySharesConfirmed: true,
  });
  expect(
    (await workspace.reviewImport(s.user, confirmed.draftId)).review.status,
  ).toBe("ready");
  expect(
    (
      await workspace.commitImport(
        s.user,
        confirmed.draftId,
        confirmed.revision,
      )
    ).outcome,
  ).toBe("committed");
  await new OwnedDatabase(database.db).run(s.user, async (tx) => {
    const rows = await query<{
      provenance: {
        native: {
          ordinarySharesConfirmed: boolean;
          fields: Record<string, string>;
        };
      };
    }>(tx, "SELECT provenance FROM cgt.transactions");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.provenance.native.ordinarySharesConfirmed).toBe(true);
    expect(rows[0]!.provenance.native.fields.ID).toContain("SYNTHETIC-T-");
    // Pre-existing transactions predate the explicit executionReference property.
    await query(tx, "UPDATE cgt.transactions SET provenance = provenance - 'executionReference' WHERE import_id=$1", [confirmed.draftId]);
  });
  await workspace.reverseImport(s.user, confirmed.draftId, "Synthetic legacy receipt check");
  expect((await workspace.importDetail(s.user, confirmed.draftId, 1)).records[0]?.tradeDetail).toMatchObject({
    executionReference: "SYNTHETIC-T-001", date: "2024-06-01", side: "BUY",
  });
  await new OwnedDatabase(database.db).run(s.user, (tx) =>
    query(tx, "UPDATE cgt.imports SET record_receipts = '[]'::jsonb WHERE id=$1", [confirmed.draftId]),
  );
  const earliestReceipt = await workspace.importDetail(s.user, confirmed.draftId, 1);
  expect(earliestReceipt.legacy).toBe(true);
  expect(earliestReceipt.total).toBe(2);
  expect(earliestReceipt.records[0]?.tradeDetail?.executionReference).toBe("SYNTHETIC-T-001");
});

it("returns the imported instrument name for scenario holdings only", async () => {
  const { user, portfolio, account } = await setup("holding-names");
  const csv = readFileSync(new URL("./fixtures/brokers/trading212-gbp.csv", import.meta.url), "utf8");
  const prepared = await workspace.prepareImport(user, { accountId: account.id, format: "native", ordinarySharesConfirmed: true, csv });
  expect((await workspace.commitImport(user, prepared.draftId, prepared.revision)).outcome).toBe("committed");
  const run = await workspace.calculate(user, {
    portfolioId: portfolio.id, taxYear: "2024-25", historyThrough: "2025-05-05",
    personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2", confirmedAccountIds: [account.id],
  });
  expect(run.result.pools).toHaveLength(1);
  expect(await workspace.overview(user)).not.toHaveProperty("instrumentNames");
  expect((await workspace.overview(user, false, false, undefined, true)).instrumentNames).toEqual({
    GB0008706128: "Synthetic ordinary share",
  });
});

describe("report ownership and assisted draft concurrency", () => {
  it.each(["2.0.0-alpha.1", "2.0.0-alpha.2", "2.0.0-alpha.3", "2.0.0-alpha.4"])("preserves %s history and requires a new calculation before purchase or download", async (version) => {
    const s = await setup("legacy-report-" + version);
    const draft = await prepare(s.user, s.account.id);
    await workspace.commitImport(s.user, draft.draftId, draft.revision);
    const input = { portfolioId: s.portfolio.id, taxYear: "2024-25", historyThrough: "2025-05-05", personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2", confirmedAccountIds: [s.account.id] };
    await expect(workspace.calculate(s.user, { ...input, scopeDeclaration: undefined })).rejects.toMatchObject({ code: "SCOPE_CONFIRMATION_REQUIRED" });
    await expect(workspace.calculate(s.user, { ...input, scopeDeclaration: "personal-uk-resident-v1" })).rejects.toMatchObject({ code: "SCOPE_CONFIRMATION_REQUIRED" });
    await expect(workspace.calculate(s.user, { ...input, personalScopeConfirmed: false })).rejects.toMatchObject({ code: "SCOPE_CONFIRMATION_REQUIRED" });
    const run = await workspace.calculate(s.user, input);
    const legacy = { ...run.result, engineVersion: version, scopeDeclaration: undefined };
    const revision = (await workspace.overview(s.user)).portfolio.revision;
    await database.pg.exec("RESET ROLE");
    await database.pg.query("UPDATE cgt.calculation_runs SET engine_version=$2,result=$3::jsonb WHERE id=$1", [run.runId, version, JSON.stringify(legacy)]);
    await database.pg.exec("SET ROLE cgt_app");
    expect(await workspace.overview(s.user, false, true)).toMatchObject({
      portfolio: { revision }, calculations: [], staleReportYears: ["2024-25"],
      previousCalculationInputs: [{ taxYear: "2024-25", recoveryReason: "rules" }],
    });
    for (const format of ["summary", "evidence"] as const) {
      expect(await workspace.selectedReportIssue(s.user, { year: input.taxYear, format }, "purchase")).toMatchObject({ code: "REPORT_UNAVAILABLE" });
    }
    await expect(workspace.reportSnapshot(s.user, run.runId)).rejects.toMatchObject({ code: "REPORT_UNAVAILABLE" });
    const refreshed = await workspace.calculate(s.user, input);
    expect(refreshed.runId).not.toBe(run.runId);
    expect((await workspace.reportSnapshot(s.user, refreshed.runId)).result).toMatchObject({ scopeDeclaration: "personal-market-trades-v2" });
    const raw = await new OwnedDatabase(database.db).run(s.user, (tx) =>
      query<{ engine_version: string }>(tx, "SELECT engine_version FROM cgt.calculation_runs WHERE id=$1", [run.runId]),
    );
    expect(raw[0]?.engine_version).toBe(version);
  });
  it("retains original FX below a half-penny boundary when saving and when reading an older conversion", async () => {
    const s = await setup("precise-fx-readback");
    const file = [
      csv.split("\n")[0],
      "original,2024-06-01,BUY,US0378331005,1,451.66665,0,USD,0.81300003,ORDINARY_SHARE",
      "sale,2024-10-01,SELL,US0378331005,1,400,0,GBP,1,ORDINARY_SHARE",
    ].join("\n");
    const draft = await prepare(s.user, s.account.id, file);
    expect(draft.review.records[0]?.trade?.considerationGBP).toBe("367.2049999999995");
    await workspace.commitImport(s.user, draft.draftId, draft.revision);
    const inputs = { portfolioId: s.portfolio.id, taxYear: "2024-25", historyThrough: "2025-05-05",
      confirmedAccountIds: [s.account.id], personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2" };
    const run = await workspace.calculate(s.user, inputs);
    expect(run.result.summary).toMatchObject({ allowableCostsGBP: "367.20", netGainGBP: "32.80" });
    const owned = new OwnedDatabase(database.db);
    await owned.run(s.user, async tx => {
      const [trade] = await query<{ amount: string }>(tx,
        "SELECT trim_scale(consideration_gbp)::text AS amount FROM cgt.transactions WHERE side='BUY'");
      expect(trade?.amount).toBe("367.2049999999995");
      await query(tx, "UPDATE cgt.transactions SET consideration_gbp=round(consideration_gbp,12) WHERE side='BUY'");
    });
    const legacy = await workspace.calculate(s.user, inputs);
    expect(legacy.result.summary).toEqual(run.result.summary);
    const [ledger] = await owned.run(s.user, tx => query<{ original: string; supported: string; ambiguous: string }>(tx,
      `SELECT consideration_gbp::text AS original, cgt.ledger_gbp(consideration_gbp,provenance->>'consideration',provenance->>'gbpPerUnit')::text AS supported,
      cgt.ledger_gbp(consideration_gbp,'1.00','1')::text AS ambiguous FROM cgt.transactions WHERE side='BUY'`));
    expect(ledger?.original).toMatch(/^367\.2050*$/);
    expect(ledger?.supported).toBe("367.2049999999995");
    expect(ledger?.ambiguous).toBe("367.205");
    await owned.run(s.user, tx => query(tx, "UPDATE cgt.transactions SET provenance=provenance-'gbpPerUnit' WHERE side='BUY'"));
    await expect(workspace.calculate(s.user, inputs)).rejects.toMatchObject({ code: "IMPORT_REVIEW_REQUIRED" });
    await expect(workspace.reportSnapshot(s.user, run.runId, "csv")).rejects.toMatchObject({ code: "REPORT_UNAVAILABLE" });
    await owned.run(s.user, tx => query(tx, `UPDATE cgt.transactions SET provenance=provenance || '{"gbpPerUnit":"1"}'::jsonb WHERE side='BUY'`));
    await expect(workspace.calculate(s.user, inputs)).rejects.toMatchObject({ code: "IMPORT_REVIEW_REQUIRED" });

  });

  it("keeps a later saved sale out of partial-year figures and offers a route back to it", async () => {
    const s = await setup("partial-year-with-later-sale");
    const draft = await prepare(s.user, s.account.id);
    await workspace.commitImport(s.user, draft.draftId, draft.revision);
    const input = { portfolioId: s.portfolio.id, taxYear: "2024-25", historyThrough: "2024-06-30", personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2", confirmedAccountIds: [s.account.id] };
    await expect(workspace.calculate(s.user, { ...input, historyThrough: "2024-04-05" })).rejects.toMatchObject({ code: "HISTORY_BEFORE_TAX_YEAR" });
    const part = await workspace.calculate(s.user, input);
    expect(part.result).toMatchObject({ hasLaterSales: true, disposals: [], status: "provisional" });
    expect(await workspace.selectedReportIssue(s.user, { year: input.taxYear, format: "summary" }, "purchase"))
      .toMatchObject({code:"REPORT_INCOMPLETE", message:expect.stringMatching(/sales after this cutoff/)});
    const complete = await workspace.calculate(s.user, { ...input, historyThrough: "2025-05-05" });
    expect(complete.result.disposals).toHaveLength(1);
    expect(await workspace.selectedReportIssue(s.user, { year: input.taxYear, format: "summary" }, "purchase")).toBeNull();
  });
  it("allows only current owned snapshots and blocks pending files and invalidated runs", async () => {
    const a = await setup("report-owner"),
      b = await setup("report-other");
    const draft = await prepare(a.user, a.account.id);
    await workspace.commitImport(a.user, draft.draftId, draft.revision);
    const run = await workspace.calculate(a.user, {
      portfolioId: a.portfolio.id,
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
      personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2",
      confirmedAccountIds: [a.account.id],
    });
    expect(
      (await workspace.reportSnapshot(a.user, run.runId)).result.summary,
    ).toEqual(run.result.summary);
    const published = await workspace.reportSnapshot(a.user, run.runId);
    expect(published.accounts).toEqual([{label: a.account.label, broker: a.account.broker, confirmed: true}]);
    const saleKeys = published.result.disposals.flatMap(d => d.sourceIds);
    expect(await workspace.reportSources(a.user, saleKeys)).toEqual(
      expect.arrayContaining([expect.objectContaining({label: a.account.label, broker: a.account.broker})])
    );
    expect(await workspace.reportSources(b.user, saleKeys)).toEqual([]);
    await expect(
      workspace.reportSnapshot(b.user, run.runId),
    ).rejects.toMatchObject({ status: 404 });
    const pending = await prepare(a.user, a.account.id);
    await expect(
      workspace.reportSnapshot(a.user, run.runId),
    ).rejects.toMatchObject({ code: "PENDING_IMPORTS" });
    await workspace.discardDraft(a.user, pending.draftId);
    expect((await workspace.reportSnapshot(a.user, run.runId)).id).toBe(
      run.runId,
    );
    await workspace.reverseImport(
      a.user,
      draft.draftId,
      "Synthetic qualification reversal",
    );
    expect(await workspace.reportSources(a.user, saleKeys)).toEqual([]);
    await expect(
      workspace.reportSnapshot(a.user, run.runId),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("persists evidence, rejects other owners and stale editors, and rechecks the exact reviewed details", async () => {
    const a = await setup("assisted-owner"),
      b = await setup("assisted-other");
    const hlAccount = await workspace.addAccount(a.user, {
      portfolioId: a.portfolio.id,
      broker: "hl",
      label: "Synthetic HL",
      accountType: "GIA",
    });
    const file =
      "Trade date,Settle date,Reference,Description,Unit cost (p),Quantity,Value (£)\n01/06/2024,03/06/2024,B900000001,Synthetic,50,1000,-508.49";
    const draft = await workspace.prepareImport(a.user, {
      accountId: hlAccount.id,
      csv: file,
      format: "native",
      ordinarySharesConfirmed: true,
    });
    const detail = {
      isin: "GB0008706128",
      currency: "GBP",
      gbpPerUnit: "1",
      priceUnit: "minor" as const,
      fees: "8.49",
      transactionId: "",
      reference: "Synthetic contract note B900000001",
      netAmountConfirmed: true,
    };
    await expect(
      workspace.supplyImportDetails(b.user, draft.draftId, 2, detail, 0),
    ).rejects.toMatchObject({ status: 404 });
    const reviewed = await workspace.supplyImportDetails(
      a.user,
      draft.draftId,
      2,
      detail,
      0,
    );
    expect(reviewed.review.status).toBe("ready");
    expect(reviewed.reviewVersion).toBe(1);
    expect(
      (await workspace.reviewImport(a.user, draft.draftId)).review.records[0]
        ?.supportingDetails,
    ).toEqual(detail);
    await expect(
      workspace.supplyImportDetails(a.user, draft.draftId, 2, detail, 0),
    ).rejects.toMatchObject({ code: "DETAILS_CHANGED" });
    expect(
      (
        await workspace.commitImport(
          a.user,
          draft.draftId,
          reviewed.revision,
          0,
        )
      ).outcome,
    ).toBe("review_changed");
    expect(
      (
        await workspace.commitImport(
          a.user,
          draft.draftId,
          reviewed.revision,
          1,
        )
      ).outcome,
    ).toBe("committed");
    await new OwnedDatabase(database.db).run(a.user, async (tx) => {
      const records = await query<{
        provenance: { native: { supportingDetails: unknown } };
      }>(tx, "SELECT provenance FROM cgt.transactions WHERE account_id=$1", [
        hlAccount.id,
      ]);
      expect(records[0]?.provenance.native.supportingDetails).toEqual(detail);
    });
  });
});

// Run the public application service and real schema for each supported native path.
// This catches gaps hidden by pure-parser tests: evidence versions, persistence,
// duplicate retries, published snapshots and audited reversals.
import { brokerCases, fixture, fixtureRows, fixtureDetails } from "./helpers/broker-corpus";
it.each(brokerCases)(
  "persists the complete $file upload-to-report journey",
  async (c) => {
    const user = await owner(`native-${c.file}`);
    const { portfolio } = await workspace.overview(user);
    const account = await workspace.addAccount(user, {
      portfolioId: portfolio.id,
      broker: c.broker,
      label: `Synthetic ${c.file}`,
      accountType: "GIA",
    });
    let draft = await workspace.prepareImport(user, {
      accountId: account.id,
      csv: fixture(c),
      format: "native",
      ordinarySharesConfirmed: true,
    });
    for (const [record, details] of Object.entries(fixtureDetails(c)))
      draft = await workspace.supplyImportDetails(
        user,
        draft.draftId,
        Number(record),
        details,
        draft.reviewVersion,
      );
    expect(draft.review.status, JSON.stringify(draft.review.issues)).toBe(
      "ready",
    );
    expect(
      (
        await workspace.commitImport(
          user,
          draft.draftId,
          draft.revision,
          draft.reviewVersion,
        )
      ).outcome,
    ).toBe("committed");
    const run = await workspace.calculate(user, {
      portfolioId: portfolio.id,
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
      personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2",
      confirmedAccountIds: [account.id],
    });
    expect(run.result.summary?.netGainGBP).toBe(c.gain);
    if (c.broker === "ii") {
      const scenarios = await workspace.overview(user, false, false, undefined, true);
      expect(scenarios.instrumentNames?.[run.result.pools[0]!.securityId]).toBe("synthetic ordinary share");
    }
    expect((await workspace.reportSnapshot(user, run.runId)).result).toEqual(
      run.result,
    );
    // Exercise real exports from the persisted native-broker result, with only
    // the session/provider entitlement stubbed. These are not hosted Stripe tests.
    const entitled = vi.fn(async () => true);
    const reports = createReportHandler({
      origin: "https://cgt.test",
      readSession: async () => ({
        user: { id: user.ownerId, emailVerified: true },
        session: { expiresAt: new Date(Date.now() + 3600000) },
      }),
      snapshot: (identity, id, kind) => workspace.reportSnapshot(identity, id, kind),
      consume: (identity) => workspace.consumeRequest(identity, "calculate"),
      entitled,
    });
    const download = (kind: string) =>
      reports(
        new Request("https://cgt.test/api/v2/reports", {
          method: "POST",
          headers: {
            origin: "https://cgt.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({ kind, runId: run.runId }),
        }),
      );
    const csvResponse = await download("csv");
    expect(csvResponse.status).toBe(200);
    const rows = Papa.parse<string[]>(await csvResponse.text()).data;
    expect(rows).toContainEqual(["netGainGBP", c.gain]);
    expect(rows).toContainEqual(["Calculation reference", run.runId]);
    const traceHeader = rows.findIndex((row) => row[0] === "Trace reference");
    const savedSale = rows.slice(traceHeader + 1).find((row) => row[0] === run.result.disposals[0]!.sourceIds[0]);
    expect(savedSale?.[rows[traceHeader]!.indexOf("Import reference")]).toBe(draft.draftId);
    expect(rows).toContainEqual([account.label, account.broker, "Yes"]);
    expect(entitled).not.toHaveBeenCalled();
    for (const kind of ["summary", "evidence"]) {
      const response = await download(kind);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toBe(
        `attachment; filename="CGT-${kind}-2024-25.pdf"`,
      );
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const document = await PDFDocument.load(await response.arrayBuffer());
      expect(document.getTitle()).toContain("2024-25");
      expect(document.getPageCount()).toBeGreaterThan(0);
      if (kind === "evidence") {
        const text = reportPageText(document);
        const sale = fixtureRows(c)[1]!;
        const supporting = fixtureDetails(c)["3"];
        const referenceColumn = { trading212: "ID", freetrade: "Order ID", hl: "Reference",
          ii: "Reference", ibkr: "TradeID", ajbell: "" }[c.broker];
        const expectedExecution = referenceColumn ? sale[referenceColumn] : supporting?.transactionId;
        expect(expectedExecution).toBeTruthy();
        expect(text).toContain(`file row 3\nExecution reference: ${expectedExecution}`);
        if (supporting) expect(text).toContain(`Statement reference: ${supporting.reference}`);
        else expect(text).not.toContain("Statement reference:");
        expect(text).toContain(`Trace reference: ${run.result.disposals[0]!.sourceIds[0]}`);
      }
    }
    entitled.mockResolvedValue(false);
    expect((await download("summary")).status).toBe(402);
    entitled.mockResolvedValue(true);
    const duplicate = await workspace.prepareImport(user, {
      accountId: account.id,
      csv: fixture(c),
      format: "native",
      ordinarySharesConfirmed: true,
    });
    expect((await download("csv")).status).toBe(409);
    let reviewed = duplicate;
    for (const [record, details] of Object.entries(fixtureDetails(c)))
      reviewed = await workspace.supplyImportDetails(
        user,
        reviewed.draftId,
        Number(record),
        details,
        reviewed.reviewVersion,
      );
    expect(reviewed.review.counts.duplicate).toBe(2);
    expect(
      (
        await workspace.commitImport(
          user,
          reviewed.draftId,
          reviewed.revision,
          reviewed.reviewVersion,
        )
      ).outcome,
    ).toBe("needs_review");
    if (reviewed.reviewVersion > 0) {
      await expect(workspace.discardDraft(user, duplicate.draftId, 0)).rejects.toMatchObject({ code: "DETAILS_CHANGED" });
      expect((await workspace.reviewImport(user, duplicate.draftId)).reviewVersion).toBe(reviewed.reviewVersion);
    }
    await workspace.discardDraft(user, duplicate.draftId, reviewed.reviewVersion);
    expect((await workspace.overview(user)).imports).toHaveLength(1);
    await workspace.reverseImport(
      user,
      draft.draftId,
      "Synthetic broker qualification completed",
    );
    await expect(
      workspace.reportSnapshot(user, run.runId),
    ).rejects.toMatchObject({ status: 404 });
    for (const kind of ["csv", "summary", "evidence"])
      expect((await download(kind)).status).toBe(404);
    await expect(
      workspace.calculate(user, {
        portfolioId: portfolio.id,
        taxYear: "2024-25",
        historyThrough: "2025-05-05",
        personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2",
        confirmedAccountIds: [account.id],
      }),
    ).rejects.toMatchObject({ code: "NO_TRANSACTIONS" });
  },
);

describe("assisted cumulative broker exports", () => {
  for (const variant of ["current-hl", "current-ii", "current-ajbell", "legacy-major", "legacy-minor"]) {
    it(`saves only new executions and preserves both supporting notes for ${variant}`, async () => {
      const { createHash } = await import("node:crypto");
      const { fingerprintDetails } = await import("../src/domain/imports/supporting-details");
      const broker = variant.startsWith("legacy") ? "freetrade" : variant.split("-")[1];
      const c = brokerCases.find((entry) => entry.broker === broker && Object.keys(fixtureDetails(entry)).length)!;
      const investor = await owner(`assisted-repeat-${variant}`);
      const { portfolio } = await workspace.overview(investor);
      const account = await workspace.addAccount(investor, {
        portfolioId: portfolio.id, broker: c.broker, label: "Synthetic GIA", accountType: "GIA",
      });
      const details = fixtureDetails(c);
      const prepareRows = (rows: Record<string, string>[]) => workspace.prepareImport(investor, {
        accountId: account.id, csv: Papa.unparse(rows), format: "native", ordinarySharesConfirmed: true,
      });
      const rows = fixtureRows(c);
      const buy = await prepareRows([rows[0]!]);
      const first = await workspace.supplyImportDetails(investor, buy.draftId, 2, details["2"]!, 0);
      expect((await workspace.commitImport(investor, buy.draftId, first.revision, 1)).outcome).toBe("committed");
      if (variant.startsWith("legacy")) {
        // Reconstruct the transaction exactly as deployed before the fix, including
        // the old contradictory minor-unit declaration in its unmodified jsonb.
        const record = first.review.records[0]!;
        const original = fingerprintDetails({ ...details["2"]!, priceUnit: variant.endsWith("minor") ? "minor" : "major" });
        const provenance = { ...record.provenance!, native: { ...record.provenance!.native!, supportingDetails: original } };
        const digest = createHash("sha256").update(JSON.stringify({trade: record.trade, provenance})).digest("hex");
        await database.pg.exec("RESET ROLE");
        try {
          await database.pg.query("UPDATE cgt.transactions SET content_digest=$1, provenance=jsonb_set(provenance,'{native,supportingDetails}',$2::jsonb) WHERE import_id=$3",
            [digest, JSON.stringify(original), buy.draftId]);
        } finally { await database.pg.exec("SET ROLE cgt_app"); }
      }
      const cumulative = await prepareRows(rows);
      const revised = { ...details["2"]!, reference: details["2"]!.reference + " (personal copy)" };
      await workspace.supplyImportDetails(investor, cumulative.draftId, 2, revised, 0);
      const ready = await workspace.supplyImportDetails(investor, cumulative.draftId, 3, details["3"]!, 1);
      expect(ready.review.counts, JSON.stringify(ready.review.issues)).toMatchObject({ duplicate: 1, accepted: 1, needsReview: 0 });
      expect((await workspace.commitImport(investor, cumulative.draftId, ready.revision, 2)).outcome).toBe("committed");
      const prior = await workspace.importDetail(investor, buy.draftId, 1);
      expect(prior.records[0]?.tradeDetail?.statementReference).toBe(details["2"]!.reference);
      const receipt = await workspace.importDetail(investor, cumulative.draftId, 1);
      expect(receipt.records[0]).toMatchObject({ status: "duplicate", statementReference: revised.reference });
      const run = await workspace.calculate(investor, {
        portfolioId: portfolio.id, taxYear: "2024-25", historyThrough: "2025-05-05", personalScopeConfirmed: true, scopeDeclaration: "personal-market-trades-v2", confirmedAccountIds: [account.id],
      });
      expect(run.result.summary?.netGainGBP).toBe(c.gain);
    });
  }
});
