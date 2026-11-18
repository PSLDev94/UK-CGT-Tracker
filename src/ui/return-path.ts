// Only workspace destinations can be resumed after authentication.
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
