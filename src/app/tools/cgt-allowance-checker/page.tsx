"use client";

import { useState } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import { money } from "@/ui/format";
import { ArrowRight, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
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
  const [taxBand, setTaxBand] = useState<"basic" | "higher">("basic");

  const [taxableIncome, setTaxableIncome] = useState("");
  const valid = (v: string) => /^\d{1,12}(\.\d{1,8})?$/.test(v);
  const totalGains = new Decimal(valid(gains) ? gains : 0);
  const totalLosses = new Decimal(valid(losses) ? losses : 0);
  const netGain = Decimal.max(0, totalGains.minus(totalLosses));
  const exemptionRemaining = Decimal.max(
    0,
    new Decimal(EXEMPT_AMOUNT).minus(netGain),
  );
  const taxableGain = Decimal.max(0, netGain.minus(EXEMPT_AMOUNT));
  const basicBandRemaining =
    taxBand === "basic"
      ? Decimal.max(
          0,
          new Decimal(37700).minus(valid(taxableIncome) ? taxableIncome : 0),
        )
      : new Decimal(0);
  const basicPortion = Decimal.min(taxableGain, basicBandRemaining);
  const taxOwed = basicPortion
    .mul(BASIC_RATE)
    .plus(taxableGain.minus(basicPortion).mul(HIGHER_RATE));
  const hasInput =
    (gains !== "" || losses !== "") &&
    (!gains || valid(gains)) &&
    (!losses || valid(losses)) &&
    (taxBand !== "basic" || valid(taxableIncome));
  const light: "green" | "amber" | "red" = netGain.gt(EXEMPT_AMOUNT)
    ? "red"
    : netGain.gte(2500)
      ? "amber"
      : "green";
  const pctUsed = netGain.div(EXEMPT_AMOUNT).toNumber();
  const lightConfig = {
    green: {
      icon: CheckCircle,
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      iconColor: "text-green-700",
      label: "Well within your allowance",
      gradient: "from-green-400 to-emerald-500",
    },
    amber: {
      icon: AlertTriangle,
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      iconColor: "text-amber-600",
      label: "Approaching allowance limit",
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

      <main id="main" className="max-w-3xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
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
                type="number"
                step="any"
                min="0"
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
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 1000"
                value={losses}
                onChange={(e) => setLosses(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
            <div>
              <p className="block text-sm font-semibold text-gray-700 mb-2">
                Are you a basic or higher rate taxpayer?
              </p>
              <div className="flex gap-4">
                <label
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${taxBand === "basic" ? "border-green-500 bg-green-50 text-green-800" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <input
                    type="radio"
                    name="tax-band"
                    value="basic"
                    checked={taxBand === "basic"}
                    onChange={() => setTaxBand("basic")}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">Basic rate (18%)</span>
                </label>
                <label
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${taxBand === "higher" ? "border-green-500 bg-green-50 text-green-800" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <input
                    type="radio"
                    name="tax-band"
                    value="higher"
                    checked={taxBand === "higher"}
                    onChange={() => setTaxBand("higher")}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">Higher rate (24%)</span>
                </label>
              </div>
            </div>
          </div>

          {taxBand === "basic" && (
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
                value={taxableIncome}
                onChange={(e) => setTaxableIncome(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
              />
              <p className="text-sm text-gray-600 mt-2">
                Required to split gains between the 18% and 24% bands. This
                illustration assumes the standard £37,700 basic-rate band and
                £3,000 exemption for 2025–26; other gains, reliefs and band
                extensions are excluded.
              </p>
            </div>
          )}
          {((gains && !valid(gains)) ||
            (losses && !valid(losses)) ||
            (taxBand === "basic" &&
              taxableIncome &&
              !valid(taxableIncome))) && (
            <p role="alert" className="px-6 pb-6 text-red-700">
              Enter non-negative amounts with up to 12 whole digits and 8
              decimal places.
            </p>
          )}
          {/* Results */}
          {hasInput && (
            <div className="bg-gray-50 border-t p-6 sm:p-8">
              {/* Traffic light */}
              <div
                className={`flex items-center gap-3 p-4 rounded-xl border mb-6 ${lc.bg} ${lc.border}`}
              >
                <Icon className={`w-6 h-6 ${lc.iconColor} flex-shrink-0`} />
                <span className={`font-semibold ${lc.text}`}>{lc.label}</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">
                    Net Gain
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
                  <p
                    className={`text-2xl font-bold ${taxOwed.gt(0) ? "text-red-600" : "text-green-700"}`}
                  >
                    {money(taxOwed.toString())}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {taxBand === "basic"
                      ? "18% within the remaining basic-rate band; 24% above it"
                      : "24% higher rate"}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>£0</span>
                  <span>£{EXEMPT_AMOUNT.toLocaleString()} exempt</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${light === "green" ? "bg-green-500" : light === "amber" ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(100, pctUsed * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 text-right">
                  {Math.min(100, Math.round(pctUsed * 100))}% of allowance used
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
          <Link
            href="/signup"
            className="inline-flex items-center bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Upload your CSV free <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
