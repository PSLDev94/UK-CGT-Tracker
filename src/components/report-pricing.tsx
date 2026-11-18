import Link from "next/link";
import { CheckCircle } from "lucide-react";
import {
  ANNUAL_REPORT_PRICE,
  FREE_FEATURES,
  PDF_FEATURES,
} from "@/domain/reports/access";

export function ReportPricing({
  heading: Heading = "h2",
}: {
  heading?: "h2" | "h3";
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 text-left">
      {[
        {
          paid: false,
          name: "Free workspace",
          amount: "£0",
          features: FREE_FEATURES,
          href: "/signup",
          action: "Create a free account",
        },
        {
          paid: true,
          name: "Annual PDF reports",
          amount: ANNUAL_REPORT_PRICE,
          features: PDF_FEATURES,
          href: "/billing",
          action: "View sandbox billing",
        },
      ].map((plan) => (
        <div
          key={plan.name}
          className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <Heading className="mb-3 text-lg font-semibold text-gray-900">
            {plan.name}
          </Heading>
          <p className="mb-5 text-4xl font-extrabold text-gray-900">
            {plan.amount}
            {plan.paid && (
              <span className="text-base font-normal text-gray-600">
                {" "}
                / year
              </span>
            )}
          </p>
          <ul className="mb-6 space-y-3 text-gray-700">
            {plan.features.map((item) => (
              <li className="flex gap-3" key={item}>
                <CheckCircle
                  aria-hidden
                  className="mt-0.5 h-5 w-5 shrink-0 text-green-700"
                />
                {item}
              </li>
            ))}
          </ul>
          <Link
            className={
              plan.paid
                ? "mt-auto rounded-lg bg-blue-600 px-4 py-3 text-center font-semibold text-white hover:bg-blue-700"
                : "mt-auto rounded-lg border border-gray-300 px-4 py-3 text-center font-semibold text-blue-700 hover:bg-blue-50"
            }
            href={plan.href}
          >
            {plan.action}
          </Link>
        </div>
      ))}
    </div>
  );
}
