import Link from "next/link";
import { AuthFrame } from "./auth-frame";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";
import { authBackLink, authHref, brokerUploadDestination, safeReturnPath } from "./return-path";

export function WorkspaceEntry({
  next,
  message,
}: {
  next: string;
  message?: string;
}) {
  const destination = safeReturnPath(next);
  const annualBilling = destination.split("?")[0] === "/billing";
  const broker = brokerUploadDestination(destination);
  return (
    <AuthFrame back={authBackLink(destination)}>
      <section>
        <h1>
          {annualBilling ? "Annual PDF reports" : "Sign in to your workspace."}
        </h1>
        <p>
          {annualBilling
            ? `The annual PDF plan is ${ANNUAL_REPORT_PRICE} per year. Sign in or create an account to continue to billing.`
            : broker
              ? `Sign in or create a free account to continue to your ${broker.name} CSV upload.`
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
    </AuthFrame>
  );
}
