import { readFileSync } from "node:fs";

function lines(filename: string) {
  return readFileSync("tests/fixtures/brokers/" + filename, "utf8")
    .trim()
    .split(/\r?\n/);
}

/** 200 domestic executions, followed by one FX execution requiring evidence. */
export function longFreetradeStatement(prefix: string) {
  const [header, domestic] = lines("freetrade-gbp.csv");
  const [, foreign] = lines("freetrade-fx-fees.csv");
  const rows = Array.from({ length: 200 }, (_, index) =>
    domestic!.replace("SYNTHETIC-F-001", `${prefix}-${index}`),
  );
  return [
    header,
    ...rows,
    foreign!.replace("SYNTHETIC-F-001", prefix + "-fx"),
  ].join("\n");
}

export function mixedFreetradeStatement() {
  const [header, domestic] = lines("freetrade-gbp.csv");
  const [, foreign] = lines("freetrade-fx-fees.csv");
  const [, , split] = lines("freetrade-corporate-action-review.csv");
  return [
    header!,
    ...Array.from({ length: 20 }, (_, i) =>
      foreign!.replace("SYNTHETIC-F-001", `MIXED-FX-${i}`),
    ),
    ...Array.from({ length: 80 }, (_, i) =>
      domestic!.replace("SYNTHETIC-F-001", `MIXED-GBP-${i}`),
    ),
    split!,
  ].join("\n");
}
