import { cache } from "react";
import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { runtime } from "./runtime";

// Only the navigation needs this flag. Every financial endpoint verifies its own session.
export const hasPublicSession = cache(async () => {
  const requestHeaders = await headers();
  if (!getSessionCookie(requestHeaders, { cookiePrefix: "cgt" })) return false;
  try {
    const { auth } = await runtime();
    const session = await auth.api.getSession({
      headers: requestHeaders,
      query: { disableRefresh: true },
    });
    return Boolean(session?.user);
  } catch {
    // Public guidance and account recovery remain accessible during auth outages.
    return false;
  }
});
