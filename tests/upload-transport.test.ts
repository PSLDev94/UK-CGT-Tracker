import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { expect, it } from "vitest";
import { jsonInput } from "../src/server/http";
import { WORKSPACE_BODY_BYTES } from "../src/server/workspace-api";
import { MAX_CSV_BYTES, reviewCsv } from "../src/domain/imports/review";
it("accepts a valid quote-heavy CSV below the file limit despite JSON encoding expansion", async () => {
  const fixture = readFileSync(
    new URL("./fixtures/brokers/freetrade-gbp.csv", import.meta.url),
    "utf8",
  );
  const rows = Papa.parse<Record<string, string>>(fixture, {
    header: true,
    skipEmptyLines: true,
  }).data;
  rows[0]!.Title = '"'.repeat(4_200_000);
  const csv = Papa.unparse(rows),
    body = JSON.stringify({ action: "prepare-import", csv });
  expect(Buffer.byteLength(csv)).toBeLessThan(MAX_CSV_BYTES);
  expect(Buffer.byteLength(body)).toBeGreaterThan(12 * 1024 * 1024);
  const request = () =>
    new Request("https://example.test/api/v2/workspace", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  const decoded = await jsonInput(request(), WORKSPACE_BODY_BYTES);
  expect(decoded.csv).toBe(csv);
  expect(
    reviewCsv(decoded.csv as string, {
      broker: "freetrade",
      accountId: "transport",
      accountType: "GIA",
      format: "native",
      ordinarySharesConfirmed: true,
    }).counts,
  ).toEqual({
    total: 3,
    accepted: 2,
    excluded: 1,
    duplicate: 0,
    needsReview: 0,
  });
  // Other endpoints retain their smaller bound; this is not a global limit lift.
  await expect(jsonInput(request())).rejects.toMatchObject({ status: 413 });
}, 15000);
