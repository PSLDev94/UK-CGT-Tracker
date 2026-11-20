import { CURRENT_SCOPE_DECLARATION } from "../src/domain/cgt/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Papa from "papaparse";
import { PDFDocument } from "pdf-lib";
import { reportPageText } from "./helpers/pdf-text";
import { reportPdf } from "../src/domain/reports/pdf";
import { reportCsv } from "../src/domain/reports/report";
import { CANONICAL_HEADERS, reviewCsv } from "../src/domain/imports/review";
import { decodeBrokerCsv } from "../src/domain/imports/decode-csv";
import { sourceKey } from "../src/domain/imports/ibkr-identity";
import { activeImportIssue } from "../src/server/import-integrity";
import { OwnedDatabase, query } from "../src/server/database";
import { Workspace } from "../src/server/workspace";
import { authenticate } from "../src/server/identity";
import { brokerCases, fixture, fixtureRows } from "./helpers/broker-corpus";
import { testDatabase } from "./helpers/database";

const ib = brokerCases.find((c) => c.broker === "ibkr")!;
const native = fixture(ib);
const cfg = {
  broker: "ibkr",
  accountId: "test",
  accountType: "GIA",
  format: "native",
  ordinarySharesConfirmed: true,
} as const;
function template(prefix = "") {
  return Papa.unparse([
    CANONICAL_HEADERS,
    [
      prefix + "12345",
      "2024-06-01",
      "BUY",
      "GB0008706128",
      "1000",
      "500",
      "5.5",
      "GBP",
      "1",
      "ORDINARY_SHARE",
    ],
    [
      prefix + "12346",
      "2024-07-01",
      "SELL",
      "GB0008706128",
      "250",
      "200",
      "2",
      "GBP",
      "1",
      "ORDINARY_SHARE",
    ],
  ]);
}

it("requires non-zero ordinary-trade consideration and checks cash exclusions against trade-shaped fields", () => {
  const opts = { ...cfg, format: "canonical-v1", broker: "hl" } as const;
  const base = template();
  for (const change of [
    base.replace(",500,", ",0,"),
    base.replace(",200,", ",0,"),
  ])
    expect(reviewCsv(change, opts).issues[0]?.message).toMatch(
      /zero consideration/i,
    );
  for (const type of [
    "CASH_DEPOSIT",
    "CASH_WITHDRAWAL",
    "CASH_INTEREST",
    "CASH_DIVIDEND",
  ]) {
    const row = [
      "cash",
      "2024-07-01",
      type,
      "",
      "0",
      "200",
      "0",
      "GBP",
      "1",
      "",
    ];
    const run = (fields: string[]) =>
      reviewCsv(base + "\r\n" + fields.join(","), opts);
    expect(run(row).counts.excluded).toBe(1);
    expect(run(row.with(4, "10")).status).toBe("needs_review");
    expect(run(row.with(6, "8")).status).toBe("needs_review");
    expect(run(row.with(3, "GB0008706128")).counts.excluded).toBe(
      type === "CASH_DIVIDEND" ? 1 : 0,
    );
  }
});

it("decodes the legacy pound byte only for the recognised HL layout and preserves dated source numbering", () => {
  const note = {
    isin: "GB0008706128",
    currency: "GBP",
    gbpPerUnit: "1",
    fees: "8.49",
    priceUnit: "minor",
    transactionId: "",
    reference: "Example note",
    netAmountConfirmed: true,
  } as const;
  const text = [
    "Transaction Summary, , , ,",
    "Client Name:,Example, , ,",
    "Client Number:,EXAMPLE, , ,",
    "Valuation as at,09-08-2026 16:40, , ,",
    "",
    "Trade date,Settle date,Reference,Description,Unit cost (p),Quantity,Value (£),",
    "01/06/2024,03/06/2024,B900000001,Example,50,1000,-508.49",
    "",
  ].join("\r\n");
  const bytes = Uint8Array.from(Buffer.from(text, "latin1")).buffer;
  expect(decodeBrokerCsv(bytes, "hl", "native")).toBe(text);
  expect(() => decodeBrokerCsv(bytes, "ii", "native")).toThrow();
  expect(() => decodeBrokerCsv(bytes, "hl", "canonical-v1")).toThrow();
  const opts = {
    ...cfg,
    broker: "hl",
    supportingDetails: { "7": note },
  } as const;
  const approved = reviewCsv(decodeBrokerCsv(bytes, "hl", "native"), opts);
  expect(approved.status).toBe("ready");
  expect(approved.records[0]?.record).toBe(7);
  for (const damaged of [
    text.replace("Valuation as at", "Trade adjustment"),
    text.replace("16:40", "account closed"),
    text.replace("09-08-2026 16:40", "31-02-2026 16:40"),
    text.replace("16:40, ,", "16:40,transfer,"),
  ])
    expect(reviewCsv(damaged, opts).status).not.toBe("ready");
});

