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
  return sterling(rounded.isZero() ? "0.00" : rounded.toFixed(2));
}

/** Unit costs can be below a penny even when the total is several pounds. */
export function unitPrice(value: string): string {
  const amount = new Money(value);
  if (amount.gt(0) && amount.lt("0.00000001")) return "<£0.00000001";
  const rounded = amount.toDecimalPlaces(8);
  return sterling(rounded.toFixed(Math.max(2, rounded.decimalPlaces())));
}

function sterling(fixed: string) {
  const [whole = "0", fraction = "00"] = fixed.split(".");
  return `${whole.startsWith("-") ? "−" : ""}£${whole.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
