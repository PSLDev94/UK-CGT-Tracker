"use client";
import { useRef, useState, type FormEvent } from "react";
import type { ImportRecord } from "../domain/imports/review";
import { sourceIdentity } from "../domain/imports/source-identity";
import type { SupportingDetails } from "../domain/imports/supporting-details";
import { validISIN } from "../domain/imports/isin";
import { Money } from "../domain/values";
import { feesInTradeCurrency } from "../domain/imports/exported-terms";
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
  onSave: (
    record: number,
    details: SupportingDetails,
  ) => Promise<ImportRecord | undefined>;
  onDirty: (dirty: boolean) => void;
}) {
  const [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const alert = useRef<HTMLDivElement>(null);
  const initial = row.supportingDetails;
  const terms = row.exportedTerms ?? {};
  const initialCurrency = terms.currency ?? initial?.currency ?? "";
  const [currency, setCurrency] = useState(initialCurrency);
  const exportedFees =
    terms.feesGBP !== undefined || terms.feesInCurrency !== undefined;
  const savedIssue = initial && row.status === "needs_review" ? row.reason : "";
  const feeIssue = !exportedFees && row.issueField === "fees" ? savedIssue : "";
  const isinIssue = !terms.isin && row.issueField === "isin" ? savedIssue : "";
  const [resetKey, setResetKey] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? "").trim();
    const details: SupportingDetails = {
      isin: text("isin").toUpperCase(),
      currency: text("currency"),
      gbpPerUnit: text("gbpPerUnit"),
      fees: feesInTradeCurrency(terms, text("gbpPerUnit")) ?? text("fees"),
      priceUnit: text("priceUnit") as "major" | "minor",
      transactionId: text("transactionId"),
      reference: text("reference"),
      netAmountConfirmed: values.get("netAmountConfirmed") === "on",
      ...(broker === "ibkr" && { statementBaseCurrency: text("statementBaseCurrency").toUpperCase() }),
    };
    const errors: Record<string, string> = {};
    if (!validISIN(details.isin))
      errors.isin = "Check all 12 characters of the ISIN, including the final check digit, against your contract note.";
    if (!/^[A-Z]{3}$/.test(details.currency))
      errors.currency = "Enter the three-letter currency code.";
    if (
      !/^\d+(?:\.\d+)?$/.test(details.gbpPerUnit) ||
      Number(details.gbpPerUnit) <= 0
    )
      errors.gbpPerUnit = "Enter the positive trade-date rate.";
    if (broker === "ibkr" && details.statementBaseCurrency !== "GBP")
      errors.statementBaseCurrency = "Read the account base currency from your statement. This Flex layout requires GBP.";
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
      const field = form.current?.elements.namedItem(
        Object.keys(errors)[0]!,
      ) as HTMLInputElement | null;
      if (field && field.type !== "hidden") field.focus();
      else
        setError(
          "The exported trade details are incomplete or invalid. Check the original CSV values against the broker statement and review a corrected file.",
        );
      return;
    }
    setError("");
    try {
      const unresolved = await onSave(row.record, details);
      if (unresolved) {
        requestAnimationFrame(() => {
          const field =
            unresolved.issueField &&
            form.current?.elements.namedItem(unresolved.issueField);
          if (field instanceof HTMLInputElement && field.type !== "hidden")
            field.focus();
          else alert.current?.focus();
        });
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Details could not be saved. Try again.",
      );
    }
  }
  const { description, date, executionReference } = sourceIdentity(row.source);
  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
      <div className="min-w-0 lg:col-span-2 [overflow-wrap:anywhere]">
        {description && <p className="font-semibold">{description}</p>}
        {date && <p>Trade date · {date}</p>}
        {executionReference && (
          <p>Execution reference · {executionReference}</p>
        )}
        {terms.isin ? (
          <p className="caption">
            Prices in {terms.currency}{terms.accountCurrency && ` · Account currency ${terms.accountCurrency}`}.
          </p>
        ) : (
          terms.currency && (
            <p className="caption">
              Export currency: {terms.currency} ·{" "}
              {terms.priceUnit === "minor" ? "unit cost in pence" : "price in pounds"}.
            </p>
          )
        )}
        {!initial && <p>{row.reason}</p>}
      </div>
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
        {(error || (savedIssue && !feeIssue && !isinIssue && row.issueField !== "statementBaseCurrency")) && (
          <div ref={alert} tabIndex={-1}>
            <Notice tone="error">{error || savedIssue}</Notice>
          </div>
        )}
        <div className="form-columns items-start">
          {terms.isin ? (
            <input type="hidden" name="isin" value={terms.isin} />
          ) : (
            <Field
              id={`isin-${row.record}`}
              name="isin"
              error={fieldErrors.isin || isinIssue}
              label="Verified ISIN"
              defaultValue={initial?.isin ?? ""}
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
            />
          )}
          {terms.currency ? (
            <input type="hidden" name="currency" value={terms.currency} />
          ) : (
            <Field
              id={`currency-${row.record}`}
              name="currency"
              label="Trade currency"
              hint={
                broker === "ii"
                  ? "Use the currency of the debit or credit in your investment account."
                  : "Use the three-letter currency code on the contract note."
              }
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value.toUpperCase())
              }
              error={fieldErrors.currency}
              maxLength={3}
            />
          )}
          {broker === "ibkr" && (
            <Field id={`base-currency-${row.record}`} name="statementBaseCurrency" label="Statement base currency"
              hint="Use the account base currency on the statement, separate from the currency of the shares."
              defaultValue={initial?.statementBaseCurrency ?? ""} maxLength={3} autoCapitalize="characters"
              error={fieldErrors.statementBaseCurrency || (row.issueField === "statementBaseCurrency" ? savedIssue : undefined)} />
          )}
          {terms.gbpPerUnit || currency === "GBP" ? (
            <input
              type="hidden"
              name="gbpPerUnit"
              value={terms.gbpPerUnit ?? "1"}
            />
          ) : (
            <Field
              id={`rate-${row.record}`}
              name="gbpPerUnit"
              error={fieldErrors.gbpPerUnit}
              label="GBP per currency unit"
              hint="Use the trade-date rate from your statement."
              defaultValue={initial?.gbpPerUnit ?? ""}
              inputMode="decimal"
            />
          )}
          {terms.priceUnit ? (
            <input type="hidden" name="priceUnit" value={terms.priceUnit} />
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
              <option value="minor">
                Pence / hundredths of currency unit
              </option>
            </SelectField>
          )}
          {!exportedFees && (
            <Field
              id={`fees-${row.record}`}
              name="fees"
              error={fieldErrors.fees || feeIssue}
              label="Dealing fees and transaction taxes"
              hint="Enter the trade-specific charges you actually paid, in the trade currency. Exclude account or portfolio management fees. Enter 0 only if the statement confirms no fees."
              defaultValue={initial?.fees ?? ""}
              inputMode="decimal"
            />
          )}
          {broker === "ajbell" && (
            <Field
              id={`execution-${row.record}`}
              name="transactionId"
              error={fieldErrors.transactionId}
              label="Execution reference if missing from export"
              hint="Use the unique execution reference from your AJ Bell contract note."
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
          hint="Use a reference you can find again on your statement or contract note."
          defaultValue={initial?.reference ?? ""}
          maxLength={500}
        />
        {terms.isin && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt>ISIN</dt>
            <dd>{terms.isin}</dd>
            {terms.accountCurrency && (
              <>
                <dt>Account currency</dt>
                <dd>{terms.accountCurrency}</dd>
              </>
            )}
            <dt>Instrument currency</dt>
            <dd>{terms.currency}</dd>
            <dt>Price per share</dt>
            <dd>
              {row.source?.["Price per Share"] ||
                row.source?.["Price / share"] ||
                row.source?.TradePrice}{" "}
              {terms.currency}
            </dd>
            {terms.fxRateToBase && (
              <><dt>FX rate to account base</dt><dd>{terms.fxRateToBase}</dd></>
            )}
            {terms.gbpPerUnit && (
              <>
                <dt>Conversion</dt>
                <dd>
                  £{terms.gbpPerUnit} per {terms.currency}
                </dd>
              </>
            )}
            {terms.feesGBP !== undefined && (
              <>
                <dt>Fees in GBP</dt>
                <dd>£{new Money(terms.feesGBP).toFixed(2)}</dd>
              </>
            )}
            {terms.feesInCurrency !== undefined && (
              <>
                <dt>Fees in {terms.currency}</dt>
                <dd>{terms.feesInCurrency}</dd>
              </>
            )}
          </dl>
        )}
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
          I checked the currency, ISIN, fees and price units. The export’s
          cash amount is net of these dealing fees.{" "}
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
            setCurrency(initialCurrency);
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
      <details className="min-w-0 text-sm">
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
    </div>
  );
}
