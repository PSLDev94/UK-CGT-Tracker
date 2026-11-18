"use client";
import { useEffect, useState } from "react";
import { WorkspaceEntry } from "./workspace-entry";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { authApi } from "./api";
import { Notice, Button } from "./primitives";
type Session = {
  user: { name: string; email: string };
  session?: { id: string };
};
export function DashboardShell({
  children,
  beforeSignOut,
  selectedYear,
}: {
  children:
    | React.ReactNode
    | ((user: Session["user"], sessionId?: string) => React.ReactNode);
  beforeSignOut?: (signOut: () => void) => void;
  selectedYear?: string;
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
  if (!session) {
    if (session === null && !error) {
      return (
        <WorkspaceEntry
          next={window.location.pathname + window.location.search}
        />
      );
    }
    return (
      <main id="main" className="classic-auth">
        {error ? (
          <section className="auth-wrap panel">
            <h1>Your workspace couldn’t be loaded</h1>
            <Notice tone="error">{error}</Notice>
            <Button onClick={load}>Try again</Button>
          </section>
        ) : (
          <Notice>Loading your workspace…</Notice>
        )}
      </main>
    );
  }
  return (
    <div className="workspace">
      <DashboardSidebar
        selectedYear={selectedYear}
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
        ) : typeof children === "function" ? (
          children(session.user, session.session?.id)
        ) : (
          children
        )}
      </main>
    </div>
  );
}
