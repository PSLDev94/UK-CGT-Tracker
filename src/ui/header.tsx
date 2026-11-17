import Link from "next/link";
import { Brand } from "./brand";

export function Header() {
  return (
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="/supported-brokers">Broker support</Link>
        <Link href="/account/sign-in">Sign in</Link>
        <Link className="button primary" href="/workspace">
          Open workspace
        </Link>
      </nav>
    </header>
  );
}
