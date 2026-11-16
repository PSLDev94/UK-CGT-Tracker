import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          cgt
        </span>
        <span>CGT Tracker</span>
      </Link>
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
