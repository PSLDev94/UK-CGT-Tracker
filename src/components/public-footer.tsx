"use client";

import { usePublicAccount } from "@/ui/public-account";
import Link from "next/link";
import { Brand } from "@/ui/brand";
import styles from "./public-chrome.module.css";

export function PublicFooter() {
  const signedIn = usePublicAccount();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          {/* Brand */}
          <div>
            <Brand />
            <p>
              UK share gains and losses for self-directed investors. Traceable
              share matching and import review.
            </p>
          </div>

          {/* Guides */}
          <div>
            <h2>Tax Guides</h2>
            <ul>
              <li>
                <Link href="/guide">CGT Guide Overview</Link>
              </li>
              <li>
                <Link href="/guide/section-104-pool">Section 104 Pool</Link>
              </li>
              <li>
                <Link href="/guide/bed-and-breakfast-rule">
                  Bed &amp; Breakfast Rule
                </Link>
              </li>
              <li>
                <Link href="/guide/cgt-rates-2025-26">CGT Rates 2025-26</Link>
              </li>
              <li>
                <Link href="/guide/sa108-how-to-fill-in">
                  How to Fill in SA108
                </Link>
              </li>
            </ul>
          </div>

          {/* Free Tools */}
          <div>
            <h2>Free Tools</h2>
            <ul>
              <li>
                <Link href="/tools/bed-and-breakfast-calculator">
                  B&amp;B Rule Calculator
                </Link>
              </li>
              <li>
                <Link href="/tools/section-104-calculator">
                  Section 104 Calculator
                </Link>
              </li>
              <li>
                <Link href="/tools/cgt-allowance-checker">
                  CGT Allowance Checker
                </Link>
              </li>
            </ul>
            <h2>Brokers</h2>
            <ul>
              <li>
                <Link href="/supported-brokers">All six broker exports</Link>
              </li>
              <li>
                <Link href="/guide/trading-212-cgt">Trading 212 CGT</Link>
              </li>
              <li>
                <Link href="/guide/hargreaves-lansdown-cgt">
                  Hargreaves Lansdown CGT
                </Link>
              </li>
              <li>
                <Link href="/guide/freetrade-cgt">Freetrade CGT</Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h2>Company</h2>
            <ul>
              <li>
                <Link href="/pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/contact">Contact Us</Link>
              </li>
              {signedIn ? (
                <li>
                  <Link href="/dashboard">My workspace</Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link href="/login">Log In</Link>
                  </li>
                  <li>
                    <Link href="/signup">Create a free account</Link>
                  </li>
                </>
              )}
              <li>
                <Link href="/privacy">Privacy &amp; data</Link>
              </li>
              <li>
                <Link href="/terms">Service information</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.colophon}>
          <p>
            &copy; {new Date().getFullYear()} PSL Digital · CGT Tracker. Data
            provided for guidance only. Consult a qualified tax advisor.
          </p>
        </div>
      </div>
    </footer>
  );
}
