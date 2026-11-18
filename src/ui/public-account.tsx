"use client";

import { createContext, useContext } from "react";

const PublicAccountContext = createContext(false);
export function PublicAccountProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  return (
    <PublicAccountContext value={signedIn}>{children}</PublicAccountContext>
  );
}

export const usePublicAccount = () => useContext(PublicAccountContext);
