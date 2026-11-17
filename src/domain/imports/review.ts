import { createHash } from "node:crypto";
import Papa from "papaparse";
import { calendarDate, decimal } from "../values";
import type { Trade } from "../cgt/types";
import { BROKERS, type BrokerId } from "./brokers";
import { nativeAdapter, NATIVE_GUIDANCE } from "./native";
import {
  validateDetails,
  type ImportDetails,
  type SupportingDetails,
} from "./supporting-details";
import { HL_HEADERS } from "./additional-brokers";

export const CANONICAL_HEADERS = [
  "Transaction ID",
  "Trade date",
  "Type",
  "ISIN",
  "Quantity",
  "Consideration",
  "Fees",
  "Currency",
  "GBP per unit",
  "Asset type",
] as const;
export const PARSER_VERSION = "canonical-v1.0.1";
export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_RECORDS = 100_000;

export interface ImportOptions {
  broker: BrokerId;
  accountId: string;
  accountType: "GIA" | "ISA" | "SIPP" | "UNKNOWN";
  format: "canonical-v1" | "native";
  /** Server-supplied date limit; explicit to keep fixture reviews deterministic. */
  latestTradeDate?: string;
  /** User attestation, persisted with the draft and rechecked at commit. */
  ordinarySharesConfirmed?: boolean;
  supportingDetails?: ImportDetails;
  /** Stable source key -> normalised-content digest, loaded server-side. */
  existing?: ReadonlyMap<string, string>;
}

export interface ImportIssue {
  code:
    | "INVALID_FILE"
    | "UNSUPPORTED_FORMAT"
    | "UNSUPPORTED_ACCOUNT"
    | "INVALID_ROW"
    | "DUPLICATE_CONFLICT";
  message: string;
  record?: number;
}

export interface ImportRecord {
  record: number;
  status: "accepted" | "excluded" | "duplicate" | "needs_review";
  reason: string;
  source?: Record<string, string>;
  supportingDetails?: SupportingDetails;
  canSupplyDetails?: boolean;
  sourceKey?: string;
  digest?: string;
  trade?: Trade;
  provenance?: {
    originalCurrency: string;
    consideration: string;
    fees: string;
    gbpPerUnit: string;
    native?: {
      format: string;
      fields: Record<string, string>;
      ordinarySharesConfirmed: true;
      supportingDetails?: SupportingDetails;
    };
  };
}

export interface ImportReview {
  fileDigest: string;
  parserVersion: string;
  status: "ready" | "needs_review" | "unsupported";
  headers: string[];
  records: ImportRecord[];
  issues: ImportIssue[];
  counts: {
    total: number;
    accepted: number;
    excluded: number;
    duplicate: number;
    needsReview: number;
  };
}

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const currencies = new Set(Intl.supportedValuesOf("currency"));

/** ISIN syntax plus ISO 6166/Luhn check digit. Does not establish asset type. */
export function validISIN(value: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value)) return false;
  const digits = [...value]
    .map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c))
    .join("");
  let total = 0;
  for (
    let index = digits.length - 1, offset = 0;
    index >= 0;
    index--, offset++
  ) {
    let digit = Number(digits[index]) * (offset % 2 === 1 ? 2 : 1);
    if (digit > 9) digit -= 9;
    total += digit;
  }
  return total % 10 === 0;
}

/**
 * Server-side, pure preview. Nothing is written, guessed, or sent to an LLM.
 * The canonical template is an explicit interchange contract, NOT evidence that
 * any broker's native export is certified. Re-run this on the server at commit.
 */
