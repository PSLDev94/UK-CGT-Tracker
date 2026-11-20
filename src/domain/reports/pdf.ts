import { adjustment2024Note, confirmedRatePeriods, filingReview, ratePeriodsNote } from "./filing-guidance";
import { noDisposalsLabel, reportIssueMessage, scopeStatement, unresolvedPoolIssues } from "./eligibility";
import { LineCapStyle, PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { annualRoundingNote, componentRoundingNotes, roundingComparisonLabel, roundingDifferences } from "./rounding";
import { Money, netOutcome } from "../values";
import { reportStructure } from "./pdf-structure";
import { saleBreakdownUnavailable, type SaleBreakdown } from "../cgt/types";
import { BROKERS } from "../imports/brokers";
import {
  reportStatus,
  statementSaleLimit,
  type ReportSnapshot,
} from "./report";

const humanDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});
const date = (value: string | Date) => humanDate.format(new Date(value));
const pounds = (value: string) => {
  const [whole, fraction] = value.replace(/^-/, "").split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (value.startsWith("-") ? "-£" : "£") + grouped + (fraction === undefined ? "" : "." + fraction);
};
const shares = (quantity: string) =>
  `${quantity} ${quantity === "1" || quantity === "-1" ? "share" : "shares"}`;
// Only narrative values are shortened. The CSV retains the full matching ledger.
function narrativeCost(value: string) {
  const amount = new Money(value);
  if (amount.decimalPlaces() <= 2) return pounds(value);
  if (amount.abs().lessThan("0.01"))
    return amount.isNegative() ? "between -£0.01 and £0" : "less than £0.01";
  return pounds(amount.toFixed(2));
}
const rules = {
  SAME_DAY: "Same day",
  THIRTY_DAY: "30-day rule",
  SECTION_104: "Section 104 pool",
} as const;

