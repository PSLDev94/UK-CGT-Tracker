import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";
import styles from "./auth-frame.module.css";

export function AuthFrame({ children, aside, back = { href: "/", label: "Back to home" } }: {
  children: ReactNode;
  aside?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.mast}>
        <div className={styles.mastInner}>
          <Brand />
          <Link className={styles.back} href={back.href}>
            <span aria-hidden="true">←</span> {back.label}
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
