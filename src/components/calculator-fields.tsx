"use client";

import type { ReactNode } from "react";
import { useHydrated } from "@/ui/use-hydrated";

export function CalculatorFields({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  const ready = useHydrated();
  return (
    <fieldset
      aria-label={label}
      aria-busy={!ready}
      disabled={!ready}
      className={`min-w-0 ${className}`}
    >
      {!ready && (
        <p className="px-6 pt-4 text-sm text-gray-700">Loading calculator…</p>
      )}
      {children}
    </fieldset>
  );
}
