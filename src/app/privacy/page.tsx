import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
export const metadata = { title: "Privacy and your data" };

export default function Privacy() {
  return (
    <>
      <PublicNav />
      <main
        id="main"
        className="max-w-3xl mx-auto px-4 py-16 space-y-6 text-gray-700"
      >
        <h1 className="text-3xl font-bold text-gray-900">
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
        <div className="rounded-xl border bg-blue-50 p-5">
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
          Service providers and cookies
        </h2>
        <p>
          The preview uses Railway for hosting and PostgreSQL storage, Resend
          for verification, recovery and support email, and Stripe for sandbox
          billing. The production domain is managed through Cloudflare.
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
          an account-deletion request. Deletion is reviewed separately from
          subscription cancellation and is not immediate.
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
    </>
  );
}