export function reviewCsv(csv: string, options: ImportOptions): ImportReview {
  let parserVersion = PARSER_VERSION;
  const records: ImportRecord[] = [];
  const issues: ImportIssue[] = [];
  const fileDigest = hash(csv);
  const finish = (headers: string[], unsupported = false): ImportReview => {
    const counts = {
      total: records.length,
      accepted: 0,
      excluded: 0,
      duplicate: 0,
      needsReview: 0,
    };
    for (const record of records) {
      if (record.status === "needs_review") counts.needsReview++;
      else counts[record.status]++;
    }
    return {
      fileDigest,
      parserVersion,
      headers,
      records,
      issues,
      counts,
      status: unsupported
        ? "unsupported"
        : issues.length || counts.needsReview || !counts.accepted
          ? "needs_review"
          : "ready",
    };
  };
  if (
    !BROKERS.some((b) => b.id === options.broker) ||
    !options.accountId.trim()
  ) {
    issues.push({
      code: "INVALID_FILE",
      message: "Select a recognised broker and account before importing.",
    });
    return finish([]);
  }
  if (options.accountType !== "GIA") {
    issues.push({
      code: "UNSUPPORTED_ACCOUNT",
      message:
        "Only confirmed taxable general investment accounts are supported. Do not mix ISA or pension transactions into this portfolio.",
    });
    return finish([], true);
  }
  if (
    !csv.trim() ||
    Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES ||
    csv.includes("\0")
  ) {
    issues.push({
      code: "INVALID_FILE",
      message:
        "Provide a non-empty UTF-8 CSV of at most 10 MiB, without binary content.",
    });
    return finish([]);
  }
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ""), {
    header: false,
    delimiter: ",",
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });
  // HL has a fixed statement preamble. Accept only its known metadata lines;
  // unknown content before the header must never vanish.
  let headerIndex = 0;
  if (
    options.format === "native" &&
    options.broker === "hl" &&
    parsed.data[0]?.[0]?.trim() === "Transaction Summary"
  ) {
    const candidate = parsed.data.findIndex(
      (row) => row[0]?.trim() === "Trade date",
    );
    if (
      candidate > 0 &&
      parsed.data
        .slice(0, candidate)
        .every((row) =>
          ["Transaction Summary", "Client Name:", "Client Number:"].includes(
            row[0]?.trim() ?? "",
          ),
        )
    )
      headerIndex = candidate;
  }
  const headers = (parsed.data[headerIndex] ?? []).map((value) => value.trim());
  const data = parsed.data.slice(headerIndex + 1);
  if (
    options.broker === "hl" &&
    headers.length === 8 &&
    headers[7] === "" &&
    HL_HEADERS.every((h, i) => headers[i] === h)
  ) {
    headers.pop();
    for (const row of data)
      if (row.length === 8 && row[7]?.trim() === "") row.pop();
  }
  try {
    if (options.supportingDetails) validateDetails(options.supportingDetails);
  } catch (error) {
    issues.push({ code: "INVALID_FILE", message: (error as Error).message });
    return finish(headers);
  }
  if (
    Object.keys(options.supportingDetails ?? {}).some(
      (key) =>
        Number(key) < headerIndex + 2 || Number(key) > parsed.data.length,
    )
  ) {
    issues.push({
      code: "INVALID_FILE",
      message: "Supporting details refer to a record that is not in this file.",
    });
    return finish(headers);
  }
  if (
    parsed.errors.length ||
    !data.length ||
    data.length > MAX_RECORDS ||
    (options.format !== "native" && new Set(headers).size !== headers.length)
  ) {
    issues.push({
      code: "INVALID_FILE",
      message:
        "The CSV is malformed, has duplicate headers, has no data, or exceeds 100,000 records. Correct the file before importing.",
    });
    return finish(headers);
  }
  const canonical =
    options.format === "canonical-v1" &&
    headers.length === CANONICAL_HEADERS.length &&
    CANONICAL_HEADERS.every((h) => headers.includes(h));
  const adapter =
    options.format === "native"
      ? nativeAdapter(options.broker, headers)
      : undefined;
  if (!canonical && !adapter) {
    issues.push({
      code: "UNSUPPORTED_FORMAT",
      message: `This export or column layout has not been verified. No records have been imported. ${NATIVE_GUIDANCE[options.broker]}`,
    });
    data.forEach((_, index) =>
      records.push({
        record: index + 2,
        status: "needs_review",
        reason: "Unverified CSV format; values have not been inferred.",
      }),
    );
    return finish(headers, true);
  }

  if (adapter) parserVersion = adapter.version;
  if (
    options.broker === "ibkr" &&
    adapter &&
    new Set(data.map((row) => row[headers.indexOf("ClientAccountID")])).size > 1
  ) {
    issues.push({
      code: "INVALID_FILE",
      message:
        "Export one IBKR account per file so taxable and sheltered accounts cannot be mixed.",
    });
    return finish(headers);
  }
  const repeatedIds = new Set<string>();
  const nativeIds = new Set<string>();
  if (adapter)
    for (const values of data) {
      const r = Object.fromEntries(
        headers.map((h, i) => [h, values[i]?.trim() ?? ""]),
      );
      if (adapter.isTrade(r) && r[adapter.idColumn]) {
        if (nativeIds.has(r[adapter.idColumn]!))
          repeatedIds.add(r[adapter.idColumn]!);
        nativeIds.add(r[adapter.idColumn]!);
      }
    }
  const seen = new Map(options.existing);
  const executionIds = new Set<string>();
  data.forEach((values, index) => {
    const record = index + headerIndex + 2; // CSV record number; quoted multi-line fields are one record.
    const source = Object.fromEntries(
      headers.map((header, i) => [header, values[i]?.trim() ?? ""]),
    );
    const supportingDetails = options.supportingDetails?.[String(record)];
    const detailMetadata = adapter
      ? {
          source,
          supportingDetails,
          canSupplyDetails:
            adapter.isTrade(source) &&
            (["hl", "ii", "ajbell"].includes(options.broker) ||
              (options.broker === "ibkr" && source.CurrencyPrimary !== "GBP") ||
              (options.broker === "freetrade" &&
                source["Instrument Currency"] !== "GBP") ||
              (options.broker === "trading212" &&
                !["GBP", "GBX"].includes(
                  source["Currency (Price / share)"] ?? "",
                ))),
        }
      : {};
    try {
      if (values.length !== headers.length)
        throw new Error(
          "The record has a different number of fields from the header.",
        );
      if (
        adapter &&
        adapter.isTrade(source) &&
        repeatedIds.has(source[adapter.idColumn]!)
      )
        throw new Error(
          "This native file repeats a trade ID. It may contain several executions or duplicate rows; review it before importing.",
        );
      const row = (
        adapter ? adapter.normalize(source, supportingDetails) : source
      ) as Record<(typeof CANONICAL_HEADERS)[number], string>;
      if (
        [
          "CASH_DEPOSIT",
          "CASH_WITHDRAWAL",
          "CASH_DIVIDEND",
          "CASH_INTEREST",
        ].includes(row.Type)
      ) {
        records.push({
          record,
          status: "excluded",
          reason: `${row.Type}: excluded from share gains; income tax is outside this calculation.`,
        });
        return;
      }
      if (adapter && options.ordinarySharesConfirmed !== true)
        throw new Error(
          "Confirm that every traded instrument in this file is an ordinary share. The export does not establish asset classification.",
        );
      if (row.Type !== "BUY" && row.Type !== "SELL")
        throw new Error(
          "Unrecognised activity. Transfers, corporate actions, reinvestments and other events need explicit handling.",
        );
      if (row["Asset type"] !== "ORDINARY_SHARE")
        throw new Error(
          "Confirm the instrument is an ordinary share. Funds, ETFs, derivatives and other assets need additional handling.",
        );
      if (
        !row["Transaction ID"] ||
        row["Transaction ID"].length > 200 ||
        /[\r\n\x00-\x1f]/.test(row["Transaction ID"])
      )
        throw new Error("A stable transaction identifier is required.");
      if (adapter && executionIds.has(row["Transaction ID"]))
        throw new Error(
          "A native execution reference is repeated within this file. Verify individual fills; repeated rows cannot be silently removed.",
        );
      if (adapter) executionIds.add(row["Transaction ID"]);
      const date = calendarDate(row["Trade date"]);
      if (date < "1982-04-01")
        throw new Error(
          "Pre-April-1982 transactions require specialist handling and cannot be imported into this calculation.",
        );
      if (
        options.latestTradeDate &&
        date > calendarDate(options.latestTradeDate)
      )
        throw new Error(
          "A trade date is in the future. Check that this is the execution date, not a settlement date.",
        );
      if (!validISIN(row.ISIN))
        throw new Error(
          "A valid ISIN is required. A display ticker alone is not a security identifier.",
        );
      const quantity = decimal(row.Quantity, "Quantity");
      if (!quantity.gt(0))
        throw new Error(
          "Quantity must be positive; use Type to indicate the direction.",
        );
      const amount = decimal(row.Consideration, "Consideration");
      const fees = decimal(row.Fees, "Fees");
      // No currency guessing and no implicit pence-to-pounds or FX inversion.
      if (!currencies.has(row.Currency))
        throw new Error(
          "Use an ISO currency in major units; convert pence to pounds explicitly.",
        );
      const rate = decimal(row["GBP per unit"], "GBP per unit");
      if (!rate.gt(0) || (row.Currency === "GBP" && !rate.eq(1)))
        throw new Error(
          "Provide GBP per one unit of the source currency; GBP must use 1.",
        );
      const convertedAmount = amount.times(rate).toDP(12);
      const convertedFees = fees.times(rate).toDP(12);
      if (
        [quantity, convertedAmount, convertedFees].some((value) =>
          value.gte("1e26"),
        )
      ) {
        throw new Error(
          "A value exceeds the supported financial precision. Check the quantity, currency units and exchange rate.",
        );
      }
      if (
        (amount.gt(0) && convertedAmount.isZero()) ||
        (fees.gt(0) && convertedFees.isZero())
      ) {
        throw new Error(
          "A converted value is too small to preserve at 12 decimal places. Review the currency and exchange rate.",
        );
      }
      const sourceKey = hash(
        JSON.stringify([
          options.broker,
          options.accountId,
          row["Transaction ID"],
        ]),
      );
      const trade: Trade = {
        id: sourceKey,
        securityId: row.ISIN,
        date,
        side: row.Type,
        quantity: quantity.toString(),
        considerationGBP: convertedAmount.toFixed(),
        feesGBP: convertedFees.toFixed(),
      };
      const provenance = {
        originalCurrency: row.Currency,
        consideration: amount.toString(),
        fees: fees.toString(),
        gbpPerUnit: rate.toString(),
        ...(adapter
          ? {
              native: {
                format: adapter.version,
                fields: Object.fromEntries(
                  Object.keys(source)
                    .sort()
                    .map((key) => [key, source[key]!]),
                ),
                ordinarySharesConfirmed: true as const,
                ...(supportingDetails ? { supportingDetails } : {}),
              },
            }
          : {}),
      };
      const digest = hash(JSON.stringify({ trade, provenance }));
      const existing = seen.get(sourceKey);
      if (existing && existing !== digest) {
        issues.push({
          code: "DUPLICATE_CONFLICT",
          record,
          message:
            "The same transaction ID has different values. Review the correction instead of overwriting or skipping it.",
        });
        records.push({
          record,
          status: "needs_review",
          sourceKey,
          digest,
          reason: "Conflicting transaction ID.",
        });
      } else if (existing) {
        records.push({
          record,
          status: "duplicate",
          sourceKey,
          digest,
          reason: "This exact transaction has already been included.",
        });
      } else {
        seen.set(sourceKey, digest);
        records.push({
          record,
          ...detailMetadata,
          status: "accepted",
          sourceKey,
          digest,
          trade,
          provenance,
          reason: adapter
            ? "Trade amounts reconcile; ordinary-share classification and any supporting details confirmed by you."
            : "Validated against the canonical template.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid record.";
      issues.push({ code: "INVALID_ROW", record, message });
      records.push({
        record,
        ...detailMetadata,
        status: "needs_review",
        reason: message,
      });
    }
  });
  return finish(headers);
}

/** Must only receive a freshly server-generated review, never a posted client review. */
export function tradesFromReview(review: ImportReview): Trade[] {
  if (
    review.status !== "ready" ||
    review.issues.length ||
    review.records.some((r) => r.status === "needs_review")
  ) {
    throw new Error(
      "Resolve all import issues before committing any transactions.",
    );
  }
  return review.records.flatMap((record) =>
    record.status === "accepted" && record.trade ? [record.trade] : [],
  );
}

/** Safe for spreadsheet applications; apply to every text cell during CSV exports. */
export function csvCell(value: string): string {
  const escaped = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${escaped.replace(/"/g, '""')}"`;
}
