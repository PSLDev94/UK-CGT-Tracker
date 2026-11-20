"use client";

import { useState } from "react";
import Link from "next/link";
import { Money, TAX_YEARS, type TaxYear } from "@/domain/values";
import { adjustment2024Url, sa108Collection, sa108Edition } from "@/domain/reports/filing-guidance";
import { money } from "@/ui/format";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { CalculatorUploadLink } from "@/components/calculator-upload-link";
import { PublicNav } from "@/components/public-nav";
import publicStyles from "@/components/public-pages.module.css";
import styles from "@/components/calculator.module.css";
import { CalculatorFields } from "@/components/calculator-fields";
import { CgtReportingGuidance } from "@/components/cgt-reporting-guidance";
import { PublicFooter } from "@/components/public-footer";

type Period = "mixed" | "early" | "late";

export default function CGTAllowanceCheckerPage() {
  const [taxYear, setTaxYear] = useState<TaxYear>("2025-26");
  const [period, setPeriod] = useState<Period>("mixed");
  const yearLabel = taxYear.replace("-", "–");
  const exemptAmount = new Money(TAX_YEARS[taxYear].annualExemptionGBP);
  const exemptionLabel = exemptAmount.toNumber().toLocaleString("en-GB");
  const splitYear = taxYear === "2024-25";
  const needsDisposalDates = splitYear && period === "mixed";
  const earlyRates = taxYear < "2024-25" || (splitYear && period === "early");
  const basicPercent = earlyRates ? 10 : 18;
  const higherPercent = earlyRates ? 20 : 24;
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
  const allowanceUsed = Money.clamp(netGain, 0, exemptAmount);
  const exemptionRemaining = new Money(exemptAmount).minus(allowanceUsed);
  const taxableGain = Money.max(0, netGain.minus(exemptAmount));
  const taxable = hasInput && taxableGain.gt(0);
  const needIncome = taxable && !needsDisposalDates;
  const incomeInvalid =
    needIncome && taxableIncome !== "" && !valid(taxableIncome);
  let taxOwed = null;
  if (!taxable || (needIncome && valid(taxableIncome))) {
    const basicBandRemaining = needIncome
      ? Money.max(0, new Money(37700).minus(taxableIncome))
      : 0;
    const basicPortion = Money.min(taxableGain, basicBandRemaining);
    taxOwed = basicPortion
      .mul(basicPercent).div(100)
      .plus(taxableGain.minus(basicPortion).mul(higherPercent).div(100));
  }
  const light: "green" | "amber" | "red" = netGain.gt(exemptAmount)
    ? "red"
    : netGain.times(6).gte(exemptAmount.times(5))
      ? "amber"
      : "green";
  const pctUsed = allowanceUsed.div(exemptAmount).times(100).toNumber();
  const lightConfig = {
    green: {
      icon: CheckCircle,
      text: "text-green-700",
      iconColor: "text-green-700",
      label: netGain.lte(0) ? "No allowance used" : "Well within your allowance",
    },
    amber: {
      icon: AlertTriangle,
      text: "text-amber-700",
      iconColor: "text-amber-600",
      label: netGain.eq(exemptAmount) ? "Allowance fully used" : "Approaching allowance limit",
    },
    red: {
      icon: XCircle,
      text: "text-red-700",
      iconColor: "text-red-600",
      label: "Over allowance — review your tax position",
    },
  };
  const lc = lightConfig[light];
  const Icon = lc.icon;

  return (
    <div className={publicStyles.page}>
      <PublicNav />

      <main id="main" tabIndex={-1} className={`${publicStyles.frame} ${publicStyles.reading} ${styles.page}`}>
        <h1 className={publicStyles.taskHeading}>
          UK CGT Allowance Checker
        </h1>
        <p className={publicStyles.intro}>
          Estimate tax on ordinary share gains for {yearLabel}. This checker assumes you qualify for the standard individual <strong>£{exemptionLabel} annual exempt amount</strong>.
        </p>
        <p className={publicStyles.referenceBox}>
          {taxYear >= "2025-26"
            ? "If you claimed the foreign income and gains regime or Overseas Workday Relief for this year, you have no annual exempt amount and this estimate does not apply."
            : "A remittance basis claim can affect your annual exemption. If your entitlement differs from the standard allowance, check your position before using the figures."}{" "}
          <a className="text-blue-700 underline" href="https://www.gov.uk/guidance/capital-gains-tax-rates-and-allowances">
            Check allowance eligibility with HMRC
          </a>.
        </p>

        {/* Calculator */}
        <CalculatorFields label="Allowance calculation">
          <div className={styles.fieldsStack}>
            <div>
              <label htmlFor="allowance-year" className="block text-sm font-semibold text-gray-700 mb-1">Tax year</label>
              <select id="allowance-year" className={styles.input} value={taxYear} aria-describedby="year-hint"
                onChange={(event) => {
                  setTaxYear(event.target.value as TaxYear);
                  setPeriod("mixed");
                  setGains("");
                  setLosses("");
                  setTaxableIncome("");
                }}>
                {Object.keys(TAX_YEARS).reverse().map(year => <option key={year} value={year}>{year.replace("-", "–")}</option>)}
              </select>
              <p id="year-hint" className="mt-2 text-sm text-gray-600">Changing the year clears your figures.{taxYear === "2026-27" && " This tax year is still open. Treat the result as an estimate for the year so far."}</p>
            </div>
            <div>
              <label
                htmlFor="gains"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Total gains for {yearLabel} (£)
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
                className={styles.input}
              />
            </div>
            <div>
              <label
                htmlFor="losses"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Total allowable losses for {yearLabel} (£)
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
                className={styles.input}
              />
            </div>
          </div>

          {splitYear && taxable && (
            <div className="px-6 pb-6">
              <label htmlFor="disposal-period" className="block text-sm font-semibold text-gray-700 mb-1">When did you dispose of the shares?</label>
              <select id="disposal-period" className={styles.input} value={period} onChange={e => setPeriod(e.target.value as Period)}>
                <option value="mixed">Both periods, or unsure</option>
                <option value="early">All before 30 October 2024</option>
                <option value="late">All on or after 30 October 2024</option>
              </select>
              <p className="mt-2 text-sm text-gray-600">The main rates changed on 30 October. For disposals in both periods, separate your dated gains and losses and check <a className="text-blue-700 underline" href={adjustment2024Url}>HMRC’s 2024–25 adjustment</a>.</p>
            </div>
          )}
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
                className={styles.input}
              />
              <p id="income-hint" className="text-sm text-gray-600 mt-2">
                Use income after your Personal Allowance, including if you pay Scottish Income Tax.
                The standard UK basic-rate band is £37,700 for {yearLabel}. This estimate uses {basicPercent}% on gains within the remaining band and {higherPercent}% above it. It assumes no other gains, reliefs or band extensions.
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
            <div className={styles.result}>
              {/* Traffic light */}
              <div
                className={styles.allowanceStatus}
              >
                <Icon aria-hidden="true" className={`w-6 h-6 ${lc.iconColor} flex-shrink-0`} />
                <span className={`font-semibold ${lc.text}`}>{lc.label}</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 tabular-nums [overflow-wrap:anywhere]">
                <div className={styles.amount}>
                  <p className={styles.caption}>
                    {netGain.lt(0) ? "Net loss" : netGain.gt(0) ? "Net gain" : "Break-even"}
                  </p>
                  <p className={styles.value}>
                    {money(netGain.toString())}
                  </p>
                </div>
                <div className={styles.amount}>
                  <p className={styles.caption}>
                    Exemption Remaining
                  </p>
                  <p className={styles.value}>
                    {money(exemptionRemaining.toString())}
                  </p>
                </div>
                <div className={styles.amount}>
                  <p className={styles.caption}>
                    Taxable Gain
                  </p>
                  <p className={styles.value}>
                    {money(taxableGain.toString())}
                  </p>
                </div>
                <div className={styles.amount}>
                  <p className={styles.caption}>
                    Estimated Tax Owed
                  </p>
                  {taxOwed ? (
                    <p className={`${styles.value} ${taxOwed.gt(0) ? "text-red-700" : "text-green-700"}`}>
                      {money(taxOwed.toString())}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-gray-700">{needsDisposalDates ? "An annual total is insufficient to estimate tax across the rate change." : "Enter your taxable income for an estimate."}</p>
                  )}
                  {needIncome && taxOwed && (
                    <p className="text-xs text-gray-600 mt-1">
                      {basicPercent}% within the remaining UK basic-rate band and {higherPercent}% above it
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
                  <span>£{exemptionLabel} exempt</span>
                </div>
                <div className={styles.allowanceTrack}>
                  <div
                    className={`h-full ${light === "green" ? "bg-green-500" : light === "amber" ? "bg-amber-500" : "bg-red-500"}`}
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
        <div className={`guide-article ${styles.notes}`}>
          <h2>About the Annual Exempt Amount</h2>
          <p>
            The exemption belongs to each eligible person for that tax year.
            Any unused allowance expires on 5 April. See the{" "}
            <Link href="/guide/cgt-rates-2025-26">2025–26 CGT rates guide</Link>{" "}
            for a worked example of how the income bands apply.
          </p>
          <h2>When do I report share gains?</h2>
          <CgtReportingGuidance year={taxYear} />

          <h2>Checking the figures for your return</h2>
          <p>
            Check your sale proceeds, allowable costs and share matching against
            your broker statements. The estimate uses the gains and losses you
            enter. Your return may also include other assets, reliefs or losses
            brought forward. See the{" "}
            <a href={sa108Edition(taxYear)?.notes ?? sa108Collection}>HMRC capital gains guidance for {yearLabel}</a>.
          </p>
        </div>

        {/* CTA */}
        <section className={publicStyles.callToAction}>
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
