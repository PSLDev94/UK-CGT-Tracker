import { ExactAmount } from "../cgt/exact-amount";
import { validISIN } from "./isin";
export { validISIN } from "./isin";
import { ibkrExecution, sourceKey as executionKey } from "./ibkr-identity";
import { createHash } from "node:crypto";
import Papa from "papaparse";
import { calendarDate, decimal, Money } from "../values";
import type { Trade } from "../cgt/types";
import { BROKERS, type BrokerId } from "./brokers";
import { nativeAdapter, NATIVE_GUIDANCE } from "./native";
import {
  validateDetails,
  SupportingFieldError,
  StatementMismatchError,
  fingerprintDetails,
  type ImportDetails,
  type SupportingDetails,
} from "./supporting-details";
import { exportedTerms, type ExportedTerms } from "./exported-terms";
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
export const PARSER_VERSION = "canonical-v1.2.0";
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
  ibkrClientAccountId?: string | null;
  ibkrUnverifiedHistory?: boolean;
  ibkrOtherAccounts?: ReadonlyMap<string, string>;
  ibkrUnboundKeys?: ReadonlyMap<string, ReadonlySet<string>>;
  otherAccountExecutions?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  identicalStatementReceipt?: string;
  supportingDetails?: ImportDetails;
  /** Stable source key -> normalised-content digest, loaded server-side. */
  existing?: ReadonlyMap<string, string | SavedExecution>;
}

interface ExecutionAmounts {
  originalCurrency: string;
  consideration: string;
  fees: string;
  gbpPerUnit: string;
}

export interface SavedExecution {
  digest: string;
  supportingDetails?: SupportingDetails;
  trade?: Omit<Trade, "id">;
  native?: boolean;
  original?: ExecutionAmounts;
  instrumentGross?: string | null;
  instrumentPrice?: string | null;
}

