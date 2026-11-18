"use client";
import { useRef, useState, type FormEvent } from "react";
import type { ImportRecord } from "../domain/imports/review";
import type { SupportingDetails } from "../domain/imports/supporting-details";
import { Button, Field, Notice, SelectField } from "./primitives";
export function ImportDetailsForm({
  row,
  broker,
  busy,
  onSave,
  onDirty,
}: {
  row: ImportRecord;
  broker: string;
  busy: boolean;
  onSave: (record: number, details: SupportingDetails) => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const initial = row.supportingDetails;
  const source = row.source ?? {};
  const hlPence = broker === "hl" && "Unit cost (p)" in source;
  const ajPounds = broker === "ajbell" && "Amount (GBP)" in source;
  const fixedCurrency = hlPence || ajPounds;
  const fixedUnits = hlPence ? "minor" : ajPounds ? "major" : undefined;
  const [currency, setCurrency] = useState(
    initial?.currency ??
      (fixedCurrency
        ? "GBP"
        : source.CurrencyPrimary ||
          source["Instrument Currency"] ||
          source["Currency (Price / share)"] ||
          ""),
  );
  const [resetKey, setResetKey] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? "").trim();
    const details: SupportingDetails = {
      isin: text("isin"),
      currency: text("currency"),
      gbpPerUnit: text("gbpPerUnit"),
      fees: text("fees"),
      priceUnit: text("priceUnit") as "major" | "minor",
      transactionId: text("transactionId"),
      reference: text("reference"),
      netAmountConfirmed: values.get("netAmountConfirmed") === "on",
    };
    const errors: Record<string, string> = {};
    if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(details.isin))
      errors.isin = "Enter the 12-character ISIN from the statement.";
    if (!/^[A-Z]{3}$/.test(details.currency))
      errors.currency = "Enter the three-letter currency code.";
    if (
      !/^\d+(?:\.\d+)?$/.test(details.gbpPerUnit) ||
      Number(details.gbpPerUnit) <= 0
    )
      errors.gbpPerUnit = "Enter the positive trade-date rate.";
    if (!details.priceUnit)
      errors.priceUnit = "Confirm how the export quotes this price.";
    if (!/^\d+(?:\.\d+)?$/.test(details.fees))
      errors.fees = "Enter the verified fees, including zero if confirmed.";
    if (broker === "ajbell" && !details.transactionId)
      errors.transactionId = "Enter the unique execution reference.";
    if (details.reference.length < 8)
      errors.reference =
        "Describe your statement reference in at least 8 characters.";
    if (!details.netAmountConfirmed)
      errors.netAmountConfirmed = "Confirm the amounts against your statement.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      (
        form.current?.elements.namedItem(
          Object.keys(errors)[0],
        ) as HTMLElement | null
      )?.focus();
      return;
    }
    setError("");
    try {
      await onSave(row.record, details);

      onDirty(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Details could not be saved. Try again.",
      );
    }
  }
  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
      <details open className="my-3 min-w-0 text-sm">
        <summary>Original CSV values · record {row.record}</summary>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
          {Object.entries(row.source ?? {}).map(([key, value]) => (
            <div key={key} className="break-all">
              <dt className="font-semibold">{key}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </details>
      <form
        key={resetKey}
        ref={form}
        noValidate
        onSubmit={submit}
        onChange={() => {
          onDirty(true);
        }}
        className="form-stack"
      >
        {error && <Notice tone="error">{error}</Notice>}
        <div className="form-columns">
          <Field
            id={`isin-${row.record}`}
            name="isin"
            error={fieldErrors.isin}
            label="Verified ISIN"
            defaultValue={initial?.isin ?? row.source?.ISIN ?? ""}
            maxLength={12}
          />
          {fixedCurrency ? (
            <p className="caption">
              Export currency: GBP ·{" "}
              {hlPence ? "unit cost in pence" : "price in pounds"}.
            </p>
          ) : null}
          {fixedCurrency ? (
            <input type="hidden" name="currency" value="GBP" />
          ) : (
            <Field
              id={`currency-${row.record}`}
              name="currency"
              label="Trade currency"
              hint="ISO code, e.g. GBP or USD. Confirm the wallet currency."
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value.toUpperCase())
              }
              error={fieldErrors.currency}
              maxLength={3}
            />
          )}
          {currency === "GBP" ? (
            <input type="hidden" name="gbpPerUnit" value="1" />
          ) : (
            <Field
              id={`rate-${row.record}`}
              name="gbpPerUnit"
              error={fieldErrors.gbpPerUnit}
              label="GBP per currency unit"
              hint="Use 1 for GBP. For foreign trades, use the documented trade-date rate."
              defaultValue={initial?.gbpPerUnit ?? source.FXRateToBase ?? ""}
              inputMode="decimal"
            />
          )}
          {fixedUnits ? (
            <input type="hidden" name="priceUnit" value={fixedUnits} />
          ) : (
            <SelectField
              id={`unit-${row.record}`}
              name="priceUnit"
              error={fieldErrors.priceUnit}
              label="Price units in the export"
              defaultValue={initial?.priceUnit ?? ""}
            >
              <option value="">Choose verified units</option>
              <option value="major">Pounds / major currency units</option>
              <option value="minor">Pence / hundredths of currency unit</option>
            </SelectField>
          )}
          <Field
            id={`fees-${row.record}`}
            name="fees"
            error={fieldErrors.fees}
            label="Dealing fees and transaction taxes"
            hint="Total in the trade currency. Enter 0 only if the statement confirms no fees."
            defaultValue={initial?.fees ?? ""}
            inputMode="decimal"
          />
          {broker === "ajbell" && (
            <Field
              id={`execution-${row.record}`}
              name="transactionId"
              error={fieldErrors.transactionId}
              label="Execution reference if missing from export"
              hint="Required for AJ Bell's six-column layout. Use a unique contract-note reference."
              defaultValue={initial?.transactionId ?? ""}
              maxLength={200}
            />
          )}
        </div>
        <Field
          id={`evidence-${row.record}`}
          name="reference"
          error={fieldErrors.reference}
          label="Supporting statement or contract-note reference"
          hint="Describe the evidence you checked; do not enter account passwords or personal identifiers."
          defaultValue={initial?.reference ?? ""}
          maxLength={500}
        />
        <label className="checkbox-line">
          <input
            name="netAmountConfirmed"
            aria-invalid={!!fieldErrors.netAmountConfirmed}
            aria-describedby={
              fieldErrors.netAmountConfirmed ? "confirm-error" : undefined
            }
            type="checkbox"
            defaultChecked={initial?.netAmountConfirmed ?? false}
          />
          I checked the currency, ISIN, fees and price units. The export’s cash
          amount is net of these dealing fees.{" "}
          {broker === "ibkr" &&
            "I confirmed the statement base currency is GBP."}
        </label>
        {fieldErrors.netAmountConfirmed && (
          <small id="confirm-error" className="field-error">
            {fieldErrors.netAmountConfirmed}
          </small>
        )}
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setResetKey((k) => k + 1);
            setCurrency(
              initial?.currency ??
                (fixedCurrency
                  ? "GBP"
                  : source.CurrencyPrimary ||
                    source["Instrument Currency"] ||
                    source["Currency (Price / share)"] ||
                    ""),
            );
            setFieldErrors({});
            setError("");

            onDirty(false);
          }}
        >
          Reset unsaved details
        </Button>
        <Button type="submit" busy={busy}>
          {busy ? "Checking details…" : "Check and save supporting details"}
        </Button>
      </form>
    </div>
  );
}
