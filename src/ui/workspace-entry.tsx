import Link from "next/link";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";
import { authHref, safeReturnPath } from "./return-path";

export function WorkspaceEntry({
  next,
  message,
}: {
  next: string;
  message?: string;
}) {
  const destination = safeReturnPath(next);
  const annualBilling = destination.split("?")[0] === "/billing";
  return (
    <main id="main" className="classic-auth">
      <section className="auth-wrap panel">
        <Link
          href={annualBilling ? "/pricing" : "/"}
          className="inline-block mb-4 text-sm text-blue-700"
        >
          {annualBilling ? "← Back to pricing" : "← Back to home"}
        </Link>
        <h1>
          {annualBilling ? "Annual PDF reports" : "Sign in to your workspace."}
        </h1>
        <p>
          {annualBilling
            ? `The annual PDF plan is ${ANNUAL_REPORT_PRICE} per year. Sign in or create an account to continue to billing.`
            : "Sign in to open your personal portfolio, or create a free account to get started."}
        </p>
        {message && <p role="status">{message}</p>}
        <div className="actions">
          <Link
            className="button primary"
            href={authHref("/login", destination)}
          >
            Sign in
          </Link>
          <Link
            className="button secondary"
            href={authHref("/signup", destination)}
          >
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
