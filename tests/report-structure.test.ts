import { expect, it } from "vitest";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
} from "pdf-lib";
import { calculateGains } from "../src/domain/cgt/calculate";
import { reportPdf } from "../src/domain/reports/pdf";
import { reportPageText } from "./helpers/pdf-text";

const key = PDFName.of;
const result = calculateGains(
  [
    {
      id: "b",
      date: "2024-04-01",
      securityId: "GB0008706128",
      side: "BUY",
      quantity: "1",
      considerationGBP: "60",
      feesGBP: "2",
    },
    {
      id: "s",
      date: "2024-06-01",
      securityId: "GB0008706128",
      side: "SELL",
      quantity: "1",
      considerationGBP: "100",
      feesGBP: "5",
    },
  ],
  { taxYear: "2024-25", historyThrough: "2025-05-05" },
);
const saved = {
  id: "test",
  input_digest: "test",
  created_at: "2025-05-06",
  coverage_confirmed: true,
  result,
  sources: [
    {
      key: "s",
      label: "Share account",
      broker: "ajbell",
      record: 2,
      instrument: null,
      reference: "EXEC-1",
      importReference: "file-2",
    },
  ],
};

it.each([false, true])(
  "connects PDF headings, fee tables and bookmarks to rendered pages (evidence %s)",
  async (evidence) => {
    const pdf = await PDFDocument.load(await reportPdf(saved, evidence));
    const tree = pdf.catalog.lookup(key("StructTreeRoot"), PDFDict);
    const document = tree.lookup(key("K"), PDFDict);
    const sections = document
      .lookup(key("K"), PDFArray)
      .asArray()
      .map((ref) => pdf.context.lookup(ref, PDFDict));
    const role = (node: PDFDict) => node.lookup(key("S"), PDFName).decodeText();
    expect(role(document)).toBe("Document");
    expect(role(sections[0]!)).toBe("H1");
    expect(sections.filter((s) => role(s) === "H2").length).toBeGreaterThan(2);
    expect(sections.some((s) => role(s) === "H3")).toBe(evidence);
    const numbers = tree
      .lookup(key("ParentTree"), PDFDict)
      .lookup(key("Nums"), PDFArray);
    const pages = pdf.getPages();
    for (const table of sections.filter((s) => role(s) === "Table")) {
      const rows = table
        .lookup(key("K"), PDFArray)
        .asArray()
        .map((ref) => pdf.context.lookup(ref, PDFDict));
      expect(rows.map(role)).toEqual(["TR", "TR"]);
      const columns = rows[0]!.lookup(key("K"), PDFArray);
      expect(columns.size()).toBe(rows[1]!.lookup(key("K"), PDFArray).size());
      expect(columns.size()).toBeGreaterThan(1);
      for (const [rowIndex, row] of rows.entries()) {
        for (const cellRef of row.lookup(key("K"), PDFArray).asArray()) {
          const cell = pdf.context.lookup(cellRef, PDFDict);
          expect(role(cell)).toBe(rowIndex === 0 ? "TH" : "TD");
          if (rowIndex === 0)
            expect(
              cell
                .lookup(key("A"), PDFDict)
                .lookup(key("Scope"), PDFName)
                .decodeText(),
            ).toBe("Column");
          const content = cell.lookup(key("K"), PDFArray).lookup(0, PDFDict);
          const page = pages.find(
            (page) => page.ref === content.get(key("Pg")),
          )!;
          const pageKey = page.node
            .lookup(key("StructParents"), PDFNumber)
            .asNumber();
          const parents = numbers.lookup(2 * pageKey + 1, PDFArray);
          const mcid = content.lookup(key("MCID"), PDFNumber).asNumber();
          expect(parents.get(mcid)).toBe(cellRef);
        }
      }
    }
    const outline = pdf.catalog.lookup(key("Outlines"), PDFDict);
    let entry = outline.lookup(key("First"), PDFDict);
    const titles = [];
    for (;;) {
      const dest = entry.lookup(key("Dest"), PDFArray);
      expect(pages.map((page) => page.ref)).toContain(dest.get(0));
      titles.push(entry.lookup(key("Title"), PDFHexString).decodeText());
      if (!entry.has(key("Next"))) break;
      entry = entry.lookup(key("Next"), PDFDict);
    }
    expect(titles).toContain("Account coverage");
    expect(titles.includes("Transaction references")).toBe(evidence);
    expect(outline.get(key("First"))).toBeInstanceOf(PDFRef);
    const text = reportPageText(pdf);
    expect(text).toContain(
      "Gross disposal proceeds\n£100.00\nSelling costs\n£5.00\nNet sale proceeds\n£95.00",
    );
    expect(text).toContain(
      "Matched acquisition cost\n£62.00\nTotal allowable costs\n£67.00",
    );
    expect(text).toContain("Net gain  £33.00");
    if (evidence) expect(text).toContain("Import reference: file-2");
  },
);

it("explains missing sale information in older snapshots without inferring a zero fee", async () => {
  const legacy = {
    ...result,
    saleBreakdown: undefined,
    disposals: result.disposals.map((d) => ({
      ...d,
      saleBreakdown: undefined,
    })),
  };
  for (const evidence of [false, true]) {
    const text = reportPageText(
      await PDFDocument.load(
        await reportPdf({ ...saved, result: legacy }, evidence),
      ),
    );
    expect(text).toContain(
      "Net sale proceeds\n£95.00\nMatched acquisition cost\n£62.00",
    );
    expect(text).toContain(
      "Gross disposal proceeds, selling costs and total allowable costs are unavailable",
    );
    expect(text).not.toContain("Selling costs\n£0.00");
  }
});

it("keeps the pool history heading with its first movement at page boundaries", async () => {
  for (const count of [1, 6, 12, 18, 24]) {
    const pdf = await PDFDocument.load(
      await reportPdf(
        {
          ...saved,
          accounts: Array.from({ length: count }, (_, i) => ({
            label: "Account " + i,
            broker: "hl",
            confirmed: true,
          })),
        },
        true,
      ),
    );
    const pages = pdf.getPages().map((_, index) => reportPageText(pdf, index));
    const firstHistoryPage = pages.find((page) =>
      page.split("\n").includes("Section 104 pool movements"),
    );
    expect(firstHistoryPage).toContain("Prior-year history · 1 April 2024");
    expect(firstHistoryPage).toContain("Balance: 1 share · cost £62");
  }
});