// Freetrade and Trading 212 reconcile native orders in sterling cash. When a
// matched template supplies foreign amounts, compare the original instrument
// consideration, charges and evidenced rate as well as the sterling posting.
function evidencedAmounts(settlement: ExecutionAmounts, note: SupportingDetails | undefined,
  gross: string | null | undefined, price: string | null | undefined, qty: string): ExecutionAmounts | undefined {
  if (settlement.originalCurrency !== "GBP" || !note || note.currency === "GBP") return settlement;
  if (!gross && !price) return undefined;
  return { originalCurrency: note.currency, consideration: gross || new Money(price!).mul(qty).toFixed(),
    fees: note.fees, gbpPerUnit: note.gbpPerUnit };
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
  issueField?: keyof SupportingDetails;
  exportedTerms?: ExportedTerms;
  statementReference?: string;
  sourceKey?: string;
  digest?: string;
  executionReference?: string;
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
  revalidatesReceiptId?: string;
  ibkrClientAccountId?: string;
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

function hlPreambleRow(row: string[], dated: boolean) {
  const name = row[0]?.trim();
  const blankAfter = (index: number) => row.slice(index).every(value => !value.trim());
  if (dated && blankAfter(0)) return true;
  if (name === "Transaction Summary") return blankAfter(1);
  if (name === "Client Name:" || name === "Client Number:") return blankAfter(2);
  if (name !== "Valuation as at" || !blankAfter(2)) return false;
  const date = /^(\d{2})-(\d{2})-(\d{4}) (?:[01]\d|2[0-3]):[0-5]\d$/.exec(row[1]?.trim() ?? "");
  if (!date) return false;
  try {
    calendarDate(`${date[3]}-${date[2]}-${date[1]}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Server-side, pure preview. Nothing is written, guessed, or sent to an LLM.
 * The canonical template is an explicit interchange contract, NOT evidence that
 * any broker's native export is certified. Re-run this on the server at commit.
 */
export function reviewCsv(csv: string, options: ImportOptions): ImportReview {
  let parserVersion = PARSER_VERSION;
  let clientAccount = options.ibkrClientAccountId;
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
      ...(options.broker === "ibkr" && clientAccount && { ibkrClientAccountId: clientAccount }),
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
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(csv)
  ) {
    issues.push({
      code: "INVALID_FILE",
      message:
        "Provide a non-empty UTF-8 CSV of at most 10 MiB, without binary or unsupported control characters.",
    });
    return finish([]);
  }
  // Older recognised HL drafts counted nonempty CSV records. Dated valuation
  // summaries are a new format: preserve their blank pre-header record so
  // contract notes and transaction receipts point to the source record.
  const csvData = csv.replace(/^\uFEFF/, "");
  const datedHL = options.broker === "hl" && options.format === "native" &&
    /^Transaction Summary,/.test(csvData) && /^Valuation as at,/m.test(csvData);
  const parsed = Papa.parse<string[]>(csvData, {
    header: false,
    delimiter: ",",
    skipEmptyLines: datedHL ? false : "greedy",
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
      parsed.data.slice(0, candidate).every(row => hlPreambleRow(row, datedHL))
    )
      headerIndex = candidate;
  }
  const headers = (parsed.data[headerIndex] ?? []).map((value) => value.trim());
  const data = parsed.data.slice(headerIndex + 1);
  // A final line ending does not represent another activity.
  if (datedHL && data.at(-1)?.length === 1 && data.at(-1)?.[0] === "") data.pop();
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
        Number(key) < headerIndex + 2 || Number(key) > headerIndex + 1 + data.length,
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
        record: index + headerIndex + 2,
        status: "needs_review",
        reason: "Unverified CSV format; values have not been inferred.",
      }),
    );
    return finish(headers, true);
  }

  if (adapter) parserVersion = ["freetrade", "trading212"].includes(options.broker)
    ? adapter.version.replace(/-v1$/, "-v2") : adapter.version;
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
  const fileIds = new Set<string>();
  const idField = adapter?.idColumn ?? "Transaction ID";
  const idIndex = headers.indexOf(idField);
  if (idIndex >= 0) {
    for (const values of data) {
      const id = values[idIndex]?.trim();
      if (!id) continue;
      const isTrade = adapter ? adapter.isTrade(Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? ""])))
        : ["BUY", "SELL"].includes(values[headers.indexOf("Type")]?.trim() ?? "");
      if (!isTrade) continue;
      if (fileIds.has(id)) repeatedIds.add(id);
      fileIds.add(id);
    }
  }
  const seen = options.existing;
  const executionIds = new Set<string>();
  data.forEach((values, index) => {
    const record = index + headerIndex + 2; // CSV record number; quoted multi-line fields are one record.
    const source = Object.fromEntries(
      headers.map((header, i) => [header, values[i]?.trim() ?? ""]),
    );
    const entered = options.supportingDetails?.[String(record)];
    const isNativeTrade = !!adapter?.isTrade(source);
    const canSupplyDetails = isNativeTrade && options.ordinarySharesConfirmed === true &&
      values.length === headers.length && !repeatedIds.has(source[adapter!.idColumn]!) && (
        ["hl", "ii", "ajbell"].includes(options.broker) ||
        (options.broker === "ibkr" && source.CurrencyPrimary !== "GBP") ||
        (options.broker === "freetrade" && source["Instrument Currency"] !== "GBP") ||
        (options.broker === "trading212" && !["GBP", "GBX"].includes(source["Currency (Price / share)"] ?? ""))
      );
    const terms = canSupplyDetails ? exportedTerms(options.broker, source) : undefined;
    // These layouts quote instrument prices in explicit units. Older drafts
    // offered a unit switch that their native readers never applied.
    const sourceUnits = ["freetrade", "ibkr", "trading212"].includes(options.broker);
    const supportingDetails = entered && sourceUnits && terms
      ? { ...entered, priceUnit: terms.priceUnit ?? entered.priceUnit, fees: terms.feesInCurrency ?? entered.fees }
      : entered;
    const detailMetadata = adapter ? { source, supportingDetails, exportedTerms: terms, canSupplyDetails } : {};
    try {
      if (options.identicalStatementReceipt)
        throw new Error(`This statement is already saved on ${options.identicalStatementReceipt}. Review that receipt or ask support to verify separate broker accounts against the statements.`);
      if (values.length !== headers.length)
        throw new Error(
          "The record has a different number of fields from the header.",
        );
      if ((isNativeTrade || (!adapter && ["BUY", "SELL"].includes(source.Type!))) && repeatedIds.has(source[idField]!)) {
        const message = adapter
          ? "This native file repeats a trade ID. It may contain several executions or duplicate rows; review it before importing."
          : "This template repeats a transaction ID within the file. Verify each fill using its broker execution reference, remove a line only if the statement confirms it is a duplicate, or use an evidenced order total including all fills and fees.";
        issues.push({ code: "DUPLICATE_CONFLICT", record, message });
        records.push({ record, ...detailMetadata, status: "needs_review", reason: message });
        return;
      }
      if (isNativeTrade && options.ordinarySharesConfirmed !== true)
        throw new Error(
          "Confirm that every traded instrument in this file is an ordinary share. If your broker evidence confirms this, discard the preview, select the file again and tick the ordinary-share confirmation. If you are unsure, leave the file in review.",
        );
      if (detailMetadata.canSupplyDetails && sourceUnits && terms) {
        const problem = !validISIN(terms.isin ?? "") ? "The exported ISIN is missing or invalid."
          : !currencies.has(terms.currency ?? "") ? "The instrument currency must be a supported ISO currency."
          : terms.sourceIssue;
        if (problem) {
          detailMetadata.canSupplyDetails = false;
          throw new Error(`${problem} Check this row against the original broker statement.`);
        }
      }
      const row = (
        adapter ? adapter.normalize(source, supportingDetails) : source
      ) as Record<(typeof CANONICAL_HEADERS)[number], string>;
      if (adapter && row.Type === "NON_TRANSACTION_DOCUMENT") {
        records.push({
          record,
          status: "excluded",
          reason:
            "Statement notification only: no trade, quantity or cash values. Excluded from share gains.",
        });
        return;
      }
      if (
        [
          "CASH_DEPOSIT",
          "CASH_WITHDRAWAL",
          "CASH_DIVIDEND",
          "CASH_INTEREST",
        ].includes(row.Type)
      ) {
        if (!adapter) {
          const nonzero = (field: "Quantity" | "Fees") => row[field] && !decimal(row[field], field).isZero();
          if (row.Type === "CASH_DIVIDEND" && ((row.ISIN && !validISIN(row.ISIN)) ||
            (row["Asset type"] && row["Asset type"] !== "ORDINARY_SHARE")))
            throw new Error("Check the dividend's instrument and ISIN before treating it as cash income.");
          if (nonzero("Quantity") || nonzero("Fees") ||
            (row.Type !== "CASH_DIVIDEND" && (row.ISIN || row["Asset type"]))) {
            throw new Error("A cash-only record contains share or dealing-cost details. Check the activity on your statement before excluding it.");
          }
        }
        records.push({
          record,
          status: "excluded",
          source,
          reason: `${row.Type}: excluded from share gains; income tax is outside this calculation.`,
        });
        return;
      }
      if (adapter && options.ordinarySharesConfirmed !== true)
        throw new Error("Check this activity against the original broker statement before importing.");
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
      if (!validISIN(row.ISIN)) {
        if (supportingDetails && !terms?.isin)
          throw new SupportingFieldError("isin", "Check all 12 characters of the ISIN, including the final check digit, against your contract note.");
        throw new Error(
          "A valid ISIN is required. A display ticker alone is not a security identifier.",
        );
      }
      const quantity = decimal(row.Quantity, "Quantity");
      if (!quantity.gt(0))
        throw new Error(
          "Quantity must be positive; use Type to indicate the direction.",
        );
      const amount = decimal(row.Consideration, "Consideration");
      if (amount.isZero()) throw new Error("Zero consideration may represent a gift, transfer or negligible-value claim. Verify the tax basis with a specialist before importing this event.");
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
      // Both source operands have at most twelve decimal places. Multiplication
      // must retain all of them until the calculated disposal is rounded.
      const exactRate = ExactAmount.from(rate.toFixed());
      const convert = (source: typeof amount) =>
        new Money(ExactAmount.from(source.toFixed()).times(exactRate).toFixed(24));
      const convertedAmount = convert(amount);
      const convertedFees = convert(fees);
      if (
        [quantity, convertedAmount, convertedFees].some((value) =>
          value.gte("1e26"),
        )
      ) {
        throw new Error(
          "A value exceeds the supported financial precision. Check the quantity, currency units and exchange rate.",
        );
      }
      let transactionId = row["Transaction ID"];
      let ibkrTradeId: string | undefined;
      if (options.broker === "ibkr") {
        if (options.ibkrUnverifiedHistory)
          throw new Error("This account has older IBKR template trades without a verified ClientAccountID. Review and reverse those imports, then re-import them with ClientAccountID:TradeID from the Flex statement.");
        const { external, execution } = ibkrExecution(transactionId, clientAccount);
        if (options.ibkrOtherAccounts?.has(external))
          throw new Error("This IBKR ClientAccountID is already associated with another broker account in your portfolio. Choose that account to review this export.");
        for (const [other, keys] of options.ibkrUnboundKeys ?? []) {
          if (keys.has(executionKey("ibkr", other, execution)) || keys.has(executionKey("ibkr", other, external + ":" + execution)))
            throw new Error("This execution may already exist on a differently labelled IBKR account. Review the original receipt and resolve the account identity before saving.");
        }
        clientAccount = external;
        ibkrTradeId = execution;
        transactionId = external + ":" + execution;
      }
      if (executionIds.has(transactionId))
        throw new Error("An execution reference is repeated within this file. Verify individual fills on the statement before saving.");
      executionIds.add(transactionId);
      for (const [otherAccount, keys] of options.otherAccountExecutions ?? []) {
        const receipt = keys.get(executionKey(options.broker, otherAccount, transactionId));
        if (receipt) throw new Error(`This execution overlaps ${receipt}. Select that account for a cumulative statement or ask support to verify the original statements for separate accounts.`);
      }
      const sourceKey = executionKey(options.broker, options.accountId, transactionId);
      const trade: Trade = {
        id: sourceKey,
        securityId: row.ISIN,
        date,
        side: row.Type,
        quantity: quantity.toFixed(),
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
                ...(supportingDetails
                  ? { supportingDetails: fingerprintDetails(supportingDetails) }
                  : {}),
              },
            }
          : {}),
      };
      const native = provenance.native;
      const note = native?.supportingDetails;
      function digestWith(details: SupportingDetails) {
        return hash(JSON.stringify({ trade, provenance: {
          ...provenance, native: { ...native, supportingDetails: fingerprintDetails(details) },
        } }));
      }
      // The original broker row, execution identity, normalized trade and all
      // material supporting fields stay in the fingerprint. Evidence labels
      // describe a document; changing that label does not amend an execution.
      const materialDetails = (d: SupportingDetails): SupportingDetails => ({
        ...d, reference: "", transactionId: options.broker === "ajbell" ? d.transactionId : "",
        priceUnit: sourceUnits ? terms?.priceUnit ?? d.priceUnit : d.priceUnit,
        fees: decimal(terms?.feesInCurrency ?? d.fees, "Fees").toFixed(),
        gbpPerUnit: decimal(d.gbpPerUnit, "GBP per unit").toFixed(),
      });
      const digest = note ? digestWith(materialDetails(note)) : hash(JSON.stringify({ trade, provenance }));
      // Older IBKR template records were hashed without the broker account ID.
      const current = seen?.get(sourceKey);
      const saved = current ?? (ibkrTradeId
        ? seen?.get(executionKey("ibkr", options.accountId, ibkrTradeId)) : undefined);
      const savedDigest = typeof saved === "string" ? saved : saved?.digest;
      let matches = savedDigest === digest;
      const crossFormat = typeof saved === "object" && saved.native !== !!adapter;
      // Earlier template versions used a different fixed-point or FX precision.
      const templateReplay = !adapter && typeof saved === "object" && !saved.native;
      let difference = "";
      if (!matches && typeof saved === "object" && saved.trade && saved.original && (crossFormat || templateReplay)) {
        const previous = saved.trade;
        const savedAmounts = evidencedAmounts(saved.original, saved.supportingDetails,
          saved.instrumentGross, saved.instrumentPrice, previous.quantity);
        const submitted = evidencedAmounts(provenance, note,
          source["Total Shares Amount"] || source["Total Amount in Instrument Currency"],
          source["Price / share"], trade.quantity);
        const differences = [
          previous.date !== date && "trade date",
          previous.side !== trade.side && "direction",
          previous.securityId !== trade.securityId && "ISIN",
          !new Money(previous.quantity).eq(quantity) && "quantity",
          !new Money(previous.considerationGBP).eq(convertedAmount) && "GBP consideration",
          !new Money(previous.feesGBP).eq(convertedFees) && "GBP fees",
          (!savedAmounts || !submitted) && "unverified original amounts",
          savedAmounts && submitted && savedAmounts.originalCurrency !== submitted.originalCurrency && "currency",
          savedAmounts && submitted && !new Money(savedAmounts.consideration).eq(submitted.consideration) && "original consideration",
          savedAmounts && submitted && !new Money(savedAmounts.fees).eq(submitted.fees) && "original fees",
          savedAmounts && submitted && !new Money(savedAmounts.gbpPerUnit).eq(submitted.gbpPerUnit) && "exchange rate",
        ].filter(Boolean);
        matches = !differences.length;
        difference = differences.join(", ");
      }
      const previous = typeof saved === "object" && saved.supportingDetails;
      // Older saves hashed the complete note. Recreate their exact hash using
      // its saved spelling, only after the two financial declarations agree.
      if (!matches && previous && note && digestWith(materialDetails(previous)) === digest) {
        matches = digestWith(previous) === savedDigest;
      }
      if (saved && !matches) {
        issues.push({
          code: "DUPLICATE_CONFLICT",
          record,
          message: difference
            ? `The same transaction ID has different values for ${difference}. Check both records against the original execution.`
            : "The same transaction ID has different values. Review the correction instead of overwriting or skipping it.",
        });
        records.push({
          record,
          status: "needs_review",
          sourceKey,
          digest,
          reason: "Conflicting transaction ID.",
        });
      } else if (saved) {
        records.push({
          record,
          status: "duplicate",
          sourceKey,
          digest,
          ...(note && { statementReference: note.reference }),
          reason: "This transaction has already been included.",
        });
      } else {
        records.push({
          record,
          ...detailMetadata,
          status: "accepted",
          sourceKey,
          digest,
          executionReference: ibkrTradeId || (adapter && source[adapter.idColumn]) || row["Transaction ID"],
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
      if (error instanceof StatementMismatchError) detailMetadata.canSupplyDetails = false;
      issues.push({ code: "INVALID_ROW", record, message });
      records.push({
        record,
        ...detailMetadata,
        status: "needs_review",
        reason: message,
        ...(error instanceof SupportingFieldError && { issueField: error.field }),
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
