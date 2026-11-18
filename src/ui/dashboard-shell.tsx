"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authHref } from "./return-path";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { authApi } from "./api";
import { Notice, Button } from "./primitives";
type Session = { user: { name: string; email: string } };
export function DashboardShell({
  children,
  beforeSignOut,
}: {
  children: React.ReactNode | ((user: Session["user"]) => React.ReactNode);
  beforeSignOut?: (signOut: () => void) => void;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function load() {
    setError("");
    authApi<Session | null>("get-session")
      .then(setSession)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    let active = true;
    authApi<Session | null>("get-session")
      .then((s) => {
        if (active) setSession(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await authApi("sign-out", {});
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
      setBusy(false);
    }
  }
  return (
    <div className="workspace">
      <DashboardSidebar
        userEmail={session?.user.name || ""}
        onSignOut={() =>
          beforeSignOut ? beforeSignOut(signOut) : void signOut()
        }
        busy={busy}
      />
      <main id="main" className="workspace-main">
        {error ? (
          <section className="panel">
            <h1>Your workspace couldn’t be loaded</h1>
            <Notice tone="error">{error}</Notice>
            <Button onClick={load}>Try again</Button>
          </section>
        ) : session === undefined ? (
          <Notice>Loading your workspace…</Notice>
        ) : session === null ? (
          <section className="panel">
            <h1>Sign in to your account</h1>
            <Link
              className="button primary"
              href={authHref(
                "/login",
                typeof window === "undefined"
                  ? undefined
                  : window.location.pathname + window.location.search,
              )}
            >
              Sign in
            </Link>
          </section>
        ) : typeof children === "function" ? (
          children(session.user)
        ) : (
          children
        )}
      </main>
    </div>
  );
}
