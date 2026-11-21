"use client";

import styles from "@/components/public-pages.module.css";

import { usePublicAccount } from "@/ui/public-account";
import { authHref } from "@/ui/return-path";
import Link from "next/link";
import {
  ANNUAL_REPORT_PRICE,
  FREE_FEATURES,
  PDF_FEATURES,
} from "@/domain/reports/access";

export function ReportPricing({
  heading: Heading = "h2",
  mode,
}: {
  heading?: "h2" | "h3";
  mode: "live" | "preview" | "unavailable";
}) {
  const signedIn = usePublicAccount();
  return (
    <div className={styles.offers}>
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
            ? mode === "preview" ? "View sandbox billing" : "View billing"
            : "Create an account for annual reports",
        },
      ].map((plan) => (
        <section key={plan.name} className={styles.offer}>
          <Heading className={styles.subheading}>{plan.name}</Heading>
          <p className={styles.offerPrice}>
            {plan.amount}
            {plan.paid && <span> / year</span>}
          </p>
          <ul>
            {plan.features.map((item) => (
              <li key={item}>
                <span>{item}</span>
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
            className={plan.paid ? styles.action : styles.actionSecondary}
            href={plan.href}
          >
            {plan.action}
          </Link>
          {plan.paid && !signedIn && (
            <Link
              className="mt-2 self-start py-2 text-sm text-blue-700 underline"
              href={authHref("/login", "/billing")}
            >
              Already have an account? Sign in
            </Link>
          )}
        </section>
      ))}
    </div>
  );
}
