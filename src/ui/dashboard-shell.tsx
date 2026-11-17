"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { authApi } from "./api";
import { Notice, Button } from "./primitives";
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<{ user: { name: string } } | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function load() {
    setError("");
    authApi<{ user: { name: string } } | null>("get-session")
      .then(setSession)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    let active = true;
    authApi<{ user: { name: string } } | null>("get-session")
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
        onSignOut={signOut}
        busy={busy}
      />
      <main id="main" className="workspace-main">
        {error ? (
          <>
            <Notice tone="error">{error}</Notice>
            <Button onClick={load}>Try again</Button>
          </>
        ) : session === undefined ? (
          <Notice>Loading your workspace…</Notice>
        ) : session === null ? (
          <section className="panel">
            <h1>Sign in to your account</h1>
            <Link className="button primary" href="/login">
              Sign in
            </Link>
          </section>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
