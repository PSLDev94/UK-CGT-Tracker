import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { roundingDifferences } from "./rounding";
import { Money, netOutcome } from "../values";
import { reportStructure } from "./pdf-structure";
import { saleBreakdownUnavailable, type SaleBreakdown } from "../cgt/types";
import { BROKERS } from "../imports/brokers";
import {
  reportIssueMessage,
  reportStatus,
  type ReportSnapshot,
} from "./report";

const humanDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});
const date = (value: string | Date) => humanDate.format(new Date(value));
const pounds = (value: string) =>
  value.startsWith("-") ? "-£" + value.slice(1) : "£" + value;
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
  const glyphs = new Set(regular.getCharacterSet());
  const printable = (text: string) =>
    Array.from(text, (char) =>
      glyphs.has(char.codePointAt(0)!) ? char : "?",
    ).join("");
  const title = evidence ? "Calculation evidence" : "Capital gains summary";
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
    blue = rgb(0.145, 0.388, 0.86),
    muted = rgb(0.25, 0.3, 0.37),
    border = rgb(0.84, 0.87, 0.9);
  let page = doc.addPage([595.28, 841.89]);
  let y = 0;
  let continuedSection = "";
  const left = 44,
    right = 551;
  function header() {
    page.drawText(sample ? "CGT Tracker  /  Synthetic sample" : "CGT Tracker", {
      x: left,
      y: 802,
      size: 14,
      font: bold,
      color: blue,
    });
    const label = `${r.taxYear}  /  ${title}`;
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
    y = 762;
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
    const lines: string[] = [];
    let buffer = "",
      width = 0;
    function flush() {
      lines.push(buffer.trimEnd());
      buffer = "";
      width = 0;
    }
    for (const word of printable(text).split(/(\s+)/)) {
      if (!buffer && !word.trim()) continue;
      const w = font.widthOfTextAtSize(word, size);
      if (w <= right - left) {
        if (width + w > right - left && buffer) flush();
        if (!buffer && !word.trim()) continue;
        buffer += word;
        width += w;
      } else {
        for (const char of word) {
          const cw = font.widthOfTextAtSize(char, size);
          if (width + cw > right - left && buffer) flush();
          buffer += char;
          width += cw;
        }
      }
    }
    if (buffer) flush();
    return lines;
  }
  function line(
    text: string,
    strong = false,
    size = 10,
    color = ink,
    role: "P" | "H1" | "H2" | "H3" = "P",
  ) {
    const font = strong ? bold : regular;
    const item = tags.element(role, tags.document);
    for (const content of wrap(text, font, size)) {
      space(size + 5);
      tags.mark(page, item, () =>
        page.drawText(content, { x: left, y, size, font, color }),
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
      entries.push({ text: `Trace reference: ${key}`, size: 8 });
    } else {
      entries.push({
        text: `${id} · ${role} · trace reference: ${key}`,
        size: 8,
      });
    }
    const height = entries.reduce(
      (total, entry) =>
        total + wrap(entry.text, regular, entry.size).length * (entry.size + 5),
      0,
    );
    space(Math.min(712, height + 3));
    for (const entry of entries) line(entry.text, false, entry.size);
    y -= 3;
  }
  function heading(text: string, reserve = 48) {
    continuedSection = "";
    space(reserve);
    y -= 8;
    tags.bookmark(text, page, y + 16);
    line(text, true, 13, ink, "H2");
    continuedSection = text;
  }
  function amounts(labels: string[], values: string[]) {
    const col = (right - left) / labels.length;
    space(41);
    tags.artifact(page, () =>
      page.drawRectangle({
        x: left,
        y: y - 24,
        width: right - left,
        height: 37,
        color: rgb(0.96, 0.97, 0.98),
      }),
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
  }

  line(`${r.taxYear}  ${title}`, true, 19, ink, "H1");
  if (r.summary) {
    const net = r.summary.netGainGBP;
    line(`${netOutcome(net)}  ${pounds(net.replace(/^-/, ""))}`, true, 22);
  } else {
    line("Total pending acquisition history", true, 17);
  }
  line(reportStatus(snapshot), true, 10, blue);
  if (sample)
    line(
      "Illustration using a fictional account and trades.",
      false,
      10,
      muted,
    );
  y -= 4;
  if (r.summary) {
    saleAmounts(
      r.saleBreakdown,
      r.summary.proceedsGBP,
      r.summary.allowableCostsGBP,
      [
        ["Gains", pounds(r.summary.gainsGBP)],
        ["Losses", pounds(r.summary.lossesGBP)],
      ],
    );
  } else {
    line("Resolve missing acquisition history before relying on totals.");
  }
  heading("Account coverage");
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
  if (evidence) {
    heading("Disposals and share matching", r.disposals.length ? 220 : 48);
    if (!r.disposals.length) line("No disposals in this tax year.");
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
      ]);
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
    if (!r.pools.length) line("No remaining pool balances.");
    for (const p of r.pools)
      line(
        `${p.securityId} · ${shares(p.quantity)} · total cost ${narrativeCost(p.costGBP)}`,
      );
  }
  const differences = roundingDifferences(r);
  if (differences.length) {
    heading("Annual rounding reconciliation");
    line(
      "The reported total sums disposals rounded to pence. The first amount rounds only after adding the full-precision amounts for the year.",
      false,
      9,
    );
    for (const d of differences) {
      line(
        `${d.label}: annual ${pounds(d.annual)} · rounding difference ${pounds(d.adjustment)} · reported ${pounds(d.reported)}`,
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
  heading("Before using these figures", 125);
  line(
    "These are ordinary-share gains and losses for the accounts included. Check account coverage, acquisitions and corporate actions before filing. This calculation does not determine personal tax owed or complete an HMRC return.",
  );
  line(
    "Allowances, losses brought forward, other assets, income bands and reliefs are excluded. Same-day disposals may be grouped. Disposal totals are rounded to pence. The CSV retains full precision for matching and pool costs.",
    false,
    9,
    muted,
  );
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
  const pages = doc.getPages();
  pages.forEach((p, index) =>
    tags.artifact(p, () =>
      p.drawText(
        `CGT Tracker  |  ${r.taxYear}  |  Page ${index + 1} of ${pages.length}`,
        { x: left, y: 29, size: 9, font: regular, color: muted },
      ),
    ),
  );
  tags.finish();
  return doc.save();
}
