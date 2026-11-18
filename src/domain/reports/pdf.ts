import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { roundingDifferences } from "./rounding";
import { netOutcome } from "../values";
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
  `${quantity} ${quantity === "1" ? "share" : "shares"}`;
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
  header();
  const sources = new Map(
    snapshot.sources?.map((source) => [source.key, source]),
  );
  function space(height: number) {
    if (y - height < 50) {
      page = doc.addPage([595.28, 841.89]);
      header();
    }
  }
  function line(text: string, strong = false, size = 10, color = ink) {
    const font = strong ? bold : regular;
    let buffer = "",
      width = 0;
    function flush() {
      space(size + 5);
      page.drawText(buffer.trimEnd(), { x: left, y, size, font, color });
      y -= size + 5;
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
  }
  function sourceLine(key: string, side: string) {
    const source = sources.get(key);
    if (source) {
      const broker =
        BROKERS.find((b) => b.id === source.broker)?.name ?? source.broker;
      line(
        `${side} · ${broker} · ${source.label} · file row ${source.record}`,
        false,
        9,
      );
      if (source.reference)
        line(`Execution reference: ${source.reference}`, false, 9);
      if (source.statementReference)
        line(`Statement reference: ${source.statementReference}`, false, 9);
    }
    line(`${source ? "Trace reference" : side}: ${key}`, false, 8);
  }
  function heading(text: string) {
    space(48);
    y -= 8;
    line(text, true, 13);
  }
  function amounts(labels: string[], values: string[]) {
    const col = (right - left) / labels.length;
    space(41);
    page.drawRectangle({
      x: left,
      y: y - 24,
      width: right - left,
      height: 37,
      color: rgb(0.96, 0.97, 0.98),
    });
    labels.forEach((label, i) => {
      const edge = left + (i + 1) * col - 7;
      page.drawText(label, {
        x: edge - regular.widthOfTextAtSize(label, 9),
        y,
        size: 9,
        font: regular,
        color: muted,
      });
      const value = values[i]!;
      const size = Math.min(
        12,
        (12 * (col - 14)) / bold.widthOfTextAtSize(value, 12),
      );
      page.drawText(value, {
        x: edge - bold.widthOfTextAtSize(value, size),
        y: y - 17,
        size,
        font: bold,
        color: ink,
      });
    });
    y -= 42;
  }
  line(`${r.taxYear}  ${title}`, true, 19);
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
    amounts(
      ["Net proceeds", "Allowable costs", "Gains", "Losses"],
      [
        r.summary.proceedsGBP,
        r.summary.allowableCostsGBP,
        r.summary.gainsGBP,
        r.summary.lossesGBP,
      ].map(pounds),
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
    heading("Disposals and share matching");
    if (!r.disposals.length) line("No disposals in this tax year.");
    for (const [index, d] of r.disposals.entries()) {
      space(85);
      line(
        `D${index + 1}   ${date(d.date)}   ·   ${d.securityId}   ·   ${shares(d.quantity)}`,
        true,
        11,
      );
      const instrument = d.sourceIds
        .map((id) => sources.get(id)?.instrument)
        .find(Boolean);
      if (instrument) line(instrument, false, 10, muted);
      amounts(
        ["Net proceeds", "Allowable costs", "Gain / loss"],
        [
          pounds(d.proceedsGBP),
          d.allowableCostGBP === null
            ? "Unresolved"
            : pounds(d.allowableCostGBP),
          d.gainGBP === null ? "Unresolved" : pounds(d.gainGBP),
        ],
      );
      for (const m of d.matches)
        line(
          `${rules[m.rule]} · ${shares(m.quantity)} · cost ${pounds(m.costGBP)}${m.acquisitionDate ? " · acquired " + date(m.acquisitionDate) : ""}`,
          false,
          10,
        );
      if (d.unmatchedQuantity !== "0")
        line(`Unmatched: ${shares(d.unmatchedQuantity)}`, true);
      y -= 6;
    }
    if (r.poolMovements?.length) {
      heading("Section 104 pool movements");
      line(
        "Each entry shows the part added to or removed from the pool after same-day and 30-day matching. Source references identify the transactions on that date.",
        false,
        9,
        muted,
      );
      for (const movement of r.poolMovements) {
        space(movement.sourceIds.length ? 118 : 62);
        const label = {
          opening: "Opening balance",
          acquisition: "Acquisition into pool",
          disposal: "Disposal from pool",
        }[movement.kind];
        line(
          `${date(movement.date)} · ${movement.securityId} · ${label}`,
          true,
          10,
        );
        line(
          `Change: ${shares(movement.quantityChange)} · cost ${pounds(movement.costChangeGBP)}`,
          false,
          9,
        );
        line(
          `Balance: ${shares(movement.quantityAfter)} · cost ${pounds(movement.costAfterGBP)}`,
          false,
          9,
        );
        for (const key of movement.sourceIds) sourceLine(key, "Pool movement");
      }
    }
    heading(`Section 104 pools at ${date(r.poolAsOf)}`);
    if (!r.pools.length) line("No remaining pool balances.");
    for (const p of r.pools)
      line(
        `${p.securityId} · ${shares(p.quantity)} · total cost ${pounds(p.costGBP)}`,
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
  space(114);
  heading("Before using these figures");
  line(
    "These are ordinary-share gains and losses for the accounts included. Check account coverage, acquisitions and corporate actions before filing. This calculation does not determine personal tax owed or complete an HMRC return.",
  );
  line(
    "Allowances, losses brought forward, other assets, income bands and reliefs are excluded. Same-day disposals may be grouped. Disposal totals are rounded to pence. Matching and pool costs retain calculation precision.",
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
  if (evidence && r.disposals.length) {
    heading("Transaction references");
    for (const [index, d] of r.disposals.entries()) {
      space(35);
      line(`D${index + 1} · ${date(d.date)} · ${d.securityId}`, true, 9);
      for (const key of d.sourceIds) sourceLine(key, "Sale");
      for (const match of d.matches)
        for (const key of match.acquisitionIds ?? [])
          sourceLine(key, rules[match.rule] + " acquisition");
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, index) =>
    p.drawText(
      `CGT Tracker  |  ${r.taxYear}  |  Page ${index + 1} of ${pages.length}`,
      { x: left, y: 29, size: 9, font: regular, color: muted },
    ),
  );
  return doc.save();
}
