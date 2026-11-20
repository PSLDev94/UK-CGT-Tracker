import { reportPdf } from "@/domain/reports/pdf";
import { sampleReport } from "@/domain/reports/sample";

export async function GET(request: Request) {
  const pdf = await reportPdf(sampleReport, true, { sample: true });
  const mode =
    new URL(request.url).searchParams.get("download") === "1"
      ? "attachment"
      : "inline";
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${mode}; filename="CGT-Tracker-sample-2025-26.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
