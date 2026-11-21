"use client";

import { createContext, useContext } from "react";

const PublicAccountContext = createContext({ signedIn: false, subscriptionsOpen: true, billingEnabled: true });
export function PublicAccountProvider({
  signedIn,
  subscriptionsOpen,
  billingEnabled,
  children,
}: {
  signedIn: boolean;
  subscriptionsOpen: boolean;
  billingEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <PublicAccountContext value={{ signedIn, subscriptionsOpen, billingEnabled }}>{children}</PublicAccountContext>
  );
}

export const usePublicAccount = () => useContext(PublicAccountContext).signedIn;
export const useSubscriptionSalesOpen = () => useContext(PublicAccountContext).subscriptionsOpen;
export const useWorkspaceBillingEnabled = () => useContext(PublicAccountContext).billingEnabled;
