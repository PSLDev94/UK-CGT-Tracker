import Link from "next/link";
import { Header } from "@/ui/header";
export const metadata = { title: "Page unavailable" };

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="public-main principles">
        <h1>This page is unavailable.</h1>
        <p>
          This address may have changed. Return to your overview or browse the broker guides.
        </p>
        <Link className="button primary" href="/dashboard">
          Open workspace
        </Link>
        <Link className="button secondary" href="/supported-brokers">Check broker support</Link>
      </main>
    </>
  );
}
