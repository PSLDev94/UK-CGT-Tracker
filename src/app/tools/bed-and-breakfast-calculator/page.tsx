"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import Link from "next/link";
import { Calculator, ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { CalculatorFields } from "@/components/calculator-fields";
import { PublicFooter } from "@/components/public-footer";

export default function BedAndBreakfastCalculatorPage() {
  const [sellDate, setSellDate] = useState("");
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyDate, setBuyDate] = useState("");
  const [buyQty, setBuyQty] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [result, setResult] = useState<null | {
    isMatch: boolean;
    daysBetween: number;
    matchedQty: Decimal;
    proceeds: Decimal;
    cost: Decimal;
    gainLoss: Decimal;
  }>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState(false);
  const calculate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    setEdited(false);
    const next: Record<string, string> = {};
    for (const [id, value, label] of [
      ["sell-date", sellDate, "sale date"],
      ["sell-qty", sellQty, "quantity sold"],
      ["sell-price", sellPrice, "sale price"],
      ["buy-date", buyDate, "repurchase date"],
      ["buy-qty", buyQty, "quantity repurchased"],
      ["buy-price", buyPrice, "repurchase price"],
    ]) {
      if (id.endsWith("-date")) {
        if (!value || !Number.isFinite(Date.parse(value)))
          next[id] = `Enter the ${label}.`;
      } else if (
        !/^\d{1,12}(\.\d{1,8})?$/.test(value) ||
        (id.endsWith("-qty") && new Decimal(value).isZero())
      ) {
        next[id] =
          `Enter the ${label} as ${id.endsWith("-qty") ? "a positive number" : "zero or a positive number"} with up to 8 decimal places.`;
      }
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      requestAnimationFrame(() => document.getElementById(first)?.focus());
      return;
    }
    const diffMs = Date.parse(buyDate) - Date.parse(sellDate);
    const daysBetween = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const sQty = new Decimal(sellQty);
    const sPrice = new Decimal(sellPrice);
    const bQty = new Decimal(buyQty);
    const bPrice = new Decimal(buyPrice);

    const isMatch = daysBetween > 0 && daysBetween <= 30;
    const matchedQty = isMatch ? Decimal.min(sQty, bQty) : new Decimal(0);
    const proceeds = matchedQty.mul(sPrice);
    const cost = matchedQty.mul(bPrice);
    const gainLoss = proceeds.minus(cost);

    setResult({ isMatch, daysBetween, matchedQty, proceeds, cost, gainLoss });
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the 30-day bed and breakfast rule?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "If you sell shares and repurchase the same shares within 30 calendar days, HMRC matches the disposal against the new purchase cost rather than your Section 104 pool cost. This prevents investors from crystallising artificial losses.",
        },
      },
      {
        "@type": "Question",
        name: "Does the bed and breakfast rule apply to ISA shares?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Shares within an ISA are exempt from CGT. Purchases within an ISA are not matched with disposals outside that ISA.",
        },
      },
      {
        "@type": "Question",
        name: "How do I avoid triggering the bed and breakfast rule?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Wait at least 31 calendar days before repurchasing. Alternatively, use bed-and-ISA or bed-and-spouse strategies which are legitimate under HMRC rules.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <PublicNav />

      <main id="main" className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
          Bed &amp; Breakfast Rule Calculator
        </h1>
        <p className="text-lg text-gray-600 mb-2 max-w-3xl leading-relaxed">
          HMRC&apos;s 30-day bed and breakfast rule prevents investors from
          selling shares to crystallise a loss and immediately buying them back.
          If you sell shares and repurchase the{" "}
          <strong>same security within 30 calendar days</strong>, the disposal
          is matched against the repurchase — not your Section 104 pool. This
          often reduces or eliminates the tax loss you were trying to claim.
        </p>
        <p className="text-gray-600 mb-8 max-w-3xl leading-relaxed">
          Use this free calculator to check if a specific sell-and-rebuy
          transaction triggers the B&amp;B rule. Enter the details below to see
          your actual gain or loss based on the matched repurchase cost.
        </p>

        {/* Calculator */}
        <CalculatorFields
          label="30-day share matching"
          className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-12"
        >
          <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
          <form
            noValidate
            onSubmit={calculate}
            onChange={(event) => {
              if (result) setEdited(true);
              setResult(null);
              const id =
                event.target instanceof HTMLInputElement ? event.target.id : "";
              if (errors[id])
                setErrors((previous) => {
                  const remaining = { ...previous };
                  delete remaining[id];
                  return remaining;
                });
            }}
            className="p-6 sm:p-8 overflow-hidden"
          >
            <div className="grid sm:grid-cols-2 gap-8">
              {/* Sell side */}
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-sm font-bold text-red-700">
                    S
                  </span>
                  Sale Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="sell-date"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Date of sale
                    </label>
                    <input
                      id="sell-date"
                      aria-invalid={Boolean(errors["sell-date"])}
                      aria-describedby={
                        errors["sell-date"] ? "sell-date-error" : undefined
                      }
                      type="date"
                      required
                      value={sellDate}
                      onChange={(e) => setSellDate(e.target.value)}
                      className="w-full min-w-0 box-border border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                    {errors["sell-date"] && (
                      <p
                        id="sell-date-error"
                        className="mt-1 text-sm text-red-700"
                      >
                        {errors["sell-date"]}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="sell-qty"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Shares sold
                    </label>
                    <input
                      id="sell-qty"
                      aria-invalid={Boolean(errors["sell-qty"])}
                      aria-describedby={
                        errors["sell-qty"] ? "sell-qty-error" : undefined
                      }
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={sellQty}
                      onChange={(e) => setSellQty(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                    {errors["sell-qty"] && (
                      <p
                        id="sell-qty-error"
                        className="mt-1 text-sm text-red-700"
                      >
                        {errors["sell-qty"]}
                      </p>
                    )}
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
                      aria-invalid={Boolean(errors["sell-price"])}
                      aria-describedby={
                        errors["sell-price"] ? "sell-price-error" : undefined
                      }
                      type="number"
                      step="any"
                      min="0.0001"
                      required
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="e.g. 2.50"
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                    {errors["sell-price"] && (
                      <p
                        id="sell-price-error"
                        className="mt-1 text-sm text-red-700"
                      >
                        {errors["sell-price"]}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Buy side */}
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-sm font-bold text-green-700">
                    B
                  </span>
                  Repurchase Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="buy-date"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Date of repurchase
                    </label>
                    <input
                      id="buy-date"
                      aria-invalid={Boolean(errors["buy-date"])}
                      aria-describedby={
                        errors["buy-date"] ? "buy-date-error" : undefined
                      }
                      type="date"
                      required
                      value={buyDate}
                      onChange={(e) => setBuyDate(e.target.value)}
                      className="w-full min-w-0 box-border border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                    {errors["buy-date"] && (
                      <p
                        id="buy-date-error"
                        className="mt-1 text-sm text-red-700"
                      >
                        {errors["buy-date"]}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="buy-qty"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Shares repurchased
                    </label>
                    <input
                      id="buy-qty"
                      aria-invalid={Boolean(errors["buy-qty"])}
                      aria-describedby={
                        errors["buy-qty"] ? "buy-qty-error" : undefined
                      }
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={buyQty}
                      onChange={(e) => setBuyQty(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                    {errors["buy-qty"] && (
                      <p
                        id="buy-qty-error"
                        className="mt-1 text-sm text-red-700"
                      >
                        {errors["buy-qty"]}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="buy-price"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Repurchase price per share (£)
                    </label>
                    <input
                      id="buy-price"
                      aria-invalid={Boolean(errors["buy-price"])}
                      aria-describedby={
                        errors["buy-price"] ? "buy-price-error" : undefined
                      }
                      type="number"
                      step="any"
                      min="0.0001"
                      required
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      placeholder="e.g. 2.60"
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                    {errors["buy-price"] && (
                      <p
                        id="buy-price-error"
                        className="mt-1 text-sm text-red-700"
                      >
                        {errors["buy-price"]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="mt-8 w-full bg-amber-700 text-white py-3.5 rounded-xl font-bold text-base hover:bg-amber-800 transition-transform active:scale-[0.99] flex items-center justify-center gap-2 shadow-sm"
            >
              <Calculator className="w-5 h-5" /> Check B&amp;B Rule
            </button>
          </form>

          <p
            role="status"
            className={edited ? "px-6 pb-6 text-sm text-gray-700" : "sr-only"}
          >
            {edited
              ? "Details changed. Check the rule again for the updated result."
              : result
                ? "Calculation updated."
                : ""}
          </p>
          {/* Result */}
          {result && (
            <div
              className={`p-6 sm:p-8 border-t ${result.isMatch ? "bg-amber-50" : "bg-green-50"}`}
            >
              <div className="flex items-start gap-3 mb-4">
                {result.isMatch ? (
                  <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-green-700 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">
                    {result.isMatch
                      ? `B&B Rule Triggered — ${result.daysBetween} days between transactions`
                      : result.daysBetween === 0
                        ? "Same-day matching takes priority — this is not a 30-day match"
                        : result.daysBetween < 0
                          ? "Purchase is before the sale — check the Section 104 pool"
                          : `No B&B Match — ${result.daysBetween} days apart (outside 30-day window)`}
                  </h3>
                </div>
              </div>
              {result.isMatch && (
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="bg-white rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Matched Quantity
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      {result.matchedQty.toString()} shares
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Sale Proceeds
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      £{result.proceeds.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Allowable Cost (B&amp;B)
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      £{result.cost.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      {result.gainLoss.gte(0) ? "Gain" : "Loss"}
                    </p>
                    <p
                      className={`text-xl font-bold ${result.gainLoss.gte(0) ? "text-green-700" : "text-red-600"}`}
                    >
                      {result.gainLoss.gte(0) ? "+" : ""}£
                      {result.gainLoss.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CalculatorFields>

        {/* Explanatory content */}
        <div className="guide-article">
          <h2>How to Interpret the Result</h2>
          <p>
            If the calculator shows{" "}
            <strong>&ldquo;B&amp;B Rule Triggered&rdquo;</strong>, it means the
            disposal is matched against the repurchase under HMRC&apos;s 30-day
            rule. The allowable cost used to calculate your gain or loss is the
            cost of the repurchased shares — not the original cost from your{" "}
            <Link href="/guide/section-104-pool">Section 104 pool</Link>.
          </p>
          <p>
            If the repurchase quantity is less than the sale quantity, only the
            repurchased quantity is B&amp;B matched. The remainder of the
            disposal falls through to the Section 104 pool as normal.
          </p>

          <h3>Worked Example</h3>
          <p>
            You sell 200 shares of TSCO at £3.00 per share on 1 June (proceeds:
            £600). On 20 June (19 days later), you buy 200 shares at £2.80 per
            share (cost: £560). The B&amp;B rule applies because the repurchase
            is within 30 days.
          </p>
          <ul>
            <li>
              <strong>Proceeds:</strong> 200 × £3.00 = £600
            </li>
            <li>
              <strong>Cost (B&amp;B matched):</strong> 200 × £2.80 = £560
            </li>
            <li>
              <strong>Gain:</strong> £600 − £560 = <strong>£40</strong>
            </li>
          </ul>
          <p>
            Without the B&amp;B rule, the cost would have come from the Section
            104 pool, which might have been significantly higher or lower.
          </p>

          <p>
            For a deeper understanding of how this rule fits into the broader
            CGT framework, read our full guide on the{" "}
            <Link href="/guide/bed-and-breakfast-rule">
              30-day bed and breakfast rule
            </Link>
            , including legitimate alternatives like bed-and-ISA and
            bed-and-spouse strategies.
          </p>
        </div>

        {/* CTA */}
        <section className="mt-12 bg-blue-50 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Tracking an entire portfolio?
          </h2>
          <p className="text-gray-600 mb-6">
            Review supported broker files and calculate gains and losses across
            your taxable ordinary-share accounts.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Try the preview <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
