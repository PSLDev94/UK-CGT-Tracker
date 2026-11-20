import Link from "next/link";
import { AuthForm, type AuthMode } from "./auth-form";
import { AuthFrame } from "./auth-frame";
import { samplePreview } from "@/domain/reports/sample-view";
import styles from "./auth-frame.module.css";
import { redirect } from "next/navigation";
import { hasPublicSession } from "@/server/public-session";
import { authBackLink, safeReturnPath } from "./return-path";

export async function AuthPage({
  mode,
  token,
  next,
  verificationNotice,
}: {
  mode: AuthMode;
  next?: string;
  token?: string;
  verificationNotice?: "failed" | "complete";
}) {
  if (
    (mode === "sign-in" || mode === "sign-up") &&
    !verificationNotice &&
    (await hasPublicSession())
  ) {
    redirect(safeReturnPath(next));
  }
  return (
    <AuthFrame back={authBackLink(safeReturnPath(next))} aside={mode === "sign-up" && <SampleStatement />}>
      <AuthForm
        nextPath={next}
        mode={mode}
        token={token}
        verificationNotice={verificationNotice}
      />
    </AuthFrame>
  );
}

function SampleStatement() {
  const { broker, year, sales, net } = samplePreview();
  return (
    <aside className={styles.sample} aria-labelledby="signup-sample-title">
      <header className={styles.sampleHeading}>
        <h2 id="signup-sample-title">Sample annual statement</h2>
        <span>Example account · {broker} / {year}</span>
      </header>
      <dl>
        {sales.map((sale) => (
          <div className={styles.sampleRow} key={sale.id}>
            <dt>{sale.name}</dt>
            <dd>{sale.result}</dd>
          </div>
        ))}
      </dl>
      <dl className={styles.sampleResult}>
        <dt>Net gain before allowances and prior losses</dt>
        <dd>{net}</dd>
      </dl>
      <p>
        <Link href="/sample-calculation" target="_blank" rel="noopener noreferrer">
          Explore the sample statement <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      </p>
      <p>
        <Link href="/supported-brokers" target="_blank" rel="noopener noreferrer">
          See which broker files you can upload <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      </p>
    </aside>
  );
}
