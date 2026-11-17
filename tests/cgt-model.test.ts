import fc from "fast-check";
import { expect, it } from "vitest";
import { calculateGains } from "../src/domain/cgt/calculate";
import { plusDays } from "../src/domain/values";
import type { Trade } from "../src/domain/cgt/types";

// Independent exact-rational oracle. One token represents a quarter share.
// It allocates individual tokens, instead of using the production engine's
// Decimal daily-side quantity/cost representation. Monetary inputs are pence.
const zero = BigInt(0),
  one = BigInt(1),
  two = BigInt(2),
  hundred = BigInt(100);
type Fraction = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => {
  while (b !== zero) [a, b] = [b, a % b];
  return a < zero ? -a : a;
};
const fraction = (n: bigint, d = one): Fraction => {
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
const add = (a: Fraction, b: Fraction) =>
  fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Fraction, b: Fraction) => add(a, { n: -b.n, d: b.d });
const divide = (a: Fraction, b: number) => fraction(a.n, a.d * BigInt(b));
const rounded = (a: Fraction) => {
  const negative = a.n < zero;
  const abs = negative ? -a.n : a.n;
  const cents = (abs * two + a.d) / (a.d * two);
  return negative ? -cents : cents;
};
const money = (p: bigint): string => {
  const negative = p < zero;
  const abs = negative ? -p : p;
  return `${negative ? "-" : ""}${abs / hundred}.${String(abs % hundred).padStart(2, "0")}`;
};
type Entry = {
  day: number;
  buy: boolean;
  units: number;
  pence: number;
  fee: number;
};
function oracle(entries: Entry[]) {
  const dates = [...new Set(entries.map((e) => e.day))].sort((a, b) => a - b);
  const buys = new Map<number, Fraction[]>(),
    sales = new Map<
      number,
      { units: number; proceeds: bigint; cost: Fraction }
    >();
  for (const day of dates) {
    const b = entries.filter((e) => e.day === day && e.buy),
      s = entries.filter((e) => e.day === day && !e.buy);
    const units = b.reduce((n, e) => n + e.units, 0),
      cost = b.reduce((n, e) => n + BigInt(e.pence + e.fee), zero);
    buys.set(
      day,
      Array.from({ length: units }, () => fraction(cost, BigInt(units))),
    );
    if (s.length)
      sales.set(day, {
        units: s.reduce((n, e) => n + e.units, 0),
        proceeds: s.reduce((n, e) => n + BigInt(e.pence - e.fee), zero),
        cost: fraction(zero),
      });
  }
  // Reserve every same-day token, then identify future tokens for older sales.
  for (const [day, s] of sales) {
    const b = buys.get(day)!;
    while (s.units && b.length) {
      s.cost = add(s.cost, b.shift()!);
      s.units--;
    }
  }
  for (const [day, s] of sales)
    for (const later of dates.filter((d) => d > day && d <= day + 30)) {
      const b = buys.get(later)!;
      while (s.units && b.length) {
        s.cost = add(s.cost, b.shift()!);
        s.units--;
      }
    }
  let poolUnits = 200,
    poolCost = fraction(BigInt(100000));
  const output: {
    date: string;
    proceedsGBP: string;
    allowableCostGBP: string;
    gainGBP: string;
  }[] = [];
  for (const day of dates) {
    const date = plusDays("2024-04-01", day);
    if (date > "2025-04-05") break;
    for (const cost of buys.get(day)!) {
      poolUnits++;
      poolCost = add(poolCost, cost);
    }
    const s = sales.get(day);
    if (!s) continue;
    while (s.units) {
      const unit = divide(poolCost, poolUnits);
      poolUnits--;
      poolCost = sub(poolCost, unit);
      s.cost = add(s.cost, unit);
      s.units--;
    }
    if (date >= "2024-04-06")
      output.push({
        date,
        proceedsGBP: money(s.proceeds),
        allowableCostGBP: money(rounded(s.cost)),
        gainGBP: money(s.proceeds - rounded(s.cost)),
      });
  }
  return { output, poolUnits };
}
it("agrees with an exact rational token model over 500 varied trading histories", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          day: fc.integer({ min: 0, max: 399 }),
          buy: fc.boolean(),
          units: fc.integer({ min: 1, max: 5 }),
          pence: fc.integer({ min: 100, max: 100000 }),
          fee: fc.integer({ min: 0, max: 50 }),
        }),
        { minLength: 2, maxLength: 38 },
      ),
      (entries) => {
        const trades: Trade[] = [
          {
            id: "opening",
            date: "2023-01-01",
            securityId: "GB0008706128",
            side: "BUY",
            quantity: "50",
            considerationGBP: "1000",
            feesGBP: "0",
          },
          ...entries.map((e, i) => ({
            id: String(i),
            date: plusDays("2024-04-01", e.day),
            securityId: "GB0008706128",
            side: e.buy ? ("BUY" as const) : ("SELL" as const),
            quantity: String(e.units / 4),
            considerationGBP: money(BigInt(e.pence)),
            feesGBP: money(BigInt(e.fee)),
          })),
        ];
        const expected = oracle(entries),
          actual = calculateGains(trades, {
            taxYear: "2024-25",
            historyThrough: "2025-05-05",
          });
        expect(actual.status).toBe("complete");
        expect(
          actual.disposals.map(
            ({ date, proceedsGBP, allowableCostGBP, gainGBP }) => ({
              date,
              proceedsGBP,
              allowableCostGBP,
              gainGBP,
            }),
          ),
        ).toEqual(expected.output);
        expect(actual.pools[0]?.quantity ?? "0").toBe(
          String(expected.poolUnits / 4),
        );
        // Permuting exports and account order cannot change the UK-wide calculation.
        expect(
          calculateGains([...trades].reverse(), {
            taxYear: "2024-25",
            historyThrough: "2025-05-05",
          }),
        ).toEqual(actual);
      },
    ),
    { numRuns: 500, seed: 20261117 },
  );
});
