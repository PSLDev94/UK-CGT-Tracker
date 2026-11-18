import { readFileSync } from "node:fs";

/** 200 domestic executions, followed by one FX execution requiring evidence. */
export function longFreetradeStatement(prefix: string) {
  function lines(filename: string) {
    return readFileSync("tests/fixtures/brokers/" + filename, "utf8")
      .trim()
      .split(/\r?\n/);
  }
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
