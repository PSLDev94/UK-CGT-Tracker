import {
  LineCapStyle,
  PageSizes,
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { RGB } from "pdf-lib";
import { BROKERS } from "../imports/brokers";
import { Money } from "../values";
import { money } from "../../ui/format";
import { reportStructure } from "./pdf-structure";
import { sampleReport } from "./sample";

const ink = rgb(17 / 255, 24 / 255, 39 / 255);
const blue = rgb(37 / 255, 99 / 255, 235 / 255);
const muted = rgb(0.29, 0.33, 0.39);
const rule = rgb(0.81, 0.84, 0.87);
const loss = rgb(0.6, 0.17, 0.17);
const white = rgb(1, 1, 1);
const left = 44;
const right = PageSizes.A4[0] - left;
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const date = (value: string | Date) => shortDate.format(new Date(value));
const ruleName = {
  SAME_DAY: "Same-day rule",
  THIRTY_DAY: "30-day rule",
  SECTION_104: "Section 104 pool",
};

function sterling(value: string | null | undefined, signed = false) {
  if (value == null)
    throw new Error(
      "The illustrative statement requires a complete saved amount.",
    );
  // The PDF's standard typeface uses the WinAnsi hyphen for a negative sign.
  return (
    (signed && new Money(value).greaterThan(0) ? "+" : "") +
    money(value).replace("−", "-")
  );
}

type Style = {
  size?: number;
  bold?: boolean;
  color?: RGB;
  rightAligned?: boolean;
};

/** Review-only annual statement and matching evidence for the public, synthetic portfolio. */
export async function designPreviewPdf(): Promise<Uint8Array> {
  const { result, sources, accounts, id, created_at } = sampleReport;
  const { saleBreakdown, summary } = result;
  if (!summary || !saleBreakdown || !accounts?.length || !sources?.length)
    throw new Error(
      "The illustrative account and its calculation must be available.",
    );

  const sourceIndex = new Map(sources.map((item) => [item.key, item]));
  function source(key: string) {
    const found = sourceIndex.get(key);
    if (!found?.reference || !found.statementReference)
      throw new Error(
        "The illustrative trade must have a broker reference and contract note.",
      );
    return found;
  }
  const account = accounts[0]!;
  const broker =
    BROKERS.find((b) => b.id === account.broker)?.name ?? account.broker;
  const receipt = sources[0]!.importReference!;
  const movements = result.poolMovements ?? [];
  const disposals = result.disposals.map((disposal) => {
    const sale = source(disposal.sourceIds[0]!);
    const name = sale.instrument!;
    const match = disposal.matches[0]!;
    const poolPurchases = movements.filter(
      (m) =>
        m.securityId === disposal.securityId &&
        m.kind === "acquisition" &&
        m.date <= disposal.date,
    );
    let explanation = "The purchase and sale took place on the same day.";
    if (match.rule === "SECTION_104") {
      const unitCost = new Money(match.costGBP).dividedBy(match.quantity);
      explanation =
        "These shares came from the pool at an average cost of " +
        sterling(unitCost.toString()) +
        " per share.";
    } else if (match.rule === "THIRTY_DAY") {
      const days =
        (Date.parse(match.acquisitionDate!) - Date.parse(disposal.date)) /
        86_400_000;
      explanation =
        "The repurchase " +
        days +
        " days later supplies the cost. The earlier " +
        sterling(poolPurchases[0]!.costChangeGBP) +
        " stays in the pool.";
    }
    const records = [
      ...disposal.sourceIds.map((key) => ({
        record: source(key),
        when: disposal.date,
        role: "Sale",
      })),
      ...(match.acquisitionIds ?? []).map((key) => ({
        record: source(key),
        when: match.acquisitionDate!,
        role: "Matched buy",
      })),
      ...poolPurchases.flatMap((m) =>
        m.sourceIds.map((key) => ({
          record: source(key),
          when: m.date,
          role:
            match.rule === "SECTION_104" ? "Pool purchase" : "Retained in pool",
        })),
      ),
    ];
    return { disposal, name, match, records, explanation };
  });

  const doc = await PDFDocument.create();
  doc.setAuthor("CGT Tracker");
  doc.setTitle(
    `CGT Tracker | ${result.taxYear} illustrative capital gains statement`,
    { showInWindowTitleBar: true },
  );
  doc.setSubject(
    "Annual result, account coverage and source records for an illustrative share portfolio",
  );
  doc.setLanguage("en-GB");
  doc.setCreationDate(new Date(created_at));
  doc.setModificationDate(new Date(created_at));
  const tags = reportStructure(doc);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const summaryPage = doc.addPage(PageSizes.A4);
  const evidencePage = doc.addPage(PageSizes.A4);
  let page = summaryPage;
  const y = (top: number) => page.getHeight() - top;
  type Tag = ReturnType<typeof tags.element>;

  function drawText(value: string, x: number, top: number, style: Style) {
    const font = style.bold ? bold : regular;
    const size = style.size ?? 10.5;
    const at = style.rightAligned ? x - font.widthOfTextAtSize(value, size) : x;
    page.drawText(value, {
      x: at,
      y: y(top),
      font,
      size,
      color: style.color ?? ink,
    });
  }
  function text(
    value: string,
    x: number,
    top: number,
    style: Style = {},
    tag?: Tag,
  ) {
    tags.mark(page, tag ?? tags.element("P", tags.document), () =>
      drawText(value, x, top, style),
    );
  }
  function line(top: number, x1 = left, x2 = right, color = rule) {
    tags.artifact(page, () =>
      page.drawLine({
        start: { x: x1, y: y(top) },
        end: { x: x2, y: y(top) },
        thickness: 0.65,
        color,
      }),
    );
  }
  function heading(value: string, top: number, main = false) {
    tags.bookmark(value, page, y(top) + 22);
    text(
      value,
      left,
      top,
      { size: main ? 29 : 16, bold: true },
      tags.element(main ? "H1" : "H2", tags.document),
    );
  }
  function frame(pageNumber: number) {
    tags.artifact(page, () => {
      // Match the original square and both pie paths in public/logo.svg.
      const scale = 0.78;
      page.drawSvgPath(
        "M8 0H24A8 8 0 0 1 32 8V24A8 8 0 0 1 24 32H8A8 8 0 0 1 0 24V8A8 8 0 0 1 8 0Z",
        { x: left, y: y(35), scale, color: blue },
      );
      page.drawSvgPath(
        "M21.21 15.89A10 10 0 1 1 8 2.83 M22 12A10 10 0 0 0 12 2v10z",
        {
          x: left + 4 * scale,
          y: y(35 + 4 * scale),
          scale,
          borderColor: white,
          borderWidth: 2.5,
          borderLineCap: LineCapStyle.Round,
        },
      );
      drawText("CGT", left + 31, 53, { size: 18, bold: true });
      drawText("Tracker", left + 31 + bold.widthOfTextAtSize("CGT", 18), 53, {
        size: 18,
        bold: true,
        color: blue,
      });
      drawText("Illustrative portfolio", right, 51, {
        size: 10,
        color: muted,
        rightAligned: true,
      });
      drawText("CGT Tracker  /  " + id, left, 805, { size: 9.5, color: muted });
      drawText(`Page ${pageNumber} of 2`, right, 805, {
        size: 9.5,
        rightAligned: true,
        color: muted,
      });
    });
    line(75);
    line(783);
  }

  frame(1);
  heading("Capital gains statement", 120, true);
  text("Tax year " + result.taxYear + "   /   Ordinary shares", left, 146, {
    size: 13,
    color: muted,
  });

  text(
    "Annual net gain",
    left,
    200,
    { size: 16, bold: true },
    tags.element("H2", tags.document),
  );
  text(sterling(summary.netGainGBP, true), left, 249, { size: 46, bold: true });
  text("Before personal allowances and tax", left, 274, {
    size: 11,
    color: muted,
  });
  text("Gains on sales", 367, 211, { color: muted });
  text(sterling(summary.gainsGBP), right, 211, {
    rightAligned: true,
    bold: true,
  });
  text("Losses on sales", 367, 239, { color: muted });
  text(
    sterling(new Money(summary.lossesGBP).negated().toString()),
    right,
    239,
    { rightAligned: true, bold: true, color: loss },
  );
  line(300);

  heading("Sales in this tax year", 333);
  const ledger = tags.element("Table", tags.document);
  const columns = [left, 206, 301, right];
  function ledgerRow(
    values: string[],
    top: number,
    header = false,
    negative = false,
  ) {
    const row = tags.element("TR", ledger);
    values.forEach((value, i) =>
      text(
        value,
        columns[i]!,
        top,
        {
          size: header ? 9.5 : 11,
          bold: !header && (i === 0 || i === 3),
          rightAligned: i === 3,
          color: header ? muted : negative && i === 3 ? loss : ink,
        },
        tags.element(header ? "TH" : "TD", row),
      ),
    );
  }
  ledgerRow(
    ["Company", "Date sold", "Matching rule", "Gain / loss"],
    363,
    true,
  );
  line(373);
  disposals.forEach(({ disposal, name, match }, i) => {
    const top = 397 + 34 * i;
    const negative = new Money(disposal.gainGBP!).isNegative();
    ledgerRow(
      [
        name,
        date(disposal.date),
        ruleName[match.rule],
        sterling(disposal.gainGBP, true),
      ],
      top,
      false,
      negative,
    );
    line(top + 10);
  });
  text("Each sale is matched to its supporting records on page 2.", left, 500, {
    color: muted,
  });

  heading("Annual proceeds and costs", 547);
  const totals = [
    ["Gross disposal proceeds", saleBreakdown.grossProceedsGBP],
    ["Selling costs", saleBreakdown.sellingCostsGBP],
    ["Net sale proceeds", summary.proceedsGBP],
    ["Matched acquisition cost", summary.allowableCostsGBP],
    [
      "Total allowable costs, including selling costs",
      saleBreakdown.totalAllowableCostsGBP,
    ],
  ] as const;
  // Each labelled value belongs to the same logical row when read as text.
  totals.forEach(([label, value], i) => {
    const top = 572 + 19 * i;
    const row = tags.element("P", tags.document);
    const strong = i === totals.length - 1;
    text(label, left, top, { bold: strong }, row);
    text(
      sterling(value),
      right,
      top,
      { bold: strong, rightAligned: true },
      row,
    );
  });
  line(664);
  heading("Account coverage", 693);
  text(broker + "  /  " + account.label, left, 714);
  text(
    "History confirmed through " +
      date(result.historyThrough) +
      ". Saved " +
      date(created_at) +
      ".",
    left,
    732,
    { color: muted },
  );
  text(
    "Check your account history and supporting records before using a figure for filing.",
    left,
    756,
    { size: 10, color: muted },
  );

  page = evidencePage;
  frame(2);
  heading("Disposal evidence", 120, true);
  text(
    "Tax year " + result.taxYear + "   /   " + broker + "   /   " + receipt,
    left,
    146,
    { size: 12, color: muted },
  );

  let top = 196;
  for (const { disposal, name, match, records, explanation } of disposals) {
    const negative = new Money(disposal.gainGBP!).isNegative();
    const outcome = negative ? "loss" : "gain";
    tags.bookmark(name + " - " + ruleName[match.rule], page, y(top) + 20);
    text(
      name,
      left,
      top,
      { size: 19, bold: true },
      tags.element("H2", tags.document),
    );
    text(sterling(disposal.gainGBP, true) + " " + outcome, right, top, {
      size: 17,
      bold: true,
      color: negative ? loss : ink,
      rightAligned: true,
    });
    text(
      new Intl.NumberFormat("en-GB").format(Number(disposal.quantity)) +
        " shares  /  " +
        disposal.securityId +
        "  /  " +
        ruleName[match.rule],
      left,
      top + 22,
      { size: 10.5, color: muted },
    );
    const sale = disposal.saleBreakdown!;
    const arithmetic =
      sterling(sale.grossProceedsGBP) +
      " gross proceeds less " +
      sterling(sale.totalAllowableCostsGBP) +
      " total allowable costs.";
    text(arithmetic, left, top + 47);
    text(
      "Allowable costs include " +
        sterling(disposal.allowableCostGBP) +
        " matched cost and " +
        sterling(sale.sellingCostsGBP) +
        " selling costs.",
      left,
      top + 64,
      { size: 10, color: muted },
    );
    text(explanation, left, top + 80, { size: 10 });
    const table = tags.element("Table", tags.document);
    const tracks = [left, 150, 239, 361, 397];
    function evidenceRow(values: string[], at: number, header = false) {
      const row = tags.element("TR", table);
      values.forEach((value, i) =>
        text(
          value,
          tracks[i]!,
          at,
          {
            size: header ? 9 : 9.5,
            bold: header,
            color: header ? muted : ink,
            rightAligned: i === 3,
          },
          tags.element(header ? "TH" : "TD", row),
        ),
      );
    }
    evidenceRow(
      ["Record", "Trade date", "Broker reference", "File row", "Contract note"],
      top + 103,
      true,
    );
    line(top + 111);
    records.forEach(({ role, when, record }, i) =>
      evidenceRow(
        [
          role,
          date(when),
          record.reference!,
          String(record.record),
          record.statementReference!,
        ],
        top + 126 + i * 17,
      ),
    );
    top += 162 + (records.length - 1) * 17;
  }
  text(
    "File rows refer to the original broker export. Amounts are rounded to the nearest penny.",
    left,
    754,
    { size: 10, color: muted },
  );

  tags.finish();
  return doc.save();
}
