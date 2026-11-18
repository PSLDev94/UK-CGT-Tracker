"use client";

import { usePublicAccount } from "@/ui/public-account";
import { authHref } from "@/ui/return-path";
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
  const signedIn = usePublicAccount();
  return (
    <div className="grid gap-5 sm:grid-cols-2 text-left">
      {[
        {
          paid: false,
          name: "Free workspace",
          amount: "£0",
          features: FREE_FEATURES,
          href: signedIn ? "/dashboard" : "/signup",
          action: signedIn ? "Open my workspace" : "Create a free account",
        },
        {
          paid: true,
          name: "Annual PDF reports",
          amount: ANNUAL_REPORT_PRICE,
          features: PDF_FEATURES,
          href: signedIn ? "/billing" : authHref("/signup", "/billing"),
          action: signedIn
            ? "View sandbox billing"
            : "Create an account for annual reports",
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
          {plan.paid && (
            <div className="mb-6 text-sm text-gray-700">
              <p>See what each report includes using synthetic trades.</p>
              <div className="flex flex-wrap gap-x-5">
                <a
                  className="inline-flex min-h-11 items-center text-blue-700 underline"
                  href="/samples/cgt-summary.pdf"
                >
                  Sample summary PDF
                </a>
                <a
                  className="inline-flex min-h-11 items-center text-blue-700 underline"
                  href="/samples/cgt-evidence.pdf"
                >
                  Sample evidence PDF
                </a>
              </div>
            </div>
          )}
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
          {plan.paid && !signedIn && (
            <Link
              className="mt-2 py-2 text-center text-sm text-blue-700 underline"
              href={authHref("/login", "/billing")}
            >
              Already have an account? Sign in
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
