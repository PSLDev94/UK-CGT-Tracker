import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { reportStatus, type ReportSnapshot } from "./report";

/** Paginated, selectable text. All financial figures come from the immutable run. */
export async function reportPdf(
  snapshot: ReportSnapshot,
  evidence = false,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const title = evidence ? "Calculation evidence" : "Capital gains summary";
  doc.setTitle(`CGT Tracker - ${title} ${snapshot.result.taxYear}`);
  doc.setAuthor("CGT Tracker");
  doc.setLanguage("en-GB");
  const ink = rgb(0.067, 0.094, 0.153),
    blue = rgb(0.145, 0.388, 0.922);
  let page = doc.addPage([595.28, 841.89]),
    y = 756;
  function header() {
    page.drawText("CGT Tracker", {
      x: 44,
      y: 800,
      size: 17,
      font: bold,
      color: blue,
    });
    page.drawText(`${snapshot.result.taxYear} | ${title}`, {
      x: 44,
      y: 778,
      size: 10,
      font: regular,
      color: ink,
    });
  }
  header();
  function line(text: string, strong = false, size = 10) {
    const font = strong ? bold : regular;
    // Values are controlled English/ISO strings. Unsupported input cannot crash a download.
    const clean = text.replace(/[^\x20-\x7e£–—’]/g, "?");
    let buffer = "",
      width = 0;
    const flush = () => {
      if (y < 65) {
        page = doc.addPage([595.28, 841.89]);
        y = 756;
        header();
      }
      page.drawText(buffer.trimEnd(), { x: 44, y, size, font, color: ink });
      y -= size + 5;
      buffer = "";
      width = 0;
    };
    // Linear wrapping: never repeatedly measure the entire remaining reference list.
    for (const word of clean.split(/(\s+)/)) {
      if (!buffer && !word.trim()) continue;
      const wordWidth = font.widthOfTextAtSize(word, size);
      if (wordWidth <= 507) {
        if (width + wordWidth > 507 && buffer) flush();
        if (!buffer && !word.trim()) continue;
        buffer += word;
        width += wordWidth;
      } else {
        for (const char of word) {
          const charWidth = font.widthOfTextAtSize(char, size);
          if (width + charWidth > 507 && buffer) flush();
          buffer += char;
          width += charWidth;
        }
      }
    }
    if (buffer || !clean) flush();
  }
  const gap = () => {
    y -= 10;
  };
  const r = snapshot.result;
  line(reportStatus(snapshot), true, 12);
  gap();
  line(`Calculation reference: ${snapshot.id}`);
  line(`Saved: ${new Date(snapshot.created_at).toISOString()}`);
  line(
    `History through: ${r.historyThrough}. Required through: ${r.requiredHistoryThrough}.`,
  );
  line(
    `Account coverage confirmed: ${snapshot.coverage_confirmed ? "Yes" : "No"}. Engine: ${r.engineVersion}.`,
  );
  gap();
  line("Gains and losses (GBP)", true, 13);
  if (r.summary) {
    line(`Net disposal proceeds: £${r.summary.proceedsGBP}`);
    line(`Allowable acquisition costs: £${r.summary.allowableCostsGBP}`);
    line(`Gains before losses: £${r.summary.gainsGBP}`);
    line(`Losses: £${r.summary.lossesGBP}`);
    line(`Net gain / loss: £${r.summary.netGainGBP}`, true);
  } else
    line(
      "Totals withheld: resolve missing acquisition history before relying on this calculation.",
    );
  gap();
  line("Before using this report", true, 13);
  line(
    "This report covers the ordinary shares and accounts included in this calculation. It is not an HMRC form, a tax return, or the amount of tax you owe. Check all accounts, historical acquisitions and corporate actions.",
  );
  line(
    "Allowances, losses brought forward, other assets, income bands and reliefs are not applied. Same-day sales may be grouped. Disposal totals are rounded to pence; matching and pool costs retain calculation precision. Apply tax-year filing instructions separately.",
  );
  if (evidence) {
    gap();
    line("Disposals and share matching", true, 13);
    for (const d of r.disposals) {
      gap();
      line(`${d.date} | ${d.securityId} | ${d.quantity} shares`, true);
      line(
        `Net proceeds £${d.proceedsGBP} | Costs ${d.allowableCostGBP === null ? "UNRESOLVED" : "£" + d.allowableCostGBP} | Gain/loss ${d.gainGBP === null ? "UNRESOLVED" : "£" + d.gainGBP}`,
      );
      for (const m of d.matches)
        line(
          `${m.rule.replaceAll("_", " ")}: ${m.quantity} shares; cost £${m.costGBP}${m.acquisitionDate ? "; acquired " + m.acquisitionDate : ""}`,
        );
      if (d.unmatchedQuantity !== "0")
        line(`Unmatched quantity: ${d.unmatchedQuantity}`, true);
      line(`Source references: ${d.sourceIds.join(", ")}`, false, 8);
      for (const m of d.matches)
        if (m.acquisitionIds?.length)
          line(
            `Acquisition references: ${m.acquisitionIds.join(", ")}`,
            false,
            8,
          );
    }
    gap();
    line(`Section 104 pools at ${r.poolAsOf}`, true, 13);
    for (const p of r.pools)
      line(`${p.securityId} | ${p.quantity} shares | £${p.costGBP}`);
  }
  if (r.issues.length) {
    gap();
    if (!evidence && r.issues.length > 50)
      line(
        `Showing 50 of ${r.issues.length} issues. Download CSV evidence for the complete list.`,
      );
    line("Unresolved issues", true, 13);
    for (const i of evidence ? r.issues : r.issues.slice(0, 50))
      line(`${i.securityId}, ${i.date}: ${i.message} (${i.quantity} shares)`);
  }
  gap();
  line(`Input fingerprint: ${snapshot.input_digest}`, false, 8);
  const pages = doc.getPages();
  pages.forEach((p, index) =>
    p.drawText(
      `CGT Tracker | ${r.taxYear} | ${index + 1} / ${pages.length} | Keep with your records`,
      { x: 44, y: 32, size: 8, font: regular, color: ink },
    ),
  );
  return doc.save();
}
