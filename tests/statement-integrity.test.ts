import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Papa from "papaparse";
import { CANONICAL_HEADERS, reviewCsv } from "../src/domain/imports/review";
import { CURRENT_SCOPE_DECLARATION } from "../src/domain/cgt/types";
import { authenticate } from "../src/server/identity";
import { OwnedDatabase } from "../src/server/database";
import { activeImportIssue } from "../src/server/import-integrity";
import { Workspace } from "../src/server/workspace";
import {
  brokerCases,
  fixture,
  fixtureDetails,
  fixtureRows,
  syntheticTrade,
} from "./helpers/broker-corpus";
import { testDatabase } from "./helpers/database";

const cfg = {
  accountId: "local",
  accountType: "GIA",
  ordinarySharesConfirmed: true,
  format: "native",
} as const;
const canonical = (rows: string[][]) =>
  Papa.unparse([CANONICAL_HEADERS, ...rows]);
const t212 = brokerCases.find((c) => c.file === "trading212-gbp")!;
const issueTrade = (id: string, side: "BUY" | "SELL" = "BUY", price = "1") => [
  id,
  side === "BUY" ? "2024-06-01" : "2024-08-01",
  side,
  "GB0008706128",
  "2",
  price,
  "0",
  "GBP",
  "1",
  "ORDINARY_SHARE",
];

it.each(["freetrade-gbp", "trading212-gbp", "trading212-2026-gbp"])(
  "holds contradictory cash records in %s",
  (file) => {
    const c = brokerCases.find((x) => x.file === file)!;
    const incoming = fixtureRows(c);
    const sale = incoming[1]!;
    for (const kind of c.broker === "freetrade"
      ? ["TOP_UP", "DIVIDEND", "WITHDRAWAL", "INTEREST_FROM_CASH"]
      : ["Deposit", "Dividend (Dividend)", "Withdrawal", "Interest on cash"]) {
      const result = reviewCsv(
        Papa.unparse([incoming[0]!, { ...sale, [c.activity]: kind }]),
        { ...cfg, broker: c.broker },
      );
      expect(result.status).toBe("needs_review");
      expect(result.counts).toMatchObject({
        accepted: 1,
        excluded: 0,
        needsReview: 1,
      });
    }
  },
);

it("preserves documented dividends with entitled shares, withholding, and payment references on deposits", () => {
  const ft = brokerCases.find((c) => c.file === "freetrade-gbp")!;
  const emptyFields = (
    headers: Record<string, string>,
    fields: Record<string, string>,
  ) => ({
    ...Object.fromEntries(Object.keys(headers).map((k) => [k, ""])),
    ...fields,
  });
  const f = fixtureRows(ft)[0]!;
  const dividend = emptyFields(f, {
    Type: "DIVIDEND",
    Title: "Dividend",
    Quantity: "6.36545916",
    "Dividend Eligible Quantity": "6.36545916",
    "Dividend Amount Per Share": "0.22",
    "Dividend Withheld Tax Amount": "0.21",
    "FX Fee Amount": "0.00",
    "FX Fee (BPS)": "0",
    "Base FX Rate": "0.78491703",
    "Instrument Currency": "USD",
    "Account Currency": "GBP",
    ISIN: "US0378331005",
    "Total Amount": "0.93",
  });
  const x = fixtureRows(t212)[0]!;
  const dividend212 = emptyFields(x, {
    Action: "Dividend (Dividend)",
    ISIN: "US0378331005",
    "No. of shares": "24",
    "Price / share": "0.03",
    "Currency (Price / share)": "USD",
    "Withholding tax": "0.02",
    "Currency (Withholding tax)": "USD",
    Total: "0.11",
    "Currency (Total)": "GBP",
  });
  for (const [broker, rows] of [
    ["freetrade", [f, dividend]],
    [
      "trading212",
      [
        x,
        dividend212,
        emptyFields(x, {
          Action: "Deposit",
          ID: "payment-id",
          Total: "200",
          "Currency (Total)": "GBP",
        }),
      ],
    ],
  ] as const) {
    const result = reviewCsv(Papa.unparse([...rows]), { ...cfg, broker });
    expect(result.status).toBe("ready");
    expect(result.counts.excluded).toBe(rows.length - 1);
  }
});

