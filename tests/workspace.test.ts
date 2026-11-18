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

  it("creates one shared portfolio across repeated visits", async () => {
    const user = await owner("one-portfolio");
    const first = await workspace.overview(user);
    expect((await workspace.overview(user)).portfolio.id).toBe(
      first.portfolio.id,
    );
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
    expect(await workspace.overview(s.user)).not.toHaveProperty("importCount");
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

describe("report ownership and assisted draft concurrency", () => {
  it("verifies an old saved calculation against its original inputs before adding the pool schedule", async () => {
    const s = await setup("legacy-report-schedule");
    const draft = await prepare(s.user, s.account.id);
    await workspace.commitImport(s.user, draft.draftId, draft.revision);
    const run = await workspace.calculate(s.user, {
      portfolioId: s.portfolio.id,
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
      confirmedAccountIds: [s.account.id],
    });
    await database.pg.exec("RESET ROLE");
    await database.pg.query(
      `UPDATE cgt.calculation_runs SET engine_version='2.0.0-alpha.1',
      result=(result - 'poolMovements' - 'annualBeforeDisposalRounding') || '{"engineVersion":"2.0.0-alpha.1"}'::jsonb WHERE id=$1`,
      [run.runId],
    );
    await database.pg.exec("SET ROLE cgt_app");
    const target = { year: "2024-25", format: "evidence" } as const;
    expect(await workspace.selectedReportIssue(s.user, target)).toBeNull();
    const saved = await workspace.reportSnapshot(s.user, run.runId);
    expect(saved.result.poolMovements).toEqual(run.result.poolMovements);
    expect(saved.result.summary).toEqual(run.result.summary);
    expect(saved.result.engineVersion).toBe("2.0.0-alpha.1");
    expect(
      (await workspace.overview(s.user, false, true)).calculations[0],
    ).toMatchObject({ evidenceIssue: null });
    await database.pg.exec("RESET ROLE");
    await database.pg.query(
      "UPDATE cgt.calculation_runs SET input_digest=repeat('b',64) WHERE id=$1",
      [run.runId],
    );
    await database.pg.exec("SET ROLE cgt_app");
    expect(await workspace.selectedReportIssue(s.user, target)).toMatchObject({
      code: "REPORT_NEEDS_REFRESH",
    });
    expect(
      await workspace.selectedReportIssue(s.user, {
        ...target,
        format: "summary",
      }),
    ).toBeNull();
    expect(
      (await workspace.reportSnapshot(s.user, run.runId)).result.poolMovements,
    ).toBeUndefined();
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
      confirmedAccountIds: [account.id],
    });
    expect(run.result.summary?.netGainGBP).toBe(c.gain);
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
      snapshot: (identity, id) => workspace.reportSnapshot(identity, id),
      sources: (identity, keys) => workspace.reportSources(identity, keys),
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
    await workspace.discardDraft(user, duplicate.draftId);
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
        confirmedAccountIds: [account.id],
      }),
    ).rejects.toMatchObject({ code: "NO_TRANSACTIONS" });
  },
);
