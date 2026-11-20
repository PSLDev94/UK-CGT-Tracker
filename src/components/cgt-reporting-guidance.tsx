import { TAX_YEARS, type TaxYear } from "@/domain/values";
import { sa108Collection, sa108Edition } from "@/domain/reports/filing-guidance";

export function CgtReportingGuidance({ year = "2025-26" }: { year?: TaxYear }) {
  const beforeFixedThreshold = year === "2021-22" || year === "2022-23";
  const threshold = beforeFixedThreshold ? 49200 : 50000;
  const format = (amount: number) => "£" + amount.toLocaleString("en-GB");
  const notes = sa108Edition(year);
  return (
    <>
      <p>
        If your taxable gains exceed your available allowance, report them to HMRC.
        For {year.replace("-", "–")}, if you are registered for Self Assessment, include your gains on the return
        when total proceeds from disposing of chargeable assets are <strong>more than {format(threshold)}</strong>.
        {beforeFixedThreshold && " This is four times the standard individual annual exempt amount for this year."}
      </p>
      <p>
        For example, {format(threshold)} exactly is within that threshold. {format(threshold + 1)} crosses it.
        If you are outside Self Assessment, this proceeds rule alone does not require you to register.{" "}
        <a href="https://www.gov.uk/capital-gains-tax/work-out-need-to-pay">Check HMRC’s reporting rules</a>.
      </p>
      <p>
        {notes
          ? `For a ${year.replace("-", "–")} Self Assessment return, also complete the capital gains pages if your chargeable gains exceeded ${format(Number(TAX_YEARS[year].annualExemptionGBP))} before deducting losses, even if the losses bring you below the allowance.`
          : "The final capital gains pages for this open tax year are not yet available. Check HMRC’s published form and instructions when preparing your return."}{" "}
        <a href={notes?.notes ?? sa108Collection}>Check the SA108 notes for your tax year</a>.
      </p>
      <p>
        Claiming a loss is separate. You can generally claim an allowable loss
        within four years of the end of the tax year of disposal.{" "}
        <a href="https://www.gov.uk/capital-gains-tax/losses">
          Read HMRC’s guidance on claiming losses
        </a>
        .
      </p>
    </>
  );
}