it.each(["trading212-gbp", "trading212-2026-gbp"])(
  "%s holds an execution-shaped dividend when the withholding field is zero or unreadable",
  (file) => {
    const rows = fixtureRows(brokerCases.find(c => c.file === file)!);
    const purchase = rows[0]!;
    // Remove the optional charge fields so only the contradictory trade evidence remains.
    const fields = Object.fromEntries(Object.entries(purchase).filter(([key]) =>
      !["Stamp duty reserve tax", "French transaction tax", "Finra fee", "Transaction fee", "Currency conversion fee"].some(charge =>
        key === charge || key === `Currency (${charge})`)));
    for (const withholding of ["", "0", "0.00", "not a charge"]) {
      const dividend = {...Object.fromEntries(Object.keys(purchase).map(k=>[k,""])), ...fields,
        "Action": "Dividend (Dividend)", "Withholding tax": withholding};
      const result = reviewCsv(Papa.unparse([rows[1]!, dividend]), { ...cfg, broker: "trading212" });
      expect(result.counts).toMatchObject({accepted:1, needsReview:1, excluded:0});
    }
  },
);

it("reconciles an execution-shaped dividend to withheld tax and credited GBP", () => {
  const [buy] = fixtureRows(t212);
  const dividend = { ...buy!, Action:"Dividend (Dividend)", "No. of shares":"100",
    "Price / share":"0.05", "Currency (Price / share)":"USD", "Exchange rate":"1.25",
    "Withholding tax":"0.75", "Currency (Withholding tax)":"USD", "Total":"3.40" };
  const read = (fields: Record<string, string>) =>
    reviewCsv(Papa.unparse([buy!, {...dividend,...fields}]), {...cfg, broker:"trading212"});
  expect(read({}).counts).toMatchObject({accepted:1, excluded:1, needsReview:0});
  expect(read({"Currency (Withholding tax)":"GBP", "Withholding tax":"0.60"}).counts.excluded).toBe(1);
  const conflictingFields: Record<string,string>[] = [
    {"Currency (Withholding tax)":""}, {"Currency (Withholding tax)":"EUR"},
    {"Exchange rate":"Not available"}, {"Withholding tax":"n/a"}, {"Total":"4.00"},
    {"Withholding tax":"0.000001", "Total":"4.00"},
  ];
  for (const change of conflictingFields) {
    expect(read(change).counts).toMatchObject({accepted:1, excluded:0, needsReview:1});
  }
});

it("holds two same-order template fills and accepts an evidenced aggregate or distinct fill IDs", () => {
  const buy = issueTrade("buy"),
    sell = issueTrade("order", "SELL", "4");
  const opts = {
    ...cfg,
    broker: "trading212",
    format: "canonical-v1",
  } as const;
  const duplicate = reviewCsv(canonical([buy, sell, sell]), opts);
  expect(duplicate.counts).toMatchObject({ needsReview: 2, duplicate: 0 });
  expect(
    duplicate.issues.every((i) => i.message.includes("within the file")),
  ).toBe(true);
  expect(
    reviewCsv(canonical([buy, sell, sell.with(0, "fill-2")]), opts).counts
      .accepted,
  ).toBe(3);
  expect(
    reviewCsv(canonical([buy, sell.with(4, "4").with(5, "8")]), opts).counts
      .accepted,
  ).toBe(2);
});

it.each(
  brokerCases.filter(
    (c) => !["freetrade-fx-fees", "ajbell-assisted-candidate"].includes(c.file),
  ),
)("preserves 0.0000001 shares in $file", (c) => {
  const data = syntheticTrade(c, {
    id: "70021",
    date: "2024-06-01",
    side: "BUY",
    quantity: "0.0000001",
    price: "100000",
    gross: "0.01",
    fees: "0",
    net: "0.01",
  });
  const result = reviewCsv(Papa.unparse([data.row]), {
    ...cfg,
    broker: c.broker,
    supportingDetails: ["hl", "ajbell", "ii"].includes(c.broker)
      ? { "2": data.details }
      : {},
  });
  expect(result.records[0]?.trade?.quantity).toBe("0.0000001");
});

