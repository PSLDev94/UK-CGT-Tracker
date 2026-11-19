"use client";

import { useState } from "react";
import Link from "next/link";
import { Money } from "@/domain/values";
import { money } from "@/ui/format";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { CalculatorUploadLink } from "@/components/calculator-upload-link";
import { PublicNav } from "@/components/public-nav";
import { CalculatorFields } from "@/components/calculator-fields";
import { CgtReportingGuidance } from "@/components/cgt-reporting-guidance";
import { PublicFooter } from "@/components/public-footer";

const EXEMPT_AMOUNT = 3000;
const BASIC_RATE = 0.18;
const HIGHER_RATE = 0.24;

export default function CGTAllowanceCheckerPage() {
  const [gains, setGains] = useState("");
  const [losses, setLosses] = useState("");

  const [taxableIncome, setTaxableIncome] = useState("");
  const valid = (v: string) => /^\d{1,12}(\.\d{1,2})?$/.test(v);
  const gainsInvalid = gains !== "" && !valid(gains);
  const lossesInvalid = losses !== "" && !valid(losses);
  const hasInput =
    (gains !== "" || losses !== "") && !gainsInvalid && !lossesInvalid;
  const netGain = new Money(gainsInvalid ? 0 : gains || 0).minus(
    lossesInvalid ? 0 : losses || 0,
  );
  const allowanceUsed = Money.clamp(netGain, 0, EXEMPT_AMOUNT);
  const exemptionRemaining = new Money(EXEMPT_AMOUNT).minus(allowanceUsed);
  const taxableGain = Money.max(0, netGain.minus(EXEMPT_AMOUNT));
  const needIncome = hasInput && taxableGain.gt(0);
  const incomeInvalid =
    needIncome && taxableIncome !== "" && !valid(taxableIncome);
  let taxOwed = null;
  if (!needIncome || valid(taxableIncome)) {
    const basicBandRemaining = needIncome
      ? Money.max(0, new Money(37700).minus(taxableIncome))
      : 0;
    const basicPortion = Money.min(taxableGain, basicBandRemaining);
    taxOwed = basicPortion
      .mul(BASIC_RATE)
      .plus(taxableGain.minus(basicPortion).mul(HIGHER_RATE));
  }
  const light: "green" | "amber" | "red" = netGain.gt(EXEMPT_AMOUNT)
    ? "red"
    : netGain.gte(2500)
      ? "amber"
      : "green";
  const pctUsed = allowanceUsed.div(EXEMPT_AMOUNT).times(100).toNumber();
  const lightConfig = {
    green: {
      icon: CheckCircle,
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      iconColor: "text-green-700",
      label: netGain.lte(0) ? "No allowance used" : "Well within your allowance",
      gradient: "from-green-400 to-emerald-500",
    },
    amber: {
      icon: AlertTriangle,
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      iconColor: "text-amber-600",
      label: netGain.eq(EXEMPT_AMOUNT) ? "Allowance fully used" : "Approaching allowance limit",
      gradient: "from-amber-400 to-orange-500",
    },
    red: {
      icon: XCircle,
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      iconColor: "text-red-600",
      label: "Over allowance — review your tax position",
      gradient: "from-red-400 to-rose-500",
    },
  };
  const lc = lightConfig[light];
  const Icon = lc.icon;

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <main id="main" tabIndex={-1} className="wrap-anywhere max-w-3xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
          UK CGT Allowance Checker 2025-26
        </h1>
        <p className="text-lg text-gray-600 mb-2 max-w-3xl leading-relaxed">
          Estimate your tax on ordinary share gains for 6 April 2025 to 5 April
          2026. This checker assumes you qualify for the individual{" "}
          <strong>£3,000 annual exempt amount</strong>.
        </p>
        <p className="text-gray-600 mb-8 max-w-3xl leading-relaxed">
          If you claimed the foreign income and gains regime or Overseas
          Workday Relief for this year, you have no annual exempt amount and
          this estimate does not apply.{" "}
          <a className="text-blue-700 underline" href="https://www.gov.uk/guidance/capital-gains-tax-rates-and-allowances">
            Check allowance eligibility with HMRC
          </a>.
        </p>

        {/* Calculator */}
        <CalculatorFields
          label="Allowance calculation"
          className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8"
        >
          <div
            className={`h-1.5 bg-gradient-to-r ${hasInput ? lc.gradient : "from-green-400 to-emerald-500"}`}
          />
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <label
                htmlFor="gains"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Total gains for 2025–26 (£)
              </label>
              <input
                id="gains"
                type="text"
                inputMode="decimal"
                aria-invalid={gainsInvalid}
                aria-describedby={gainsInvalid ? "allowance-input-error" : undefined}
                placeholder="e.g. 5000"
                value={gains}
                onChange={(e) => setGains(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="losses"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Total allowable losses for 2025–26 (£)
              </label>
              <input
                id="losses"
                type="text"
                inputMode="decimal"
                aria-invalid={lossesInvalid}
                aria-describedby={lossesInvalid ? "allowance-input-error" : undefined}
                placeholder="e.g. 1000"
                value={losses}
                onChange={(e) => setLosses(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
          </div>

          {needIncome && (
            <div className="px-6 pb-6">
              <label
                htmlFor="taxable-income"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Taxable income after your personal allowance (£)
              </label>
              <input
                id="taxable-income"
                inputMode="decimal"
                aria-invalid={incomeInvalid}
                aria-describedby={incomeInvalid ? "income-hint allowance-input-error" : "income-hint"}
                value={taxableIncome}
                onChange={(e) => setTaxableIncome(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
              />
              <p id="income-hint" className="text-sm text-gray-600 mt-2">
                Use income after your Personal Allowance, including if you pay Scottish Income Tax.
                The UK CGT basic-rate band is £37,700 for 2025–26. This estimate uses 18%
                on gains within the remaining band and 24% above it, and excludes other gains,
                reliefs and band extensions.
              </p>
            </div>
          )}
          {(gainsInvalid || lossesInvalid || incomeInvalid) && (
            <p id="allowance-input-error" role="alert" className="px-6 pb-6 text-red-700">
              Enter non-negative amounts in pounds and pence, with up to 12 whole
              digits and 2 decimal places.
            </p>
          )}
          {/* Results */}
          {hasInput && (
            <div className="bg-gray-50 border-t p-6 sm:p-8">
              {/* Traffic light */}
              <div
                className={`flex items-center gap-3 p-4 rounded-xl border mb-6 ${lc.bg} ${lc.border}`}
              >
                <Icon aria-hidden="true" className={`w-6 h-6 ${lc.iconColor} flex-shrink-0`} />
                <span className={`font-semibold ${lc.text}`}>{lc.label}</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 tabular-nums [overflow-wrap:anywhere]">
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    {netGain.lt(0) ? "Net loss" : netGain.gt(0) ? "Net gain" : "Break-even"}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {money(netGain.toString())}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    Exemption Remaining
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {money(exemptionRemaining.toString())}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    Taxable Gain
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {money(taxableGain.toString())}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    Estimated Tax Owed
                  </p>
                  {taxOwed ? (
                    <p className={`text-2xl font-bold ${taxOwed.gt(0) ? "text-red-700" : "text-green-700"}`}>
                      {money(taxOwed.toString())}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-gray-700">Enter your taxable income for an estimate.</p>
                  )}
                  {needIncome && taxOwed && (
                    <p className="text-xs text-gray-600 mt-1">
                      18% within the remaining UK basic-rate band and 24% above it
                    </p>
                  )}
                </div>
              </div>
              {netGain.lt(0) && (
                <p className="mt-4 text-sm text-gray-700">
                  You may be able to carry the unused loss forward if you claim it.{" "}
                  <a className="text-blue-700 underline" href="https://www.gov.uk/capital-gains-tax/losses">
                    How to claim an allowable loss
                  </a>.
                </p>
              )}

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>£0</span>
                  <span>£{EXEMPT_AMOUNT.toLocaleString()} exempt</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${light === "green" ? "bg-green-500" : light === "amber" ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${pctUsed}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 text-right">
                  {pctUsed > 0 && pctUsed < 1 ? "<1" : Math.floor(pctUsed)}% of allowance used
                </p>
              </div>
            </div>
          )}
        </CalculatorFields>

        {/* Explanatory content */}
        <div className="guide-article mb-12">
          <h2>About the Annual Exempt Amount</h2>
          <p>
            The exemption belongs to each eligible person for that tax year.
            Any unused allowance expires on 5 April. See the{" "}
            <Link href="/guide/cgt-rates-2025-26">2025–26 CGT rates guide</Link>{" "}
            for a worked example of how the income bands apply.
          </p>
          <h2>When do I report share gains?</h2>
          <CgtReportingGuidance />

          <h2>Checking the figures for your return</h2>
          <p>
            Check your sale proceeds, allowable costs and share matching against
            your broker statements. The estimate uses the gains and losses you
            enter. Your return may also include other assets, reliefs or losses
            brought forward. See the{" "}
            <Link href="/guide/sa108-how-to-fill-in">2025–26 SA108 guide</Link>.
          </p>
        </div>

        {/* CTA */}
        <section className="bg-blue-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            Review the disposals behind your gains
          </h2>
          <p className="text-gray-600 mb-6">
            Import supported broker records to calculate your share gains and
            losses.
          </p>
          <CalculatorUploadLink />
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
