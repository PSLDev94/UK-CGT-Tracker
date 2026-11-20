"use client";
import { useEffect, useState } from "react";
import { WorkspaceEntry } from "./workspace-entry";
import { AuthFrame } from "./auth-frame";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { authApi, readWorkspaceSession } from "./api";
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
    | ((user: Session["user"], sessionId: string | undefined, updateName: (name: string) => void) => React.ReactNode);
  beforeSignOut?: (signOut: () => void) => void;
  selectedYear?: string;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [sessionWait, setSessionWait] = useState("");
  function load() {
    setError("");
    setSessionWait("");
    setSessionAttempt(attempt => attempt + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    readWorkspaceSession<Session | null>(controller.signal, setSessionWait)
      .then((s) => {
        if (!controller.signal.aborted) setSession(s);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [sessionAttempt]);
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
      <AuthFrame>
        {error ? (
          <section>
            <h1>Your workspace couldn’t be loaded</h1>
            <Notice tone="error">{error}</Notice>
            <Button onClick={load}>Try again</Button>
          </section>
        ) : (
          <Notice>{sessionWait || "Loading your workspace…"}</Notice>
        )}
      </AuthFrame>
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
        ) : sessionWait ? (
          <Notice>{sessionWait}</Notice>
        ) : typeof children === "function" ? (
          children(session.user, session.session?.id, (name) => setSession((current) => current && ({ ...current, user: { ...current.user, name } })))
        ) : (
          children
        )}
      </main>
    </div>
  );
}
