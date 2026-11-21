import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { isProductionSite, productionTrader, workspaceBillingEnabled } from "@/server/public-site";
export const metadata = { title: "Privacy and your data" };

export default function Privacy() {
  const production = isProductionSite();
  const trader = productionTrader();
  const billing = workspaceBillingEnabled();
  return (
    <div className={styles.page}>
      <PublicNav />
      <main
        id="main"
        tabIndex={-1}
        className={`${styles.frame} ${styles.legal}`}
      >
        <h1 className={styles.articleTitle}>
          Privacy &amp; your data
        </h1>
        <p>
          {trader && trader.legalName !== "PSL Digital"
            ? `${trader.legalName}, trading as PSL Digital, is the controller for your CGT Tracker information.`
            : "CGT Tracker is operated by PSL Digital."} Contact{" "}
          <a
            className="text-blue-600 underline"
            href="mailto:support@cgttracker.com"
          >
            support@cgttracker.com
          </a>{" "}
          about your account or personal information.
        </p>
        {!production && <div className={styles.referenceBox}>
          <strong>Relaunch preview</strong>
          <p>
            This page describes the review version. The full production privacy
            notice, retention schedule and international-transfer arrangements
            require final review before launch.
          </p>
        </div>}
        <h2 className="text-xl font-semibold text-gray-900">
          Information used by the application
        </h2>
        <p>
          Your name, email, password hash and sessions support sign-in and
          account recovery. Broker account labels, imported transactions,
          supporting references and calculation snapshots let the application
          calculate and explain share gains.{" "}
          {billing && "Stripe manages payment details; CGT Tracker stores billing references and subscription status, not card numbers."}
        </p>
        {production && (
          <p>
            We use your account details, trades{billing ? " and subscription information" : " and calculations"} to
            provide the service under our contract with you. Your broker data comes
            from the files and supporting details you supply.{" "}
            {billing && "Stripe sends billing updates so we can grant or end paid access. "}We need these records to
            provide the functions you request. We use security logs, support
            correspondence and abuse controls in our legitimate interests in keeping
            the service reliable, investigating faults and preventing misuse.
            {billing && " We keep billing records where required by accounting or tax law."}
          </p>
        )}
        <h2 className="text-xl font-semibold text-gray-900">
          Files and history
        </h2>
        <p>
          Uncommitted CSV previews expire after 24 hours and are removed by the
          hourly cleanup job. Saving an import removes its raw CSV draft.
          Normalised transactions, the source fields used to interpret them and
          audit receipts remain saved. Reversing an import removes its effect on
          calculations but keeps the audit history.
        </p>
        {production && (
          <p>
            We keep saved trades and calculation history while your account is open
            so you can revisit earlier years. When you ask to close it, we verify
            ownership and remove the account records, subject to applicable record-keeping
            duties and outstanding billing claims. We keep support correspondence
            and dispute records for as long as needed to resolve the matter and deal
            with related claims. You can ask which records we still hold about you.
          </p>
        )}
        <h2 className="text-xl font-semibold text-gray-900">
          Service providers, backups and cookies
        </h2>
        <p>
          {production ? (
            <>We use Railway to host the application and database, Resend for verification,
              recovery and support emails{billing && ", Stripe for payments"} and Cloudflare R2 for
              encrypted backups in a private EU bucket. Our retention schedule makes
              archives eligible for automatic deletion after 14 days. We reapply
              completed deletion requests before reopening a restored database.</>
          ) : (
            <>The preview uses Railway for hosting and PostgreSQL storage, Resend
              for verification, recovery and support email, and Stripe for sandbox
              billing. Cloudflare stores encrypted staging backups in a private EU bucket.
              An archive expires after 14 days. If we restore a backup, we reapply
              completed deletion requests before reopening access.</>
          )}{" "}
          Essential cookies keep your session secure{billing && " and return you to the selected report after checkout"}.
          We count completed steps such as file reviews, repairs and report downloads in our service logs.
          These usage events contain the step and, for file reviews and repairs, a broker category.
          They omit names, account identifiers, amounts and file contents. The application
          does not include advertising trackers or send CSV files to an AI
          service.
        </p>
        {production && (
          <p>
            These providers and their subprocessors may handle information outside the UK,
            including in the United States. Their data-processing terms describe applicable
            transfer arrangements, including adequacy decisions and contractual safeguards
            for UK data. Ask support for a copy of the safeguards relevant to your data.
            See the terms for{" "}
            <a className="underline" href="https://railway.com/legal/dpa">Railway</a>,{" "}
            <a className="underline" href="https://resend.com/legal/dpa">Resend</a>
            {billing && <>, <a className="underline" href="https://stripe.com/gb/legal/dpa">Stripe</a></>} and{" "}
            <a className="underline" href="https://www.cloudflare.com/cloudflare-customer-dpa/">Cloudflare</a>.
          </p>
        )}
        <p>
          Support messages go to support@cgttracker.com through Resend. An
          IP-derived keyed digest limits form abuse and is eligible for cleanup
          after one day. Do not include passwords, API keys or unredacted
          financial exports in a support message.
        </p>
        <h2 className="text-xl font-semibold text-gray-900">
          Access, corrections and deletion
        </h2>
        <p>
          You can change your name and password in Settings, reverse incorrect
          imports, and download calculation evidence from Reports. Contact
          support for a copy of your other account information, corrections, or
          an account-deletion request. You can also ask for a portable copy or for us to restrict processing where those rights apply. We verify ownership before providing a copy or deleting personal records. {billing
            ? "We explain any information that must be retained for billing or legal reasons. Deletion is reviewed separately from subscription cancellation and is not immediate."
            : "We explain any information that must be retained for legal reasons."}
        </p>
        <h2 className="text-xl font-semibold text-gray-900">Your right to object</h2>
        <p>
          You can object to processing based on legitimate interests. Email support@cgttracker.com
          to explain which use of your information concerns you. We will respond to your request.
        </p>
        <p>
          You can raise a concern with the{" "}
          <a
            className="text-blue-600 underline"
            href="https://ico.org.uk/make-a-complaint/"
          >
            Information Commissioner’s Office
          </a>
          .{" "}
          <Link className="text-blue-600 underline" href="/contact">
            Contact PSL Digital
          </Link>{" "}
          if you would like us to investigate first.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
