"use client";
import {
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import Link from "next/link";
import { User, Key, CreditCard, AlertTriangle } from "lucide-react";
import { authApi } from "./api";
import { DashboardShell } from "./dashboard-shell";
import { LeaveDialog, useNavigationGuard } from "./navigation-guard";
import {
  Button,
  Field,
  Notice,
  PasswordField,
  focusFirstError,
} from "./primitives";
// Keep only an unsaved display name in this tab's memory. History stores an
// opaque entry ID. Passwords never enter the restoration mechanism.
type ProfileDraft = { entry: string; session: string; name: string };
let profileDraft: ProfileDraft | null = null;
type SignOutGuard = (action: () => void) => void;

export function RestoredSettings() {
  const guard = useRef<SignOutGuard | null>(null);
  return (
    <DashboardShell
      beforeSignOut={(action) =>
        guard.current ? guard.current(action) : action()
      }
    >
      {(user, sessionId, updateName) => (
        <SettingsEditor
          key={sessionId ?? user.email}
          user={user}
          updateName={updateName}
          sessionId={sessionId}
          guard={guard}
        />
      )}
    </DashboardShell>
  );
}

function SettingsEditor({
  user,
  updateName,
  sessionId,
  guard,
}: {
  user: { name: string; email: string };
  updateName: (name: string) => void;
  sessionId?: string;
  guard: RefObject<SignOutGuard | null>;
}) {
  const [editedName, setEditedName] = useState<string | null>(() => {
    if (!profileDraft || !sessionId || profileDraft.session !== sessionId)
      return null;
    return profileDraft.entry === window.history.state?.cgtSettingsEntry
      ? profileDraft.name
      : null;
  });
  function editName(value: string) {
    const name = value === user.name ? null : value;
    setEditedName(name);
    if (name === null || !sessionId) {
      profileDraft = null;
      return;
    }
    let entry = window.history.state?.cgtSettingsEntry;
    if (!entry) {
      entry = crypto.randomUUID();
      window.history.replaceState(
        { ...window.history.state, cgtSettingsEntry: entry },
        "",
      );
    }
    profileDraft = { entry, session: sessionId, name };
  }
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigation = useNavigationGuard(
    editedName !== null || passwordDirty,
    busy,
  );
  useImperativeHandle(guard, () => navigation.request, [navigation.request]);
  async function submit(
    e: FormEvent<HTMLFormElement>,
    kind: "profile" | "password",
  ) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const d = new FormData(form);
    const name = String(d.get("name") ?? "").trim();
    const current = String(d.get("currentPassword") ?? "");
    const password = String(d.get("newPassword") ?? "");
    const next: Record<string, string> = {};
    if (kind === "profile" && (!name || name.length > 100))
      next.name = "Enter your name (up to 100 characters).";
    if (kind === "password") {
      if (!current) next.currentPassword = "Enter your current password.";
      if (password.length < 12 || password.length > 128)
        next.newPassword = "Use 12–128 characters.";
      if (password !== d.get("confirmation"))
        next.confirmation = "The passwords do not match.";
    }
    setErrors(next);
    setError("");
    setMessage("");
    if (Object.keys(next).length) {
      focusFirstError(form, next);
      return;
    }
    setBusy(true);
    try {
      if (kind === "profile") {
        await authApi("update-user", { name });
        profileDraft = null;
        updateName(name);
        setEditedName(null);
        setMessage("Profile updated successfully.");
      } else {
        await authApi("change-password", {
          currentPassword: current,
          newPassword: password,
          revokeOtherSessions: true,
        });
        form.reset();
        setPasswordDirty(false);
        setMessage(
          "Password changed. Your other sessions have been signed out.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account, password, and subscription.
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <User size={20} className="text-blue-600" aria-hidden="true" />
          Profile
        </h2>
        <form
          noValidate
          className="form-stack"
          onSubmit={(e) => submit(e, "profile")}
        >
          <Field
            id="settings-email"
            label="Email address"
            value={user.email}
            readOnly
            hint="Contact support if you need to change your email."
          />
          <Field
            id="name"
            name="name"
            label="Full name"
            value={editedName ?? user.name}
            disabled={busy}
            onChange={(event) => editName(event.target.value)}
            autoComplete="name"
            error={errors.name}
          />
          <Button type="submit" busy={busy}>
            Save changes
          </Button>
        </form>
      </section>
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Key size={20} className="text-blue-600" aria-hidden="true" />
          Change Password
        </h2>
        <form
          noValidate
          className="form-stack"
          onChange={(event) => {
            const values = new FormData(event.currentTarget);
            setPasswordDirty(
              ["currentPassword", "newPassword", "confirmation"].some(
                (field) => !!values.get(field),
              ),
            );
          }}
          onSubmit={(e) => submit(e, "password")}
        >
          <PasswordField
            id="currentPassword"
            name="currentPassword"
            label="Current password"
            disabled={busy}
            autoComplete="current-password"
            error={errors.currentPassword}
          />
          <PasswordField
            id="newPassword"
            name="newPassword"
            label="New password"
            disabled={busy}
            autoComplete="new-password"
            hint="12–128 characters."
            error={errors.newPassword}
          />
          <PasswordField
            id="confirmation"
            name="confirmation"
            label="Confirm new password"
            disabled={busy}
            autoComplete="new-password"
            error={errors.confirmation}
          />
          <Button type="submit" busy={busy}>
            Change password
          </Button>
        </form>
      </section>
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <CreditCard size={20} className="text-blue-600" aria-hidden="true" />
          Subscription
        </h2>
        <p>View your plan, checkout status and Stripe customer portal.</p>
        <Link href="/billing" className="button primary">
          Manage subscription
        </Link>
      </section>
      <section className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2 mb-4">
          <AlertTriangle size={20} aria-hidden="true" />
          Account data and deletion
        </h2>
        <p>
          Reverse individual imports from Import history. Permanent data
          deletion requests are handled by support after verifying account
          ownership and any record-retention requirements. Subscription
          cancellation is separate.
        </p>
        <Link
          className="button secondary"
          href="/dashboard/contact?topic=deletion"
        >
          Contact support about data deletion
        </Link>
      </section>
      <LeaveDialog
        guard={{
          ...navigation,
          leave: () => {
            profileDraft = null;
            setEditedName(null);
            navigation.leave();
          },
        }}
        title="Leave settings?"
        confirm="Discard changes and leave"
      >
        Your unsaved edits will be lost. Stay here to save them.
      </LeaveDialog>
    </div>
  );
}