it("does not prefill an IBKR GBP exchange rate or accept unknown or contradictory statement bases", () => {
  const rows = fixtureRows(ib);
  const usd = rows.map((r) => ({
    ...r,
    CurrencyPrimary: "USD",
    IBCommissionCurrency: "USD",
    FXRateToBase: "0.8",
  }));
  const note = {
    isin: "GB0008706128",
    currency: "USD",
    gbpPerUnit: "0.8",
    fees: "5.5",
    priceUnit: "major",
    transactionId: "",
    reference: "GBP base shown on statement",
    netAmountConfirmed: true,
  } as const;
  const input = Papa.unparse([usd[0]!]);
  expect(reviewCsv(input, cfg).records[0]?.exportedTerms).toMatchObject({
    fxRateToBase: "0.8",
  });
  expect(
    reviewCsv(input, cfg).records[0]?.exportedTerms?.gbpPerUnit,
  ).toBeUndefined();
  for (const base of [undefined, "USD", "GBP"])
    expect(
      reviewCsv(input, {
        ...cfg,
        supportingDetails: { "2": { ...note, statementBaseCurrency: base } },
      }).status,
    ).toBe(base === "GBP" ? "ready" : "needs_review");
  expect(
    reviewCsv(input, {
      ...cfg,
      supportingDetails: {
        "2": { ...note, gbpPerUnit: "1", statementBaseCurrency: "GBP" },
      },
    }).status,
  ).toBe("needs_review");
  const mixed = Papa.unparse([
    { ...rows[0], FXRateToBase: "1.25" },
    { ...usd[0], FXRateToBase: "1", TradeID: "USD-fill" },
  ]);
  const flagged = reviewCsv(mixed, {
    ...cfg,
    supportingDetails: {
      "3": { ...note, gbpPerUnit: "1", statementBaseCurrency: "USD" },
    },
  });
  expect(flagged.counts.needsReview).toBe(2);
});

