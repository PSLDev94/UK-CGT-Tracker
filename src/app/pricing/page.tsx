import { Metadata } from "next";
import { ReportPricing } from "@/components/report-pricing";
import { PublicFooter } from "@/components/public-footer";
import { PublicNav } from "@/components/public-nav";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";

export const metadata: Metadata = {
  title: `Pricing | ${ANNUAL_REPORT_PRICE} per year`,
  description:
    "Compare free share-gain calculations and CSV evidence with the £49 annual PDF subscription.",
};

export default async function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PublicNav />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 flex flex-col items-center pt-16 px-4 pb-20"
      >
        <div className="w-full max-w-3xl mx-auto text-center [overflow-wrap:anywhere]">
          <h1 className="text-4xl text-balance hyphens-auto font-extrabold text-gray-900 mb-6">
            Simple pricing
          </h1>
          <p className="text-xl text-gray-600 mb-10">
            Import and calculate for free. Download PDF reports for {ANNUAL_REPORT_PRICE} per year.
          </p>

          <ReportPricing />
          <p className="mt-6 text-sm text-gray-600">
            The subscription renews annually until cancelled. Checkout uses
            Stripe test payments in this preview.
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
