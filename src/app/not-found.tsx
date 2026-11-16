import Link from "next/link";
import { Header } from "@/ui/header";
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="public-main principles">
        <h1>This page is unavailable.</h1>
        <p>
          The relaunch is replacing the previous website. Your workspace is the
          place to start.
        </p>
        <Link className="button primary" href="/workspace">
          Open workspace
        </Link>
      </main>
    </>
  );
}
