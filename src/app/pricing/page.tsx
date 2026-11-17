import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { PublicNav } from "@/components/public-nav";

export const metadata: Metadata = {
  title: "Pricing | Simple £49/year",
  description:
    "Review supported transactions and share matching for one simple annual fee. Relaunch preview.",
};

export default async function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PublicNav />
      <main
        id="main"
        className="flex-1 flex flex-col items-center pt-16 px-4 pb-20"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-600 mb-10">
            One annual plan. Review the relaunch preview before subscribing.
          </p>

          <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md mx-auto">
            <div className="text-5xl font-extrabold text-gray-900 mb-2">
              £49
              <span className="text-xl text-gray-500 font-normal">/year</span>
            </div>
            <p className="text-sm text-gray-500 mb-8">
              Billed annually. Cancel anytime.
            </p>

            <ul className="text-left space-y-4 mb-8">
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-gray-700">
                  Same-day, 30-day and Section 104 share matching
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-gray-700">
                  Supported broker formats and a reviewed CSV template
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-gray-700">
                  Explicit row validation before saving
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-gray-700">
                  Illustrative holding scenarios
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-gray-700">
                  Calculation evidence; final tax reports in qualification
                </span>
              </li>
            </ul>

            <Link
              href="/billing"
              className="block w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 text-center text-lg"
            >
              View sandbox billing
            </Link>
            <p className="mt-4 text-xs text-gray-500">
              Test mode only. No live payments.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
