import { designPreviewPdf } from "@/domain/reports/design-preview-pdf";

export async function GET(request: Request) {
  const pdf = await designPreviewPdf();
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
