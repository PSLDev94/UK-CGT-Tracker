// Run with npx tsx scripts/generate-sample-reports.ts after changing the example or PDF layout.
import { mkdir, writeFile } from "node:fs/promises";
import { reportPdf } from "../src/domain/reports/pdf";
import { sampleReport } from "../src/domain/reports/sample";

async function generate() {
  const directory = new URL("../public/samples/", import.meta.url);
  await mkdir(directory, { recursive: true });
  for (const kind of ["summary", "evidence"]) {
    const bytes = await reportPdf(sampleReport, kind === "evidence", {
      sample: true,
    });
    await writeFile(new URL(`cgt-${kind}.pdf`, directory), bytes);
  }
}
void generate();
