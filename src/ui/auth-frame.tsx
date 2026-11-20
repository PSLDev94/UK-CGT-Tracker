import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";
import styles from "./auth-frame.module.css";

export function AuthFrame({ children, aside, pricingReturn = false }: {
  children: ReactNode;
  aside?: ReactNode;
  pricingReturn?: boolean;
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.mast}>
        <div className={styles.mastInner}>
          <Brand />
          <Link className={styles.back} href={pricingReturn ? "/pricing" : "/"}>
            <span aria-hidden="true">←</span> {pricingReturn ? "Back to pricing" : "Back to home"}
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={aside ? styles.withAside : styles.main}>
        <div className={styles.formRegion}>{children}</div>
        {aside}
      </main>
    </div>
  );
}