/** Selectable, paginated evidence rendered from the stored calculation. */
export async function reportPdf(
  snapshot: ReportSnapshot,
  evidence = false,
  { sample = false }: { sample?: boolean } = {},
): Promise<Uint8Array> {
  const r = snapshot.result;
  const doc = await PDFDocument.create();
  const tags = reportStructure(doc);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const glyphs = new Set(regular.getCharacterSet());
  // Keep references printable on any device. Marked-content ActualText preserves
  // the original Unicode when copied/extracted, even for glyphs outside WinAnsi.
  let escapedText = false;
  function printableChar(char: string) {
    if (char === "\\") return "\\\\";
    const code = char.codePointAt(0)!;
    return glyphs.has(code) ? char : "\\u{" + code.toString(16).toUpperCase() + "}";
  }
  const title = evidence ? "Calculation evidence" : "Capital gains statement";
  doc.setTitle(
    `CGT Tracker - ${sample ? "Synthetic sample - " : ""}${title} ${r.taxYear}`,
    { showInWindowTitleBar: true },
  );
  if (sample) {
    doc.setCreationDate(new Date(snapshot.created_at));
    doc.setModificationDate(new Date(snapshot.created_at));
  }
  doc.setAuthor("CGT Tracker");
  doc.setLanguage("en-GB");
  const ink = rgb(0.067, 0.094, 0.153),
    blue = rgb(37 / 255, 99 / 255, 235 / 255),
    muted = rgb(0.25, 0.3, 0.37),
    border = rgb(0.84, 0.87, 0.9);
  let page = doc.addPage([595.28, 841.89]);
  let y = 0;
  let continuedSection = "";
  const left = 44,
    right = 551;
  function header() {
    // The two pie paths and blue square are the vector mark in public/logo.svg.
    const scale = 0.65;
    page.drawSvgPath("M8 0H24A8 8 0 0 1 32 8V24A8 8 0 0 1 24 32H8A8 8 0 0 1 0 24V8A8 8 0 0 1 8 0Z", {
      x: left, y: 817, scale, color: blue,
    });
    page.drawSvgPath("M21.21 15.89A10 10 0 1 1 8 2.83 M22 12A10 10 0 0 0 12 2v10z", {
      x: left + 4 * scale, y: 817 - 4 * scale, scale,
      borderColor: rgb(1, 1, 1), borderWidth: 2.5, borderLineCap: LineCapStyle.Round,
    });
    const wordmarkX = left + 26;
    page.drawText("CGT", { x: wordmarkX, y: 801, size: 15, font: bold, color: ink });
    page.drawText("Tracker", {
      x: wordmarkX + bold.widthOfTextAtSize("CGT", 15), y: 801, size: 15, font: bold, color: blue,
    });
    const label = `${sample ? "Sample portfolio  /  " : ""}${r.taxYear}  /  ${evidence ? title : "Annual statement"}`;
    page.drawText(label, {
      x: right - regular.widthOfTextAtSize(label, 9),
      y: 803,
      size: 9,
      font: regular,
      color: muted,
    });
    page.drawLine({
      start: { x: left, y: 787 },
      end: { x: right, y: 787 },
      thickness: 0.75,
      color: border,
    });
    y = 750;
  }
  tags.artifact(page, header);
  const sources = new Map(
    snapshot.sources?.map((source) => [source.key, source]),
  );
  function space(height: number) {
    if (y - height < 50) {
      page = doc.addPage([595.28, 841.89]);
      tags.artifact(page, () => {
        header();
        if (continuedSection) {
          page.drawText(continuedSection + " (continued)", {
            x: left,
            y,
            size: 10,
            font: bold,
            color: muted,
          });
          y -= 22;
        }
      });
    }
  }
  function wrap(text: string, font: typeof regular, size: number) {
    const lines: { printed: string; original: string }[] = [];
    let printed = "", original = "", width = 0;
    function flush() {
      lines.push({ printed: printed.replace(/ +$/, ""), original: original.replace(/ +$/, "") });
      printed = "";
      original = "";
      width = 0;
    }
    for (const word of text.split(/( +)/)) {
      if (!word || (!printed && /^ +$/.test(word))) continue;
      const encoded = Array.from(word, printableChar).join("");
      const w = font.widthOfTextAtSize(encoded, size);
      if (w <= right - left) {
        if (width + w > right - left && printed) flush();
        if (!printed && /^ +$/.test(word)) continue;
        printed += encoded;
        original += word;
        width += w;
      } else {
        for (const char of word) {
          const chunk = printableChar(char);
          const cw = font.widthOfTextAtSize(chunk, size);
          if (width + cw > right - left && printed) flush();
          printed += chunk;
          original += char;
          width += cw;
        }
      }
    }
    if (printed) flush();
    return lines;
  }
  function line(
    text: string,
    strong = false,
    size = 10,
    color = ink,
    role: "P" | "H1" | "H2" | "H3" = "P",
  ) {
    const font = role === "H1" || role === "H2" ? serif : strong ? bold : regular;
    const item = tags.element(role, tags.document);
    for (const { printed, original } of wrap(text, font, size)) {
      if (printed !== original) escapedText = true;
      space(size + 5);
      tags.mark(page, item, () =>
        page.drawText(printed, { x: left, y, size, font, color }),
        printed !== original ? original : undefined,
      );
      y -= size + 5;
    }
  }
  const references = new Map<string, { id: string; role: string }>();
  function sourceIds(keys: string[], role: string) {
    return keys
      .map((key) => {
        const existing = references.get(key);
        if (existing) return existing.id;
        const id = `T${references.size + 1}`;
        references.set(key, { id, role });
        return id;
      })
      .join(", ");
  }
  function sourceLine(key: string, id: string, role: string) {
    const source = sources.get(key);
    const entries: { text: string; size: number }[] = [];
    if (source) {
      const broker =
        BROKERS.find((b) => b.id === source.broker)?.name ?? source.broker;
      entries.push({
        text: `${id} · ${role} · ${broker} · ${source.label} · file row ${source.record}`,
        size: 9,
      });
      if (source.reference)
        entries.push({
          text: `Execution reference: ${source.reference}`,
          size: 9,
        });
      if (source.statementReference)
        entries.push({
          text: `Statement reference: ${source.statementReference}`,
          size: 9,
        });
      if (source.importReference)
        entries.push({
          text: `Import reference: ${source.importReference}`,
          size: 8,
        });
      if (source.conversion) {
        const fx = source.conversion;
        entries.push({
          text: `Currency conversion: ${fx.currency} ${fx.consideration} consideration and ${fx.fees} fees at GBP ${fx.gbpPerUnit} per ${fx.currency}. Converted consideration £${fx.considerationGBP} and fees £${fx.feesGBP}.`,
          size: 9,
        });
      }
      if (source.sterlingSettlement) {
        const trade = source.sterlingSettlement;
        entries.push({
          text: `${shares(trade.quantity)} at ${trade.instrumentCurrency} ${trade.price} per share. Verified rate GBP ${trade.gbpPerUnit} per ${trade.instrumentCurrency}. Settled consideration £${trade.considerationGBP} and fees £${trade.feesGBP}.`,
          size: 9,
        });
      }
      entries.push({ text: `Trace reference: ${key}`, size: 8 });
    } else {
      entries.push({
        text: `${id} · ${role} · trace reference: ${key}`,
        size: 8,
      });
    }
    const height = entries.reduce(
      (total, entry, index) =>
        total + wrap(entry.text, index === 0 ? bold : regular, entry.size).length * (entry.size + 5),
      0,
    );
    space(Math.min(712, height + 11));
    tags.artifact(page, () => page.drawLine({
      start: { x: left, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 0.45, color: border,
    }));
    y -= 6;
    for (const [index, entry] of entries.entries())
      line(entry.text, index === 0, entry.size, entry.size < 9 ? muted : ink);
    y -= 5;
  }
  function heading(text: string, reserve = 48) {
    continuedSection = "";
    space(reserve);
    y -= 8;
    tags.bookmark(text, page, y + 16);
    line(text, true, 17, ink, "H2");
    continuedSection = text;
  }
  function amounts(labels: string[], values: string[]) {
    const col = (right - left) / labels.length;
    space(41);
    tags.artifact(page, () =>
      page.drawLine({ start: { x: left, y: y + 12 }, end: { x: right, y: y + 12 }, thickness: 0.55, color: border }),
    );
    const table = tags.element("Table", tags.document);
    const labelRow = tags.element("TR", table);
    const dataRow = tags.element("TR", table);
    labels.forEach((label, i) => {
      const edge = left + (i + 1) * col - 7;
      tags.mark(page, tags.element("TH", labelRow), () =>
        page.drawText(label, {
          x: edge - regular.widthOfTextAtSize(label, 9),
          y,
          size: 9,
          font: regular,
          color: muted,
        }),
      );
      const value = values[i]!;
      const size = Math.min(
        12,
        (12 * (col - 14)) / bold.widthOfTextAtSize(value, 12),
      );
      tags.mark(page, tags.element("TD", dataRow), () =>
        page.drawText(value, {
          x: edge - bold.widthOfTextAtSize(value, size),
          y: y - 17,
          size,
          font: bold,
          color: ink,
        }),
      );
    });
    y -= 42;
  }
  function saleAmounts(
    basis: SaleBreakdown | undefined,
    net: string,
    matched: string | null,
    outcomes: [string, string][],
    gain: string | null,
    summary?: NonNullable<typeof r.summary>,
  ) {
    const value = (amount: string | null) =>
      amount === null ? "Unresolved" : pounds(amount);
    if (basis) {
      amounts(
        ["Gross disposal proceeds", "Selling costs", "Net sale proceeds"],
        [basis.grossProceedsGBP, basis.sellingCostsGBP, net].map(pounds),
      );
      amounts(
        [
          "Matched acquisition cost",
          "Total allowable costs",
          ...outcomes.map(([label]) => label),
        ],
        [
          value(matched),
          value(basis.totalAllowableCostsGBP),
          ...outcomes.map(([, amount]) => amount),
        ],
      );
      if (!new Money(basis.proceedsRoundingAdjustmentGBP).isZero())
        line(
          `Rounding adjustment to net sale proceeds: ${pounds(basis.proceedsRoundingAdjustmentGBP)}.`,
          false,
          9,
        );
    } else {
      amounts(
        [
          "Net sale proceeds",
          "Matched acquisition cost",
          ...outcomes.map(([label]) => label),
        ],
        [pounds(net), value(matched), ...outcomes.map(([, amount]) => amount)],
      );
      line(saleBreakdownUnavailable, false, 9, muted);
    }
    for (const note of componentRoundingNotes(net, matched, gain, basis, summary)) line(note, false, 9, muted);
  }

  line(title, true, 32, ink, "H1");
  y += 8;
  line(`Tax year ${r.taxYear}  ·  ${reportStatus(snapshot)}`, true, 10, muted);
  if (sample) line("Illustration using a fictional account and trades.", false, 9, muted);
  y -= 10;
  if (r.disposals.length && r.summary) {
    const tableLeft = left + 238;
    const shown = r.disposals.slice(0, statementSaleLimit);
    const truncated = shown.length < r.disposals.length;
    const bandHeight = Math.max(81, 34 + shown.length * 27 + (truncated ? 15 : 0));
    const top = y;
    tags.artifact(page, () => page.drawRectangle({
      x: left - 10, y: top - bandHeight, width: right - left + 20, height: bandHeight,
      color: rgb(0.944, 0.954, 0.955),
    }));
    const net = r.summary.netGainGBP;
    const amount = pounds(net.replace(/^-/, ""));
    const netSize = Math.min(35, 210 / serif.widthOfTextAtSize(amount, 1));
    y -= 20;
    line(netOutcome(net), true, 11);
    tags.mark(page, tags.element("P", tags.document), () =>
      page.drawText(amount, { x: left, y: y - 22, font: serif, size: netSize, color: ink }));
    y -= 37;
    line("Before personal allowances and prior losses.", false, 8, muted);

    const ledger = tags.element("Table", tags.document);
    const header = tags.element("TR", ledger);
    function cell(
      row: typeof header,
      type: "TH" | "TD",
      text: string,
      x: number,
      baseline: number,
      width: number,
      align: "left" | "right",
      font: typeof regular,
      size: number,
    ) {
      const tag = tags.element(type, row);
      let printed = Array.from(text, printableChar).join("");
      if (printed !== text) escapedText = true;
      if (align === "left" && font.widthOfTextAtSize(printed, size) > width) {
        // A long broker instrument name is available in full in the tagged text and evidence.
        const maximum = width - font.widthOfTextAtSize("…", size);
        let measure = 0;
        let prefix = "";
        for (const character of printed) {
          measure += font.widthOfTextAtSize(character, size);
          if (measure > maximum) break;
          prefix += character;
        }
        printed = prefix + "…";
      }
      // Keep monetary values whole, including unusually wide historic amounts.
      const fitted = Math.min(size, width / Math.max(font.widthOfTextAtSize(printed, 1), 1));
      tags.mark(page, tag, () => page.drawText(printed, {
        x: align === "right" ? x - font.widthOfTextAtSize(printed, fitted) : x,
        y: baseline, font, size: fitted, color: type === "TH" ? muted : ink,
      }), printed !== text ? text : undefined);
      return tag;
    }
    const columnWidth = right - tableLeft - 83;
    cell(header, "TH", "Share sold", tableLeft, top - 15, columnWidth, "left", regular, 8);
    cell(header, "TH", "Gain / loss", right, top - 15, 80, "right", regular, 8);
    for (const [index, d] of shown.entries()) {
      const baseline = top - 36 - 27 * index;
      tags.artifact(page, () => page.drawLine({
        start: { x: tableLeft, y: baseline + 13 }, end: { x: right, y: baseline + 13 }, thickness: 0.45, color: border,
      }));
      const row = tags.element("TR", ledger);
      const name = d.sourceIds.find(key => sources.get(key)?.instrument);
      const nameCell = cell(row, "TD", (name && sources.get(name)?.instrument) || d.securityId,
        tableLeft, baseline, columnWidth, "left", bold, 10);
      tags.mark(page, nameCell, () => page.drawText(date(d.date), { x: tableLeft, y: baseline - 10, font: regular, size: 8, color: muted }));
      const value = d.gainGBP === null ? "Unresolved" : (new Money(d.gainGBP).gt(0) ? "+" : "") + pounds(d.gainGBP);
      cell(row, "TD", value, right, baseline, 80, "right", regular, 11);
    }
    if (truncated) {
      tags.mark(page, tags.element("P", tags.document), () => page.drawText(
        `First ${shown.length} of ${r.disposals.length} disposal groups. See the CSV for all sales.`,
        { x: tableLeft, y: top - bandHeight + 9, font: regular, size: 8, color: muted },
      ));
    }
    y = top - bandHeight - 20;
  } else {
    line(r.disposals.length ? "Total pending review" : noDisposalsLabel(r, snapshot.coverage_confirmed), true, 17);
  }
  if (r.summary) {
    saleAmounts(
      r.saleBreakdown,
      r.summary.proceedsGBP,
      r.summary.allowableCostsGBP,
      [
        ["Gains", pounds(r.summary.gainsGBP)],
        ["Losses", pounds(r.summary.lossesGBP)],
      ],
      r.summary.netGainGBP, r.summary,
    );
  } else {
    for (const message of new Set(r.issues.map(reportIssueMessage))) line(message);
  }
  if (r.hasLaterSales) line("Your portfolio includes sales later in this tax year. Extend the history cutoff and recalculate.");
  heading("Account coverage");
  line(scopeStatement(r));
  line(
    `Account history confirmed: ${snapshot.coverage_confirmed ? "Yes" : "Incomplete"}. History through ${date(r.historyThrough)}.`,
  );
  if (r.requiredHistoryThrough !== r.historyThrough)
    line(`Required history through ${date(r.requiredHistoryThrough)}.`);
  for (const a of snapshot.accounts ?? []) {
    const broker = BROKERS.find((b) => b.id === a.broker)?.name || a.broker;
    line(
      `${a.label} · ${broker} · ${a.confirmed ? "history confirmed" : "history unconfirmed"}`,
      false,
      10,
    );
  }
  if (r.reviewedOpeningPools?.length) {
    heading("Reviewed opening positions", 90);
    for (const pool of r.reviewedOpeningPools) {
      const lines = [
        `${pool.securityId} · ${date(pool.asOf)} · ${shares(pool.quantity)} · verified cost £${pool.costGBP}`,
        `Review case: ${pool.caseReference}`,
        `Supporting evidence: ${pool.sourceReference}`,
      ];
      space(lines.reduce((height, entry) => height + 14 * wrap(entry, regular, 9).length, 3));
      for (const entry of lines) line(entry, false, 9);
    }
  }
  if (evidence) {
    heading("Disposals and share matching", r.disposals.length ? 220 : 48);
    if (!r.disposals.length) line(noDisposalsLabel(r, snapshot.coverage_confirmed) + ".");
    for (const [index, d] of r.disposals.entries()) {
      space(160);
      line(
        `D${index + 1}   ${date(d.date)}   ·   ${d.securityId}   ·   ${shares(d.quantity)} · sale ${sourceIds(d.sourceIds, "Sale")}`,
        true,
        11,
        ink,
        "H3",
      );
      const instrument = d.sourceIds
        .map((id) => sources.get(id)?.instrument)
        .find(Boolean);
      if (instrument) line(instrument, false, 10, muted);
      saleAmounts(d.saleBreakdown, d.proceedsGBP, d.allowableCostGBP, [
        ["Gain / loss", d.gainGBP === null ? "Unresolved" : pounds(d.gainGBP)],
      ], d.gainGBP);
      for (const m of d.matches)
        line(
          `${rules[m.rule]} · ${shares(m.quantity)} · cost ${narrativeCost(m.costGBP)}${m.acquisitionDate ? " · acquired " + date(m.acquisitionDate) : ""}${m.acquisitionIds?.length ? " · " + sourceIds(m.acquisitionIds, rules[m.rule] + " acquisition") : ""}`,
          false,
          10,
        );
      if (d.unmatchedQuantity !== "0")
        line(`Unmatched: ${shares(d.unmatchedQuantity)}`, true);
      y -= 6;
    }
    if (r.poolMovements?.length) {
      heading("Section 104 pool movements", 150);
      line(
        "Earlier entries explain the balance carried into this tax year. Each T reference identifies a transaction in the list below.",
        false,
        9,
        muted,
      );
      for (const movement of r.poolMovements) {
        space(62);
        const label = {
          opening: "Opening balance",
          acquisition: "Acquisition into pool",
          disposal: "Disposal from pool",
        }[movement.kind];
        const period =
          movement.date < r.taxYear.slice(0, 4) + "-04-06"
            ? "Prior-year history · "
            : "";
        line(
          `${period}${date(movement.date)} · ${movement.securityId} · ${label}${movement.sourceIds.length ? " · " + sourceIds(movement.sourceIds, "Pool " + movement.kind) : ""}`,
          true,
          10,
        );
        line(
          `Change: ${shares(movement.quantityChange)} · cost ${narrativeCost(movement.costChangeGBP)}`,
          false,
          9,
        );
        line(
          `Balance: ${shares(movement.quantityAfter)} · cost ${narrativeCost(movement.costAfterGBP)}`,
          false,
          9,
        );
      }
    }
    heading(`Section 104 pools at ${date(r.poolAsOf)}`);
    const unknownPools = unresolvedPoolIssues(r);
    if (!r.pools.length && !unknownPools.length) line("No remaining pool balances.");
    for (const issue of unknownPools) line(issue.securityId + " · Tax-pool balance unresolved.");
    for (const p of r.pools)
      line(
        `${p.securityId} · ${shares(p.quantity)} · total cost ${narrativeCost(p.costGBP)}`,
      );
  }
  const periods = confirmedRatePeriods(r, snapshot.coverage_confirmed);
  if (periods.length) {
    heading("2024-25 rate periods", 105);
    for (const p of periods)
      line(`${date(p.from)} to ${date(p.through)} · gains ${pounds(p.gainsGBP)} · losses ${pounds(p.lossesGBP)} · net ${pounds(p.netGainGBP)}`, false, 10);
    line(ratePeriodsNote, false, 9, muted);
  }
  const differences = roundingDifferences(r);
  if (differences.length) {
    heading("Annual rounding reconciliation");
    line(
      annualRoundingNote(r),
      false,
      9,
    );
    for (const d of differences) {
      line(
        `${d.label}: ${roundingComparisonLabel(r).toLowerCase()} ${pounds(d.comparison)} · rounding difference ${pounds(d.adjustment)} · reported ${pounds(d.reported)}`,
        false,
        9,
      );
    }
  }
  if (r.issues.length) {
    heading("Unresolved issues");
    if (!evidence && r.issues.length > 50)
      line(
        `Showing 50 of ${r.issues.length} issues. The full list is available in CSV evidence.`,
      );
    for (const i of evidence ? r.issues : r.issues.slice(0, 50))
      line(
        `${i.securityId} · ${date(i.date)} · ${reportIssueMessage(i)} (${shares(i.quantity)})`,
      );
  }
  // Keep this fixed filing note together when a disposal table ends near the footer.
  heading("Before using these figures", r.taxYear === "2024-25" ? 192 : 145);
  line(
    filingReview,
  );
  line(
    "This calculation does not determine personal tax owed or complete an HMRC return. Allowances, prior losses, other assets and reliefs are excluded. Same-day disposals may be grouped and totals are rounded to pence. The CSV retains matching and pool costs.",
    false,
    9,
    muted,
  );
  if (r.taxYear === "2024-25") line(adjustment2024Note, false, 9, muted);
  heading("Calculation record");
  line(
    `Saved ${date(snapshot.created_at)} · engine ${r.engineVersion}`,
    false,
    9,
  );
  line(`Calculation reference: ${snapshot.id}`, false, 8);
  line(`Input fingerprint: ${snapshot.input_digest}`, false, 8);
  if (evidence && references.size) {
    heading("Transaction references", 150);
    for (const [key, { id, role }] of references) sourceLine(key, id, role);
  }
  if (escapedText) {
    line("Printed reference notation: unsupported characters appear as Unicode code points in braces after a backslash and the letter u. Two backslashes represent one literal backslash. The original text is available in the CSV.", false, 9, muted);
  }
  const pages = doc.getPages();
  pages.forEach((p, index) => tags.artifact(p, () => {
    const folio = `Page ${index + 1} of ${pages.length}`;
    p.drawLine({ start: { x: left, y: 43 }, end: { x: right, y: 43 }, thickness: 0.55, color: border });
    p.drawText(`CGT Tracker  /  ${r.taxYear}`, { x: left, y: 28, size: 9, font: regular, color: muted });
    p.drawText(folio, { x: right - regular.widthOfTextAtSize(folio, 9), y: 28, size: 9, font: regular, color: muted });
  }));
  tags.finish();
  return doc.save();
}
