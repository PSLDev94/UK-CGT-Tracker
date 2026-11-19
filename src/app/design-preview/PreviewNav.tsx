"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import styles from "./preview.module.css";

export function PreviewNav() {
  const current = usePathname();
  return (
    <nav aria-label="Design preview" className={styles.nav}>
      <Link
        href="/design-preview"
        aria-current={current === "/design-preview" ? "page" : undefined}
      >
        Homepage
      </Link>
      <Link
        href="/design-preview/calculations"
        aria-current={
          current === "/design-preview/calculations" ? "page" : undefined
        }
      >
        Calculation
      </Link>
      <a href="/design-preview/report.pdf">
        <FileText size={15} aria-hidden="true" />
        Sample PDF
      </a>
    </nav>
  );
}