describe("persisted original-statement identity and review", () => {
  let database: Awaited<ReturnType<typeof testDatabase>>,
    owner: OwnedDatabase,
    ws: Workspace;
  beforeAll(async () => {
    database = await testDatabase("cgt_app");
    owner = new OwnedDatabase(database.db);
    ws = new Workspace(owner);
  }, 30000);
  afterAll(async () => {
    await database.db.destroy();
  });
  async function admin(statement: string, values: unknown[] = []) {
    await database.pg.exec("RESET ROLE");
    try {
      return await database.pg.query(statement, values);
    } finally {
      await database.pg.exec("SET ROLE cgt_app");
    }
  }
  async function setup(
    id: string,
    broker: (typeof brokerCases)[number]["broker"] = "trading212",
  ) {
    await admin(
      'INSERT INTO auth."user"(id,name,email,"emailVerified") VALUES($1,$1,$2,true)',
      [id, id + "@example.test"],
    );
    const user = await authenticate(new Headers(), async () => ({
      user: { id, emailVerified: true },
      session: { expiresAt: new Date(Date.now() + 60000) },
    }));
    const { portfolio } = await ws.overview(user);
    const account = (label: string) =>
      ws.addAccount(user, {
        broker,
        label,
        portfolioId: portfolio.id,
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
    const active = () =>
      owner.run(user, (tx) => activeImportIssue(tx, portfolio.id));
    return { user, portfolio, account, preview, active };
  }
  it("withholds an older cash-balanced Trading 212 execution with a fee on the wrong side", async () => {
    const s = await setup("old-fee-direction");
    const a = await s.account("Invest");
    const broker = brokerCases.find(c => c.file === "trading212-2026-gbp")!;
    const d = await s.preview(a.id, fixture(broker), "native");
    await ws.commitImport(s.user, d.draftId, d.revision);
    expect(await s.active()).toBeNull();
    // Older readers accepted the same £2 charge under a sale-side purchase tax.
    await admin(`UPDATE cgt.transactions SET provenance=jsonb_set(jsonb_set(provenance,
      '{native,fields,Transaction fee}', '""'),'{native,fields,Stamp duty reserve tax}','"2"')
      WHERE import_id=$1 AND side='SELL'`, [d.draftId]);
    expect(await s.active()).toMatch(/Trading 212 charge appears on the wrong side/);
    await ws.reverseImport(s.user,d.draftId,"Original fees require a corrected contract note");
    expect(await s.active()).toBeNull();
  });
  it("holds a partial overlap and exact copy across labels, scopes independent review to one file, and recognises legacy overlap", async () => {
    const s = await setup("statement-overlap");
    const a = await s.account("First GIA"),
      b = await s.account("Second GIA");
    const first = canonical([issueTrade("a"), issueTrade("b")]);
    const old = await s.preview(a.id, first, "canonical-v1");
    await ws.commitImport(s.user, old.draftId, old.revision);
    const copy = await s.preview(b.id, first, "canonical-v1");
    expect(copy.review.issues[0]?.message).toContain(old.draftId);
    const next = canonical([issueTrade("b"), issueTrade("c")]);
    const overlap = await s.preview(b.id, next, "canonical-v1");
    expect(overlap.review.counts).toMatchObject({
      accepted: 1,
      needsReview: 1,
    });
    expect(overlap.review.issues[0]?.message).toContain("First GIA");
    expect(
      (await ws.commitImport(s.user, overlap.draftId, overlap.revision))
        .outcome,
    ).toBe("needs_review");
    await admin(
      "INSERT INTO cgt.reviewed_statement_overlaps(owner_id,account_id,file_digest,other_account_id,other_import_id,case_reference,source_reference) VALUES($1,$2,$3,$4,$5,'case-2','independent statements')",
      [s.user.ownerId, b.id, overlap.review.fileDigest, a.id, old.draftId],
    );
    expect(
      (await ws.commitImport(s.user, overlap.draftId, overlap.revision))
        .outcome,
    ).toBe("committed");
    expect(await s.active()).toBeNull();
    expect((await s.preview(b.id, first, "canonical-v1")).review.status).toBe(
      "needs_review",
    );
    await admin(
      "DELETE FROM cgt.reviewed_statement_overlaps WHERE account_id=$1",
      [b.id],
    );
    expect(await s.active()).toContain(old.draftId);
    await ws.reverseImport(s.user, overlap.draftId, "Wrong account label");
    expect(await s.active()).toBeNull();
    expect(
      (
        await s.preview(
          b.id,
          canonical([issueTrade("unrelated")]),
          "canonical-v1",
        )
      ).review.status,
    ).toBe("ready");
  });

  it("revalidates the exact original cash receipt without changing transaction counts, and can retry its confirmation", async () => {
    const s = await setup("statement-recheck"),
      a = await s.account("Original");
    const csv = fixture(t212),
      d = await s.preview(a.id, csv, "native");
    await ws.commitImport(s.user, d.draftId, d.revision);
    await admin(
      "UPDATE cgt.imports SET parser_version='trading212-invest-21-gbp-v1' WHERE id=$1",
      [d.draftId],
    );
    expect(await s.active()).toContain(d.draftId);
    expect(
      (await s.preview(a.id, csv.trim() + "\n\n", "native")).review
        .revalidatesReceiptId,
    ).toBeUndefined();
    const check = await s.preview(a.id, csv, "native");
    expect(check.review.revalidatesReceiptId).toBe(d.draftId);
    expect(
      await ws.commitImport(s.user, check.draftId, check.revision),
    ).toMatchObject({ outcome: "committed", importId: d.draftId });
    expect(
      await ws.commitImport(s.user, check.draftId, check.revision),
    ).toMatchObject({ outcome: "already_committed", importId: d.draftId });
    expect(await s.active()).toBeNull();
    expect(
      (
        await admin(
          "SELECT count(*)::int AS n FROM cgt.transactions WHERE account_id=$1",
          [a.id],
        )
      ).rows[0],
    ).toEqual({ n: 2 });
    expect(
      (
        await admin(
          "SELECT verified_records FROM cgt.receipt_revalidations WHERE import_id=$1",
          [d.draftId],
        )
      ).rows[0],
    ).toMatchObject({
      verified_records: [
        { status: "duplicate" },
        { status: "duplicate" },
        { status: "excluded", cashFields: { Action: "Interest on cash" } },
      ],
    });
  });

  it.each([
    ["trading212-gbp", "trading212-invest-21-gbp-v1"],
    ["trading212-gbp", "trading212-invest-21-gbp-v2"],
    ["trading212-2026-gbp", "trading212-invest-33-v1"],
    ["trading212-2026-gbp", "trading212-invest-33-v2"],
  ])("checks the actual excluded dividend evidence for %s in %s", async (file, parser) => {
    const s = await setup("retained-dividend-" + parser);
    const a = await s.account("Invest");
    const [buy, sell] = fixtureRows(brokerCases.find(c => c.file === file)!);
    const time = file === "trading212-gbp" ? "Time" : "Time (UTC)";
    const timestamp = time === "Time" ? "2024-06-05 23:30:00"
      : parser.endsWith("-v1") ? "2024-06-05 23:30:00+00:00" : "2024-06-05T23:30:00Z";
    const distribution: Record<string, string> = {
      ...Object.fromEntries(Object.keys(buy!).map(k => [k, ""])),
      Action: "Dividend (Dividend)", ID: "DIST-007", [time]: timestamp,
      "No. of shares": "100", "Price / share": "0.05", "Currency (Price / share)": "GBP",
      "Withholding tax": "0.75", "Currency (Withholding tax)": "GBP", Total: "4.25", "Currency (Total)": "GBP",
    };
    const good = Papa.unparse([buy!, sell!, distribution]);
    const receipt = await s.preview(a.id, good, "native");
    expect(receipt.review.counts).toMatchObject({accepted: 2, excluded: 1});
    await ws.commitImport(s.user, receipt.draftId, receipt.revision);
    await admin("UPDATE cgt.imports SET parser_version=$2 WHERE id=$1", [receipt.draftId, parser]);
    const verifiedOldFile = parser.endsWith("-v1");
    if (verifiedOldFile) {
      await admin("UPDATE cgt.imports SET record_receipts=record_receipts #- '{2,cashFields}' WHERE id=$1", [receipt.draftId]);
      expect(await s.active()).toContain("identical original file");
      const replay = await s.preview(a.id, good, "native");
      expect(replay.review.revalidatesReceiptId).toBe(receipt.draftId);
      await ws.commitImport(s.user, replay.draftId, replay.revision);
    }
    expect(await s.active()).toBeNull();

    const inputs = {
      portfolioId: s.portfolio.id, taxYear: "2024-25", historyThrough: "2025-05-05",
      confirmedAccountIds: [a.id], personalScopeConfirmed: true, scopeDeclaration: CURRENT_SCOPE_DECLARATION,
    };
    const published = await ws.calculate(s.user, inputs);
    expect((await ws.reportSnapshot(s.user, published.runId, "evidence")).result.status).toBe("complete");
    const bad = Papa.unparse([buy!, sell!, {...distribution, Total: "5.00"}]);
    const badDigest = reviewCsv(bad, {...cfg, broker: "trading212"}).fileDigest;
    await admin("UPDATE cgt.imports SET file_digest=$2 WHERE id=$1", [receipt.draftId, badDigest]);
    // Simulate the row previously accepted by the permissive dividend rule.
    // These are the actual two historical storage layouts.
    if (verifiedOldFile) {
      await admin(`UPDATE cgt.receipt_revalidations SET verified_records=jsonb_set(verified_records,
        '{2,cashFields,Total}','"5.00"') WHERE import_id=$1`, [receipt.draftId]);
    } else {
      await admin(`UPDATE cgt.imports SET record_receipts=jsonb_set(record_receipts,
        '{2,cashFields,Total}','"5.00"') WHERE id=$1`, [receipt.draftId]);
    }
    const atDate = (through: string) => owner.run(s.user, tx => activeImportIssue(tx, s.portfolio.id, through));
    expect(await atDate("2024-06-05")).toBeNull();
    const issue = await atDate("2024-06-06");
    expect(issue).toContain(receipt.draftId);
    expect(issue).toMatch(/row 4.*original statement.*Reverse this receipt/i);
    await expect(ws.calculate(s.user, inputs)).rejects.toMatchObject({code: "IMPORT_REVIEW_REQUIRED"});
    for (const kind of ["csv", "summary", "evidence"] as const)
      await expect(ws.reportSnapshot(s.user, published.runId, kind)).rejects.toMatchObject({code: "REPORT_UNAVAILABLE", message: issue});
    const rejected = await s.preview(a.id, bad, "native");
    expect(rejected.review.status).toBe("needs_review");
    expect(rejected.review.revalidatesReceiptId).toBeUndefined();
    expect((await ws.commitImport(s.user, rejected.draftId, rejected.revision)).outcome).toBe("needs_review");
    expect(await s.active()).toBe(issue);
    await ws.reverseImport(s.user, receipt.draftId, "Replacing verified original trade and dividend evidence");
    expect(await s.active()).toBeNull();
    const replacement = await s.preview(a.id, good, "native");
    expect(replacement.review.counts).toMatchObject({accepted: 2, excluded: 1});
    await ws.commitImport(s.user, replacement.draftId, replacement.revision);
    expect(await s.active()).toBeNull();
  });

  it("holds old ambiguous same-file duplicates and leaves a genuine cumulative receipt eligible", async () => {
    const s = await setup("historical-fills"),
      a = await s.account("Original");
    const old = await s.preview(
      a.id,
      canonical([issueTrade("x"), issueTrade("y")]),
      "canonical-v1",
    );
    await ws.commitImport(s.user, old.draftId, old.revision);
    const next = await s.preview(
      a.id,
      canonical([issueTrade("y"), issueTrade("z")]),
      "canonical-v1",
    );
    await ws.commitImport(s.user, next.draftId, next.revision);
    await admin(
      "UPDATE cgt.imports SET parser_version='canonical-v1.1.0' WHERE id=$1",
      [next.draftId],
    );
    expect(await s.active()).toBeNull();
    await admin(
      `UPDATE cgt.imports SET record_receipts=record_receipts || jsonb_build_array(record_receipts->0),
      record_count=record_count+1, duplicate_count=duplicate_count+1 WHERE id=$1`,
      [next.draftId],
    );
    expect(await s.active()).toContain(next.draftId);
  });

  it("compares foreign broker consideration and rate as well as the settled sterling fields", async () => {
    const s = await setup("mixed-foreign", "freetrade"),
      a = await s.account("Freetrade");
    const c = brokerCases.find((x) => x.file === "freetrade-fx-fees")!;
    const first = await s.preview(
      a.id,
      Papa.unparse([fixtureRows(c)[0]!]),
      "native",
    );
    const prepared = await ws.supplyImportDetails(
      s.user,
      first.draftId,
      2,
      fixtureDetails(c)["2"]!,
      first.reviewVersion,
    );
    expect(
      (
        await ws.commitImport(
          s.user,
          first.draftId,
          prepared.revision,
          prepared.reviewVersion,
        )
      ).outcome,
    ).toBe("committed");
    const row = [
      "SYNTHETIC-F-001",
      "2024-06-01",
      "BUY",
      "US0378331005",
      "100",
      "1250",
      "5.625",
      "USD",
      "0.8",
      "ORDINARY_SHARE",
    ];
    expect(
      (await s.preview(a.id, canonical([row]), "canonical-v1")).review.counts
        .duplicate,
    ).toBe(1);
    expect(
      (
        await s.preview(
          a.id,
          canonical([row.with(5, "1000").with(6, "4.5").with(8, "1")]),
          "canonical-v1",
        )
      ).review.issues[0]?.message,
    ).toContain("exchange rate");
  });

  const comparable = brokerCases.filter((c) =>
    [
      "trading212-gbp",
      "freetrade-gbp",
      "hl-assisted",
      "ii-assisted",
      "ajbell-history-gbp",
    ].includes(c.file),
  );
  it.each(
    comparable.flatMap((c) =>
      (["native", "canonical-v1"] as const).map((first) => ({ c, first })),
    ),
  )(
    "recognises evidenced $c.broker overlap with $first first and identifies changed fee fields",
    async ({ c, first }) => {
      const s = await setup("mixed-" + c.broker + "-" + first, c.broker),
        a = await s.account("Same account");
      const buy = syntheticTrade(c, {
        id: "70021",
        date: "2024-06-01",
        side: "BUY",
        quantity: "2",
        price: "1",
        gross: "2",
        fees: "0",
        net: "2",
      });
      const id = c.broker === "hl" ? buy.row.Reference! : "70021";
      const native = Papa.unparse([buy.row]),
        templ = canonical([issueTrade(id).with(5, "2")]);
      const review = async (format: "native" | "canonical-v1") => {
        const d = await s.preview(
          a.id,
          format === "native" ? native : templ,
          format,
        );
        if (format === "native" && ["ajbell", "hl", "ii"].includes(c.broker)) {
          const updated = await ws.supplyImportDetails(
            s.user,
            d.draftId,
            2,
            buy.details,
            d.reviewVersion,
          );
          return { ...d, ...updated };
        }
        return d;
      };
      const d = await review(first);
      expect(
        (await ws.commitImport(s.user, d.draftId, d.revision, d.reviewVersion))
          .outcome,
      ).toBe("committed");
      const next = await review(first === "native" ? "canonical-v1" : "native");
      expect(next.review.counts.duplicate).toBe(1);
      if (first === "native")
        expect(
          (
            await s.preview(
              a.id,
              canonical([issueTrade(id).with(5, "2").with(6, "1")]),
              "canonical-v1",
            )
          ).review.issues[0]?.message,
        ).toContain("GBP fees");
    },
  );
});
