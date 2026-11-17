"use client";
import { useRef, useState, type FormEvent } from "react";
import type { ImportRecord } from "../domain/imports/review";
import type { SupportingDetails } from "../domain/imports/supporting-details";
import { Button, Field, Notice, SelectField } from "./primitives";
export function ImportDetailsForm({
  row,
  busy,
  onSave,
  onDirty,
}: {
  row: ImportRecord;
  busy: boolean;
  onSave: (record: number, details: SupportingDetails) => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const initial = row.supportingDetails;
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
    const missing = [
      "isin",
      "currency",
      "gbpPerUnit",
      "fees",
      "priceUnit",
      "reference",
    ].find((key) => !text(key));
    if (
      missing ||
      !details.netAmountConfirmed ||
      details.reference.length < 8
    ) {
      setError(
        "Complete the supporting fields, provide a statement reference of at least 8 characters and confirm the amounts.",
      );
      (
        form.current?.elements.namedItem(
          missing ?? "reference",
        ) as HTMLElement | null
      )?.focus();
      return;
    }
    setError("");
    setSaved(false);
    try {
      await onSave(row.record, details);
      setSaved(true);
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
    <details className="mt-3">
      <summary className="cursor-pointer text-blue-700">
        Supply or review supporting details for record {row.record}
      </summary>
      <div className="my-3 text-sm">
        <p>
          Use the original execution contract note or statement. This step
          cannot fix corporate actions or missing acquisition history.
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
          {Object.entries(row.source ?? {}).map(([key, value]) => (
            <div key={key} className="break-all">
              <dt className="font-semibold">{key}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <form
        ref={form}
        noValidate
        onSubmit={submit}
        onChange={() => {
          onDirty(true);
          setSaved(false);
        }}
        className="form-stack"
      >
        {error && <Notice tone="error">{error}</Notice>}
        {saved && (
          <Notice>
            Supporting details saved. Review the updated record outcome before
            saving transactions.
          </Notice>
        )}
        <div className="form-columns">
          <Field
            id={`isin-${row.record}`}
            name="isin"
            label="Verified ISIN"
            defaultValue={initial?.isin ?? row.source?.ISIN ?? ""}
            maxLength={12}
          />
          <Field
            id={`currency-${row.record}`}
            name="currency"
            label="Trade currency"
            hint="ISO code, e.g. GBP or USD. Confirm the wallet currency."
            defaultValue={
              initial?.currency ?? row.source?.CurrencyPrimary ?? ""
            }
            maxLength={3}
          />
          <Field
            id={`rate-${row.record}`}
            name="gbpPerUnit"
            label="GBP per currency unit"
            hint="Use 1 for GBP. For foreign trades, use the documented trade-date rate."
            defaultValue={initial?.gbpPerUnit ?? ""}
            inputMode="decimal"
          />
          <SelectField
            id={`unit-${row.record}`}
            name="priceUnit"
            label="Price units in the export"
            defaultValue={initial?.priceUnit ?? ""}
          >
            <option value="">Choose verified units</option>
            <option value="major">Pounds / major currency units</option>
            <option value="minor">Pence / hundredths of currency unit</option>
          </SelectField>
          <Field
            id={`fees-${row.record}`}
            name="fees"
            label="Dealing fees and transaction taxes"
            hint="Total in the trade currency. Enter 0 only if the statement confirms no fees."
            defaultValue={initial?.fees ?? ""}
            inputMode="decimal"
          />
          <Field
            id={`execution-${row.record}`}
            name="transactionId"
            label="Execution reference if missing from export"
            hint="Required for AJ Bell's six-column layout. Use a unique contract-note reference."
            defaultValue={initial?.transactionId ?? ""}
            maxLength={200}
          />
        </div>
        <Field
          id={`evidence-${row.record}`}
          name="reference"
          label="Supporting statement or contract-note reference"
          hint="Describe the evidence you checked; do not enter account passwords or personal identifiers."
          defaultValue={initial?.reference ?? ""}
          maxLength={500}
        />
        <label className="checkbox-line">
          <input
            name="netAmountConfirmed"
            type="checkbox"
            defaultChecked={initial?.netAmountConfirmed ?? false}
          />
          I checked the currency, ISIN, fees and price units. The export’s cash
          amount is net of these dealing fees. For IBKR foreign trades, I
          confirmed the statement base currency is GBP.
        </label>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            form.current?.reset();
            setError("");
            setSaved(false);
            onDirty(false);
          }}
        >
          Reset unsaved details
        </Button>
        <Button type="submit" busy={busy}>
          {busy ? "Checking details…" : "Check and save supporting details"}
        </Button>
      </form>
    </details>
  );
}