describe("persisted IBKR execution and report integrity", () => {
  let db: Awaited<ReturnType<typeof testDatabase>>;
  let owner: OwnedDatabase;
  let ws: Workspace;
  beforeAll(async () => {
    db = await testDatabase("cgt_app");
    owner = new OwnedDatabase(db.db);
    ws = new Workspace(owner);
  }, 30000);
  afterAll(async () => {
    await db.db.destroy();
  });
  async function setup(id: string) {
    await db.pg.exec("RESET ROLE");
    await db.pg.query(
      'INSERT INTO auth."user"(id,name,email,"emailVerified") VALUES($1,$1,$2,true)',
      [id, id + "@example.test"],
    );
    await db.pg.exec("SET ROLE cgt_app");
    const user = await authenticate(new Headers(), async () => ({
      user: { id, emailVerified: true },
      session: { expiresAt: new Date(Date.now() + 60000) },
    }));
    const { portfolio } = await ws.overview(user);
    const account = (label: string) =>
      ws.addAccount(user, {
        portfolioId: portfolio.id,
        broker: "ibkr",
        label,
        accountType: "GIA",
      });
    const preview = (
      accountId: string,
      csv: string,
      format: "native" | "canonical-v1",
    ) =>
      ws.prepareImport(user, {
        accountId,
        csv,
        format,
        ordinarySharesConfirmed: true,
      });
    const save = (d: Awaited<ReturnType<typeof preview>>) =>
      ws.commitImport(user, d.draftId, d.revision, d.reviewVersion);
    const inspect = async (...args: Parameters<typeof preview>) => {
      const d = await preview(...args);
      await ws.discardDraft(user, d.draftId, d.reviewVersion);
      return d.review;
    };
    const issue = () =>
      owner.run(user, (tx) => activeImportIssue(tx, portfolio.id));
    return { user, portfolio, account, preview, inspect, save, issue };
  }
  it("detects cross-format overlap in either direction and across labels while allowing independent accounts and a reversed import", async () => {
    const s = await setup("overlap");
    const main = await s.account("Main");
    const alt = await s.account("Alternate");
    const initial = await s.preview(main.id, native, "native");
    expect((await s.save(initial)).outcome).toBe("committed");
    expect(
      (await s.inspect(main.id, template(), "canonical-v1")).counts.duplicate,
    ).toBe(2);
    expect(
      (await s.inspect(main.id, template("SYNTHETIC:"), "canonical-v1")).counts
        .duplicate,
    ).toBe(2);
    expect(
      (
        await s.inspect(
          main.id,
          template().replace(",200,", ",201,"),
          "canonical-v1",
        )
      ).counts.needsReview,
    ).toBe(1);
    const calc = await ws.calculate(s.user, {
      portfolioId: s.portfolio.id, taxYear: "2024-25", historyThrough: "2025-05-05",
      confirmedAccountIds: [main.id,alt.id], personalScopeConfirmed: true, scopeDeclaration: CURRENT_SCOPE_DECLARATION,
    });
    expect(calc.result.summary?.netGainGBP).toBe("71.63");
    const wrong = await s.preview(alt.id, native, "native");
    expect(wrong.review.counts.needsReview).toBe(2);
    expect((await s.save(wrong)).outcome).not.toBe("committed");
    await ws.discardDraft(s.user,wrong.draftId,wrong.reviewVersion);
    expect((await ws.reportSnapshot(s.user,calc.runId)).result.summary?.netGainGBP).toBe("71.63");
    expect(
      (await s.inspect(alt.id, template(), "canonical-v1")).counts.needsReview,
    ).toBe(2);
    const distinct = await s.preview(
      alt.id,
      template("DISTINCT:"),
      "canonical-v1",
    );
    expect((await s.save(distinct)).outcome).toBe("committed");
    expect(
      (
        await s.inspect(
          alt.id,
          native.replaceAll("SYNTHETIC", "DISTINCT"),
          "native",
        )
      ).counts.duplicate,
    ).toBe(2);
    expect(await s.issue()).toBeNull();
    await ws.reverseImport(
      s.user,
      initial.draftId,
      "Original statement reviewed",
    );
    expect(
      (
        await s.save(
          await s.preview(main.id, template("SYNTHETIC:"), "canonical-v1"),
        )
      ).outcome,
    ).toBe("committed");
    expect((await s.inspect(main.id, native, "native")).counts.duplicate).toBe(
      2,
    );
    expect(await s.issue()).toBeNull();
  });
  it("reconciles both currencies, retained pools and every report using independently evidenced GBP rates", async () => {
    const s = await setup("mixed-gbp");
    const a = await s.account("Multiple currencies");
    const rows = fixtureRows(ib);
    const us = rows.map((r) => ({
      ...r,
      CurrencyPrimary: "USD",
      IBCommissionCurrency: "USD",
      ISIN: "US0378331005",
      FXRateToBase: "0.8",
      TradeID: "US-" + r.TradeID,
    }));
    let d = await s.preview(a.id, Papa.unparse([...rows, ...us]), "native");
    for (const [index, r] of us.entries()) {
      d = await ws.supplyImportDetails(
        s.user,
        d.draftId,
        4 + index,
        {
          isin: r.ISIN,
          currency: "USD",
          gbpPerUnit: "0.8",
          fees: index === 0 ? "5.5" : "2",
          priceUnit: "major",
          transactionId: "",
          reference: "Confirmed GBP-base Flex statement",
          statementBaseCurrency: "GBP",
          netAmountConfirmed: true,
        },
        d.reviewVersion,
      );
    }
    expect((await s.save(d)).outcome).toBe("committed");
    const calculate = () =>
      ws.calculate(s.user, {
        portfolioId: s.portfolio.id,
        taxYear: "2024-25",
        historyThrough: "2025-05-05",
        confirmedAccountIds: [a.id],
        personalScopeConfirmed: true, scopeDeclaration: CURRENT_SCOPE_DECLARATION,
      });
    async function checkReports() {
      const calc = await calculate();
      expect(calc.result.disposals.map((r) => r.gainGBP).sort()).toEqual([
        "57.30",
        "71.63",
      ]);
      expect(calc.result.summary?.netGainGBP).toBe("128.93");
      expect(
        calc.result.pools.map((p) => [p.securityId, p.quantity, p.costGBP]),
      ).toEqual([
        ["GB0008706128", "750", "379.125"],
        ["US0378331005", "750", "303.3"],
      ]);
      const snap = await ws.reportSnapshot(s.user, calc.runId);
      expect(reportCsv(snap)).toContain('"netGainGBP","128.93"');
      for (const evidence of [false, true]) {
        const text = reportPageText(
          await PDFDocument.load(await reportPdf(snap, evidence)),
        );
        expect(text).toContain("128.93");
      }
    }
    await checkReports();
    // In a non-GBP-base file FXRateToBase cannot supply a GBP rate. Recover
    // using the contract-note template, with separate documented conversions.
    await ws.reverseImport(
      s.user,
      d.draftId,
      "Reconcile non-GBP statement through template",
    );
    const gbp = template("SYNTHETIC:");
    const dollar = Papa.parse<string[]>(gbp)
      .data.slice(1)
      .map((r) => [
        r[0]!.replace(":", ":US-"),
        r[1],
        r[2],
        "US0378331005",
        r[4],
        r[5],
        r[6],
        "USD",
        "0.8",
        r[9],
      ]);
    expect(
      (
        await s.save(
          await s.preview(
            a.id,
            gbp + "\r\n" + Papa.unparse(dollar),
            "canonical-v1",
          ),
        )
      ).outcome,
    ).toBe("committed");
    await checkReports();
  });
  it("requires evidence again for old excluded cash fields and older unbound template accounts", async () => {
    const s = await setup("legacy-cash");
    const a = await s.account("Imported before binding");
    const d = await s.preview(
      a.id,
      template("SYNTHETIC:") +
        "\r\ncash,2024-07-01,CASH_DEPOSIT,,0,200,0,GBP,1,",
      "canonical-v1",
    );
    expect((await s.save(d)).outcome).toBe("committed");
    expect(await s.issue()).toBeNull();
    await owner.run(s.user, (tx) =>
      query(
        tx,
        "UPDATE cgt.broker_accounts SET ibkr_client_account_id=NULL WHERE id=$1",
        [a.id],
      ),
    );
    expect(await s.issue()).toMatch(/no verified ClientAccountID/);
    expect((await s.inspect(a.id, native, "native")).counts.needsReview).toBe(
      2,
    );
    await owner.run(s.user, (tx) =>
      query(
        tx,
        "UPDATE cgt.imports SET parser_version='canonical-v1.0.0' WHERE id=$1",
        [d.draftId],
      ),
    );
    expect(await s.issue()).toMatch(/cash exclusions/);
    await ws.reverseImport(
      s.user,
      d.draftId,
      "Review old template with original statement",
    );
    expect(await s.issue()).toBeNull();
  });
  it("withholds a saved Flex date from the earliest possible tax period until replaced", async () => {
    const s = await setup("legacy-flex-day");
    const acc = await s.account("Flex date check");
    const d = await s.preview(acc.id, native, "native");
    await s.save(d);
    const calc = await ws.calculate(s.user, {
      portfolioId: s.portfolio.id, taxYear: "2024-25", historyThrough: "2025-05-05",
      confirmedAccountIds: [acc.id], personalScopeConfirmed: true, scopeDeclaration: CURRENT_SCOPE_DECLARATION,
    });
    await owner.run(s.user, tx => query(tx,
      `UPDATE cgt.transactions SET trade_date='2024-05-04',
        provenance=jsonb_set(provenance,'{native,fields,TradeDate}','"04/05/2024"')
       WHERE import_id=$1 AND side='BUY'`, [d.draftId]));
    const check = (through: string) => owner.run(s.user, tx => activeImportIssue(tx, s.portfolio.id, through));
    expect(await check("2024-04-04")).toBeNull();
    expect(await check("2024-04-05")).toMatch(/year-first dates/);
    await expect(ws.reportSnapshot(s.user, calc.runId, "csv")).rejects.toMatchObject({code:"REPORT_UNAVAILABLE"});
    await expect(ws.reportSnapshot(s.user, calc.runId, "summary")).rejects.toMatchObject({code:"REPORT_UNAVAILABLE"});
    expect(await ws.selectedReportIssue(s.user, {year:"2024-25",format:"evidence"}, "purchase"))
      .toMatchObject({code:"REPORT_UNAVAILABLE"});
    await ws.reverseImport(s.user, d.draftId, "Verified year-first original requested");
    expect(await s.issue()).toBeNull();
  });

  it("holds legacy unsafe FX until its receipt is reversed, without modifying the source trade", async () => {
    const s = await setup("legacy-rate");
    const acc = await s.account("IB");
    const d = await s.preview(acc.id, native, "native");
    await s.save(d);
    await owner.run(s.user, (tx) =>
      query(
        tx,
        `UPDATE cgt.transactions SET provenance=jsonb_set(provenance,'{native,fields,FXRateToBase}','"1.25"') WHERE import_id=$1`,
        [d.draftId],
      ),
    );
    expect(await s.issue()).toContain(d.draftId);
    await ws.reverseImport(
      s.user,
      d.draftId,
      "Re-importing the verified original",
    );
    expect(await s.issue()).toBeNull();
  });
  it("finds both legacy ID hashes even when a canonical receipt did not retain the original reference", async () => {
    const s = await setup("legacy-duplicates");
    const acc = await s.account("IB");
    const d = await s.preview(acc.id, native, "native");
    await s.save(d);
    const alt = await s.preview(
      acc.id,
      template().replaceAll("12345", "new1").replaceAll("12346", "new2"),
      "canonical-v1",
    );
    await s.save(alt);
    await owner.run(s.user, (tx) =>
      query(
        tx,
        `UPDATE cgt.transactions SET source_key=$2,provenance=provenance-'executionReference' WHERE import_id=$1 AND side='BUY'`,
        [alt.draftId, sourceKey("ibkr", acc.id, "12345")],
      ),
    );
    expect(await s.issue()).toMatch(/more than once/);
    await ws.reverseImport(
      s.user,
      alt.draftId,
      "Reviewed older duplicate receipt",
    );
    expect(await s.issue()).toBeNull();
  });
});
