import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
export const metadata = { title: "Privacy and your data" };

export default function Privacy() {
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
          CGT Tracker is operated by PSL Digital. Contact{" "}
          <a
            className="text-blue-600 underline"
            href="mailto:support@cgttracker.com"
          >
            support@cgttracker.com
          </a>{" "}
          about your account or personal information.
        </p>
        <div className={styles.referenceBox}>
          <strong>Relaunch preview</strong>
          <p>
            This page describes the review version. The full production privacy
            notice, retention schedule and international-transfer arrangements
            require final review before launch.
          </p>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          Information used by the application
        </h2>
        <p>
          Your name, email, password hash and sessions support sign-in and
          account recovery. Broker account labels, imported transactions,
          supporting references and calculation snapshots let the application
          calculate and explain share gains. Stripe manages payment details; CGT
          Tracker stores billing references and subscription status, not card
          numbers.
        </p>
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
        <h2 className="text-xl font-semibold text-gray-900">
          Service providers, backups and cookies
        </h2>
        <p>
          The preview uses Railway for hosting and PostgreSQL storage, Resend
          for verification, recovery and support email, and Stripe for sandbox
          billing. Cloudflare stores encrypted staging backups in a private EU bucket. An archive expires after 14 days. If we restore a backup, we reapply completed deletion requests before reopening access.
          Essential cookies keep your session secure and return you to the selected report after checkout.
          We count completed steps such as file reviews, repairs and report downloads in our service logs.
          These usage events contain the step and, for file reviews and repairs, a broker category.
          They omit names, account identifiers, amounts and file contents. The application
          does not include advertising trackers or send CSV files to an AI
          service.
        </p>
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
          an account-deletion request. You can also ask for a portable copy or for us to restrict processing where those rights apply. We verify ownership before providing a copy or deleting personal records. We explain any information that must be retained for billing or legal reasons. Deletion is reviewed separately from
          subscription cancellation and is not immediate.
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
