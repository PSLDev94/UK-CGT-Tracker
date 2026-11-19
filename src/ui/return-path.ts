// Only workspace destinations can be resumed after authentication.
import { BROKERS } from "../domain/imports/brokers";
import { readDisposalLocation } from "./disposal-location";

const destinations = new Set([
  "/workspace",
  "/billing",
  "/dashboard",
  "/dashboard/accounts",
  "/dashboard/upload",
  "/dashboard/history",
  "/dashboard/calculations",
  "/dashboard/reports",
  "/dashboard/settings",
  "/dashboard/contact",
  "/dashboard/tax-loss-harvesting",
]);

export function safeReturnPath(value?: string | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 500)
    return "/dashboard";
  try {
    const base = "https://workspace.invalid";
    const url = new URL(value, base);
    if (url.origin !== base || !destinations.has(url.pathname))
      return "/dashboard";
    const params = new URLSearchParams();
    for (const [key, val] of url.searchParams) {
      if (key === "broker" && ["/dashboard/upload", "/dashboard/accounts"].includes(url.pathname) && BROKERS.some((broker) => broker.id === val))
        params.set(key, val);
      if (key === "source" && (url.pathname === "/dashboard/calculations" || url.pathname === "/dashboard/history") && readDisposalLocation(val))
        params.set(key, val);
      if (url.pathname === "/dashboard/history" && (
        (key === "receipt" && /^[0-9a-f-]{36}$/i.test(val)) ||
        (key === "record" && /^[1-9]\d{0,7}$/.test(val))
      )) params.set(key, val);
      if (
        (url.pathname === "/billing" ||
          url.pathname === "/dashboard/reports") &&
        key === "checkout" &&
        ["returned", "cancelled", "portal"].includes(val)
      )
        params.set(key, val);
      if (
        [
          "year",
          "format",
          "account",
          "draft",
          "saved",
          "topic",
          "view",
        ].includes(key) &&
        /^[a-zA-Z0-9-]{1,64}$/.test(val)
      )
        params.set(key, val);
    }
    return url.pathname + (params.size ? "?" + params : "");
  } catch {
    return "/dashboard";
  }
}

export function authHref(path: string, next?: string | null) {
  const destination = safeReturnPath(next);
  if (destination === "/dashboard") return path;
  return (
    path +
    (path.includes("?") ? "&" : "?") +
    new URLSearchParams({ next: destination })
  );
}
