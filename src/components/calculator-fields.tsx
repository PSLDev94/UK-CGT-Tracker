"use client";

import type { ReactNode } from "react";
import styles from "./calculator.module.css";
import { useHydrated } from "@/ui/use-hydrated";

export function CalculatorFields({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const ready = useHydrated();
  return (
    <fieldset
      aria-label={label}
      aria-busy={!ready}
      disabled={!ready}
      className={styles.sheet}
    >
      {!ready && (
        <p className="px-6 pt-4 text-sm text-gray-700">Loading calculator…</p>
      )}
      {children}
    </fieldset>
  );
}
