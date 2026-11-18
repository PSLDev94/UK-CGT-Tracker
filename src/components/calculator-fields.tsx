"use client";

import { type ReactNode, useSyncExternalStore } from "react";

// The static form must stay read-only until React can retain the first edit.
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function CalculatorFields({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
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
