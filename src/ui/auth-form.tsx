"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "./api";
import {
  Button,
  Field,
  PasswordField,
  Notice,
  focusFirstError,
} from "./primitives";

export type AuthMode = "sign-in" | "sign-up" | "recover" | "reset" | "verify";
const copy: Record<
  AuthMode,
  { title: string; description: string; action: string }
> = {
  "sign-in": {
    title: "Welcome back.",
    description: "Sign in to your CGT Tracker workspace.",
    action: "Sign in",
  },
  "sign-up": {
    title: "Start with your records.",
    description:
      "Create an account for the relaunch preview. Verify your email before uploading financial information.",
    action: "Create account",
  },
  recover: {
    title: "Reset your password.",
    description:
      "We’ll send a link if there is an account for this email address.",
    action: "Send reset link",
  },
  reset: {
    title: "Choose a new password.",
    description: "Changing your password signs out your existing sessions.",
    action: "Set new password",
  },
  verify: {
    title: "Verify your email.",
    description:
      "Request another verification link, then follow it to activate access to your workspace.",
    action: "Send verification link",
  },
};

export function AuthForm({ mode, token }: { mode: AuthMode; token?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (mode === "reset")
      window.history.replaceState(null, "", window.location.pathname);
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const name = String(values.get("name") ?? "").trim();
    const next: Record<string, string> = {};
    if (mode !== "reset" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address.";
    if (mode === "sign-up" && (!name || name.length > 100))
      next.name = "Enter your name (up to 100 characters).";
    if (
      ["sign-in", "sign-up", "reset"].includes(mode) &&
      (password.length < 12 || password.length > 128)
    )
      next.password = "Use 12–128 characters.";
    if (
      ["sign-up", "reset"].includes(mode) &&
      password !== values.get("confirmation")
    )
      next.confirmation = "The passwords do not match.";
    setErrors(next);
    setError("");
    setMessage("");
    if (Object.keys(next).length) {
      focusFirstError(form, next);
      return;
    }
    if (mode === "reset" && !token) {
      setError("This reset link is missing or invalid. Request a new link.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "sign-in") {
        await authApi("sign-in/email", { email, password });
        router.replace("/workspace");
        router.refresh();
      } else if (mode === "sign-up") {
        await authApi("sign-up/email", {
          email,
          password,
          name,
          callbackURL: `${location.origin}/account/sign-in`,
        });
        form.reset();
        setMessage(
          "Check your inbox. If this address can be registered, a verification link is on its way. After verifying, return here to sign in.",
        );
      } else if (mode === "recover") {
        await authApi("request-password-reset", {
          email,
          redirectTo: `${location.origin}/account/reset`,
        });
        setMessage(
          "If there is an account for this address, a reset link is on its way. The link expires in 30 minutes.",
        );
      } else if (mode === "verify") {
        await authApi("send-verification-email", {
          email,
          callbackURL: `${location.origin}/account/sign-in`,
        });
        setMessage(
          "If verification is needed for this address, a new link is on its way. Check your inbox and spam folder.",
        );
      } else {
        await authApi("reset-password", { token, newPassword: password });
        form.reset();
        setMessage(
          "Your password has been reset. Sign in with your new password to continue.",
        );
      }
    } catch (caught) {
      const failure = caught as ApiError;
      setError(
        mode === "sign-in" && failure.status === 401
          ? "The email or password was not recognised. Check your details and try again."
          : failure.message,
      );
      if (mode === "sign-in" && failure.status === 401) {
        const field = form.elements.namedItem("password") as HTMLInputElement;
        field.value = "";
        field.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-wrap panel">
      <span className="eyebrow">Your CGT Tracker account</span>
      <h1>{copy[mode].title}</h1>
      <p className="muted">{copy[mode].description}</p>
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <form
        noValidate
        onSubmit={submit}
        className="form-stack"
        aria-busy={busy}
      >
        {mode === "sign-up" && (
          <Field
            id="name"
            name="name"
            label="Your name"
            autoComplete="name"
            maxLength={100}
            error={errors.name}
          />
        )}
        {mode !== "reset" && (
          <Field
            id="email"
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            error={errors.email}
          />
        )}
        {["sign-in", "sign-up", "reset"].includes(mode) && (
          <PasswordField
            id="password"
            name="password"
            label={mode === "reset" ? "New password" : "Password"}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            hint="12–128 characters. You can paste or use a password manager."
            error={errors.password}
          />
        )}
        {["sign-up", "reset"].includes(mode) && (
          <PasswordField
            id="confirmation"
            name="confirmation"
            label="Confirm password"
            autoComplete="new-password"
            error={errors.confirmation}
          />
        )}
        <Button
          type="submit"
          busy={busy}
          disabled={mode === "reset" && !!message}
        >
          {busy ? "Please wait…" : copy[mode].action}
        </Button>
      </form>
      <div className="actions">
        {mode === "sign-in" ? (
          <>
            <Link href="/account/recover">Forgot password?</Link>
            <Link href="/account/sign-up">Create account</Link>
          </>
        ) : (
          <Link href="/account/sign-in">Back to sign in</Link>
        )}
      </div>
      {mode === "sign-in" && (
        <p className="caption">
          <Link href="/account/verify">Need another verification email?</Link>
        </p>
      )}
      {mode === "reset" && !token && (
        <Link href="/account/recover">Request a new reset link</Link>
      )}
    </section>
  );
}
