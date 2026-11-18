"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { BarChart3, Plus, Trash2, Calculator } from "lucide-react";
import type Decimal from "decimal.js";
import { Money } from "@/domain/values";
import { money } from "@/ui/format";
import { SaleAmounts } from "@/ui/sale-amounts";
import { CalculatorUploadLink } from "@/components/calculator-upload-link";
import { PublicNav } from "@/components/public-nav";
import { CalculatorFields } from "@/components/calculator-fields";
import { PublicFooter } from "@/components/public-footer";

interface PurchaseRow {
  id: number;
  date: string;
  quantity: string;
  pricePerShare: string;
  fees: string;
}

export default function Section104CalculatorPage() {
  const [rows, setRows] = useState<PurchaseRow[]>([
    { id: 1, date: "", quantity: "", pricePerShare: "", fees: "" },
  ]);
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellingFees, setSellingFees] = useState("");
  const [nextId, setNextId] = useState(2);

  const rowFocus = useRef<number | null>(null);
  const addRow = () => {
    rowFocus.current = nextId;
    setRows((prev) => [
      ...prev,
      { id: nextId, date: "", quantity: "", pricePerShare: "", fees: "" },
    ]);
    setNextId((n) => n + 1);
  };

  const removeRow = (id: number) => {
    const index = rows.findIndex((row) => row.id === id);
    rowFocus.current = (rows[index + 1] ?? rows[index - 1])?.id ?? null;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = useCallback(
    (id: number, field: keyof PurchaseRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const validDecimal = (value: string) => /^\d{1,12}(\.\d{1,8})?$/.test(value);
  const activeRows = rows.filter((row) =>
    [row.quantity, row.pricePerShare, row.date, row.fees].some(Boolean),
  );
  function missingFields(row: PurchaseRow) {
    const fields: string[] = [];
    if (!validDecimal(row.quantity) || !new Money(row.quantity).gt(0))
      fields.push("a positive quantity");
    if (!validDecimal(row.pricePerShare))
      fields.push("a valid price per share");
    if (row.fees && !validDecimal(row.fees)) fields.push("valid fees");
    return fields;
  }
  const incomplete = activeRows.some((row) => missingFields(row).length > 0);
  const poolRows = (incomplete ? [] : activeRows).map((r) => {
    const qty = new Money(r.quantity || 0);
    const price = new Money(r.pricePerShare || 0);
    const fees = new Money(r.fees || 0);
    const cost = qty.mul(price).plus(fees);
    return { ...r, decQty: qty, decCost: cost };
  });
  // Leave the inputs in entry order while presenting a chronological ledger.
  // ISO dates sort lexically. Undated purchases follow those with known dates.
  poolRows.sort((a, b) => {
    if (!a.date || !b.date) return Number(!!b.date) - Number(!!a.date);
    return a.date.localeCompare(b.date);
  });

  const poolState = poolRows.reduce<
    {
      date: string;
      qty: Decimal;
      cost: Decimal;
      totalShares: Decimal;
      totalCost: Decimal;
      avgCost: Decimal;
    }[]
  >((states, r) => {
    const previous = states.at(-1);
    const totalShares = (previous?.totalShares ?? new Money(0)).plus(
      r.decQty,
    );
    const totalCost = (previous?.totalCost ?? new Money(0)).plus(r.decCost);
    return [
      ...states,
      {
        date: r.date,
        qty: r.decQty,
        cost: r.decCost,
        totalShares,
        totalCost,
        avgCost: totalShares.isZero()
          ? new Money(0)
          : totalCost.div(totalShares),
      },
    ];
  }, []);
  const totalPoolShares = poolState.at(-1)?.totalShares ?? new Money(0);
  const totalPoolCost = poolState.at(-1)?.totalCost ?? new Money(0);
  const avgCostPerShare = totalPoolShares.isZero()
    ? new Money(0)
    : totalPoolCost.div(totalPoolShares);

  let quantityError = "";
  if (sellQty) {
    if (!validDecimal(sellQty) || new Money(sellQty).lte(0))
      quantityError = "Enter a positive quantity with up to 8 decimal places.";
    else if (!incomplete && !totalPoolShares.isZero() && new Money(sellQty).gt(totalPoolShares))
      quantityError = "Reduce the quantity to the available holding or add the missing purchase.";
  }
  const priceError = sellPrice && !validDecimal(sellPrice)
    ? "Enter a price of zero or more with up to 8 decimal places."
    : "";
  const feeError = sellingFees && !validDecimal(sellingFees)
    ? "Enter selling fees of zero or more with up to 12 whole digits and 8 decimal places."
    : "";
  let disposalResult = null;
  if (sellQty && sellPrice && !quantityError && !priceError && !feeError && totalPoolShares.gt(0)) {
    const quantity = new Money(sellQty);
    const gross = quantity.mul(sellPrice);
    const fees = new Money(sellingFees || 0);
    const matched = quantity.eq(totalPoolShares)
      ? totalPoolCost
      : totalPoolCost.mul(quantity).div(totalPoolShares);

    // The pool keeps full precision. The saved report reconciles net proceeds
    // and matched cost at the penny, including any sub-penny fee adjustment.
    const net = gross.minus(fees).toDP(2);
    const grossPence = gross.toDP(2);
    const feePence = fees.toDP(2);
    const matchedPence = matched.toDP(2);
    disposalResult = {
      net: net.toFixed(2),
      matched: matchedPence.toFixed(2),
      breakdown: {
        grossProceedsGBP: grossPence.toFixed(2),
        sellingCostsGBP: feePence.toFixed(2),
        totalAllowableCostsGBP: matchedPence.plus(feePence).toFixed(2),
        proceedsRoundingAdjustmentGBP: net.minus(grossPence.minus(feePence)).toFixed(2),
      },
      gainLoss: net.minus(matchedPence),
      remainingShares: totalPoolShares.minus(quantity),
      remainingCost: totalPoolCost.minus(matched),
    };
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <main id="main" className="max-w-4xl mx-auto px-4 py-8 sm:py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
          Section 104 Pool Calculator
        </h1>
        <p className="text-lg text-gray-600 mb-6 max-w-prose leading-relaxed">
          Enter purchases of the same ordinary share to see your average cost.
          Then try a sale matched entirely to the pool.
        </p>

        {/* Purchase rows */}
        <CalculatorFields
          label="Share purchases"
          className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8"
        >
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" /> Purchases
            </h2>

            <div className="space-y-4">
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Date (optional)
                    </label>
                    <input
                      type="date"
                      aria-label={`Date — purchase ${index + 1}`}
                      value={row.date}
                      onChange={(e) =>
                        updateRow(row.id, "date", e.target.value)
                      }
                      className="w-full min-w-0 box-border border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Quantity
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="100"
                      ref={(input) => {
                        if (input && rowFocus.current === row.id) {
                          rowFocus.current = null;
                          input.focus();
                        }
                      }}
                      aria-label={`Quantity — purchase ${index + 1}`}
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(row.id, "quantity", e.target.value)
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Price/share (£)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="3.50"
                      aria-label={`Price/share (£) — purchase ${index + 1}`}
                      value={row.pricePerShare}
                      onChange={(e) =>
                        updateRow(row.id, "pricePerShare", e.target.value)
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Fees (£)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      aria-label={`Fees (£) — purchase ${index + 1}`}
                      value={row.fees}
                      onChange={(e) =>
                        updateRow(row.id, "fees", e.target.value)
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-1 flex sm:justify-center">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        aria-label={`Remove purchase ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {activeRows.includes(row) &&
                    missingFields(row).length > 0 && (
                      <p
                        role="status"
                        className="sm:col-span-12 text-sm text-amber-800"
                      >
                        Purchase {index + 1} needs{" "}
                        {missingFields(row).join(" and ")}. The pool total will
                        appear when all purchases are complete.
                      </p>
                    )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add purchase
            </button>
          </div>

          {/* Pool summary */}
          {poolState.length > 0 && (
            <div className="bg-blue-50 border-t p-6 sm:p-8">
              <h3 className="font-bold text-gray-900 mb-4">Pool Summary</h3>
              {poolRows.some((row) => !row.date) && (
                <p className="mb-3 text-sm text-gray-700">
                  Undated purchases appear last, in the order you entered them.
                </p>
              )}
              <div
                role="region"
                aria-label="Purchase history and running pool balance"
                tabIndex={0}
                className="overflow-x-auto mb-6 not-prose rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <table className="w-full text-sm border bg-white rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                        Qty
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                        Cost
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                        Pool Shares
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                        Pool Cost
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                        Avg/Share
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {poolState.map((ps, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{ps.date || "Undated"}</td>
                        <td className="px-3 py-2 text-right">
                          {ps.qty.toFixed()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          £{ps.cost.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {ps.totalShares.toFixed()}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          £{ps.totalCost.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          £{ps.avgCost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 tabular-nums">
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    Total Shares
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {totalPoolShares.toFixed()}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    Total Cost
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    £{totalPoolCost.toFixed(2)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    Avg Cost/Share
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    £{avgCostPerShare.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CalculatorFields>

        {/* Disposal section */}
        <CalculatorFields
          label="Share disposal"
          className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-12"
        >
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-red-600" /> Disposal
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="sell-qty"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Quantity to sell
                </label>
                <input
                  id="sell-qty"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 100"
                  aria-invalid={Boolean(quantityError)}
                  aria-describedby={quantityError ? "sell-holding sell-qty-error" : "sell-holding"}
                  value={sellQty}
                  onChange={(e) => setSellQty(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 aria-invalid:border-red-700 aria-invalid:focus:ring-red-700 outline-none"
                />
                <p id="sell-holding" className="mt-1 text-sm text-gray-600">
                  {totalPoolShares.gt(0)
                    ? `${totalPoolShares.toFixed()} ${totalPoolShares.eq(1) ? "share" : "shares"} available in the pool.`
                    : "Complete your purchases to see how many shares are available."}
                </p>
                <p id="sell-qty-error" aria-live="polite" className="text-sm text-red-700">
                  {quantityError}
                </p>
              </div>
              <div>
                <label
                  htmlFor="sell-price"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Sale price per share (£)
                </label>
                <input
                  id="sell-price"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 4.20"
                  aria-invalid={Boolean(priceError)}
                  aria-describedby={priceError ? "sell-price-hint sell-price-error" : "sell-price-hint"}
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 aria-invalid:border-red-700 aria-invalid:focus:ring-red-700 outline-none"
                />
                <p id="sell-price-hint" className="mt-1 text-sm text-gray-600">
                  Use the price before selling fees.
                </p>
                <p id="sell-price-error" aria-live="polite" className="text-sm text-red-700">
                  {priceError}
                </p>
              </div>
              <div>
                <label htmlFor="sell-fees" className="block text-sm font-medium text-gray-700 mb-1">
                  Selling fees (£, optional)
                </label>
                <input
                  id="sell-fees"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={sellingFees}
                  onChange={(e) => setSellingFees(e.target.value)}
                  aria-invalid={Boolean(feeError)}
                  aria-describedby={feeError ? "sell-fees-error" : undefined}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 aria-invalid:border-red-700 aria-invalid:focus:ring-red-700 outline-none"
                />
                <p id="sell-fees-error" aria-live="polite" className="text-sm text-red-700">
                  {feeError}
                </p>
              </div>
            </div>
          </div>

          {disposalResult && (
            <div className="bg-gray-50 border-t p-6 sm:p-8 [overflow-wrap:anywhere]">
              <h3 className="font-bold text-gray-900 mb-4">Disposal Result</h3>
              <div className="bg-white rounded-xl p-4 border mb-4">
                <SaleAmounts
                  breakdown={disposalResult.breakdown}
                  net={disposalResult.net}
                  matched={disposalResult.matched}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    {disposalResult.gainLoss.gt(0) ? "Gain" : disposalResult.gainLoss.lt(0) ? "Loss" : "Break-even"}
                  </p>
                  <p className={`text-xl font-bold tabular-nums ${disposalResult.gainLoss.gt(0) ? "text-green-700" : disposalResult.gainLoss.lt(0) ? "text-red-700" : "text-gray-900"}`}>
                    {disposalResult.gainLoss.gt(0) ? "+" : ""}{money(disposalResult.gainLoss.toString())}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    Pool After Sale
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {disposalResult.remainingShares.toFixed()} {disposalResult.remainingShares.eq(1) ? "share" : "shares"}
                  </p>
                  <p className="text-sm text-gray-500">
                    £{disposalResult.remainingCost.toFixed(2)} cost
                  </p>
                </div>
              </div>
            </div>
          )}
        </CalculatorFields>

        {/* Explanatory content */}
        <div className="guide-article mb-12">
          <h2>How the Section 104 Pool Calculator Works</h2>
          <p>
            This calculator uses <strong>precise decimal arithmetic</strong>{" "}
            (the same library as our main CGT engine) to avoid floating-point
            rounding errors that can affect gain calculations. Each purchase you
            add increases the pool&apos;s total shares and total cost. The
            average cost per share is recalculated after each addition.
          </p>
          <p>
            Purchase fees are part of the pool cost. The matched acquisition cost
            is the proportion of that pool cost belonging to the shares sold.
            Selling fees reduce the sale proceeds and leave the remaining pool
            cost unchanged.
          </p>

          <h3>Worked Example</h3>
          <p>
            You buy 10 shares at £6 each and pay a £2 purchase fee. The pool
            holds 10 shares at a total cost of £62. You then sell all 10 at £10
            each and pay a £5 selling fee.
          </p>
          <ul>
            <li>Gross disposal proceeds are 10 × £10 = £100.</li>
            <li>Net sale proceeds are £100 − £5 = £95.</li>
            <li>Total allowable costs are £62 matched acquisition cost + £5 selling fees = £67.</li>
            <li>Your gain is £95 − £62 = <strong>£33</strong>. With no selling fee, the gain would be £38.</li>
          </ul>
          <p>
            For the full rules on how the Section 104 pool interacts with
            same-day and 30-day matching, read our{" "}
            <Link href="/guide/section-104-pool">
              comprehensive Section 104 guide
            </Link>
            .
          </p>
        </div>

        {/* CTA */}
        <section className="bg-blue-50 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Tracking multiple securities?
          </h2>
          <p className="text-gray-600 mb-6">
            Import supported ordinary-share trades, confirm your history and
            review each disposal against its matched acquisitions.
          </p>
          <CalculatorUploadLink />
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
