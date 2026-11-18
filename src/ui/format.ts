import { Money } from "../domain/values";
export { netOutcome } from "../domain/values";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});
export function displayDate(value: string): string {
  return dateFormatter.format(new Date(value + "T00:00:00Z"));
}

/** Display-only rounding. Calculations and API evidence retain decimal strings. */
export function money(value: string | null): string {
  if (value === null) return "Not calculated";
  const rounded = new Money(value).toDecimalPlaces(2);
  const [whole = "0", fraction = "00"] = (
    rounded.isZero() ? "0.00" : rounded.toFixed(2)
  ).split(".");
  return `${whole.startsWith("-") ? "−" : ""}£${whole.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
