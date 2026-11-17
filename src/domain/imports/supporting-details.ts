/** Explicit evidence supplied by the investor, never inferred from a ticker. */
export interface SupportingDetails {
  isin: string;
  currency: string;
  gbpPerUnit: string;
  priceUnit: "major" | "minor";
  fees: string;
  transactionId: string;
  reference: string;
  netAmountConfirmed: boolean;
}
export type ImportDetails = Record<string, SupportingDetails>;
export function validateDetails(value: unknown): ImportDetails {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > 100000
  )
    throw new Error("Provide supporting details keyed by CSV record number.");
  for (const [key, row] of Object.entries(value)) {
    if (
      !/^[1-9]\d{0,5}$/.test(key) ||
      !row ||
      typeof row !== "object" ||
      Array.isArray(row)
    )
      throw new Error("Choose a valid CSV record.");
    const r = row as Record<string, unknown>;
    if (
      Object.keys(r).sort().join(",") !==
      "currency,fees,gbpPerUnit,isin,netAmountConfirmed,priceUnit,reference,transactionId"
    )
      throw new Error("Provide all supporting fields.");
    for (const field of [
      "isin",
      "currency",
      "gbpPerUnit",
      "fees",
      "transactionId",
      "reference",
    ])
      if (typeof r[field] !== "string" || (r[field] as string).length > 500)
        throw new Error(
          "Supporting fields must be text of at most 500 characters.",
        );
    if (
      !["major", "minor"].includes(String(r.priceUnit)) ||
      r.netAmountConfirmed !== true ||
      (r.reference as string).trim().length < 8
    )
      throw new Error(
        "Confirm the net cash amount and provide a contract-note or statement reference (at least 8 characters).",
      );
  }
  return value as ImportDetails;
}
