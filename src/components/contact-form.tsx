"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/ui/api";
import { useHydrated } from "@/ui/use-hydrated";
import {
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { contactTopics, isContactTopic } from "@/ui/contact-topics";
import { WorkspaceMasthead } from "@/ui/workspace-masthead";
import styles from "./public-pages.module.css";
import { billingUrl, type ReportDestination } from "@/domain/reports/destination";

export function ContactForm({
  dashboard = false,
  initialTopic,
  returnReport,
}: {
  dashboard?: boolean;
  initialTopic?: string;
  returnReport?: ReportDestination | null;
}) {
  const requestId = useRef<string | null>(null);
  const [topic, setTopic] = useState(
    isContactTopic(initialTopic) ? initialTopic : "general",
  );
  const backHref = dashboard
    ? initialTopic === "deletion"
      ? "/dashboard/settings"
      : initialTopic === "billing"
        ? (returnReport ? billingUrl(returnReport) : "/billing")
        : "/dashboard"
    : "/";
  const backLabel = dashboard
    ? initialTopic === "deletion"
      ? "Back to settings"
      : initialTopic === "billing"
        ? "Back to billing"
        : "Back to overview"
    : "Back to home";
  const ready = useHydrated();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [invalidField, setInvalidField] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setErrorMsg("");
    setInvalidField("");

    if (
      !name.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      message.trim().length < 10 ||
      message.length > 5000 ||
      name.length > 100 ||
      email.length > 254
    ) {
      setErrorMsg(
        "Enter your name, a valid email and a message of 10–5,000 characters.",
      );
      const invalid =
        !name.trim() || name.length > 100
          ? "contact-name"
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
            ? "contact-email"
            : "contact-message";
      setInvalidField(invalid);
      e.currentTarget.querySelector<HTMLElement>(`#${invalid}`)?.focus();
      setStatus("error");
      return;
    }
    requestId.current ??= crypto.randomUUID();
    try {
      await api("/api/v2/contact", {
        name,
        email,
        message,
        topic,
        requestId: requestId.current,
      });
      setStatus("success");
      requestId.current = null;
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "The message could not be sent. Try again or email support@cgttracker.com.",
      );
      setStatus("error");
    }
  };

  const intro = (
    <>
      Have a question, feedback, or need help with your CGT calculations?
      Contact PSL Digital at <a href="mailto:support@cgttracker.com">support@cgttracker.com</a>, or use this form.
    </>
  );
  return (
    <div className={dashboard ? styles.workspaceContact : styles.publicContact}>
      <div>
        <Link href={backHref} className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
        </Link>
        {dashboard ? (
          <WorkspaceMasthead title="Contact Us">{intro}</WorkspaceMasthead>
        ) : (
          <>
            <h1 className={styles.taskHeading}>Contact Us</h1>
            <p className={styles.intro}>{intro}</p>
          </>
        )}
      </div>
      <div className={styles.formSheet}>
        {/* Success State */}
        {status === "success" ? (
          <div>
            <div role="status" className={styles.accepted}>
              <h2 className={styles.subheading}>
                Message Accepted
              </h2>
              <p className={styles.intro}>
                Your message has been accepted by our email service. The support
                team will reply to the email address you provided.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setMessage("");
                    setStatus("idle");
                  }}
                  className={styles.actionSecondary}
                >
                  Write another message
                </button>
                <Link
                  href={backHref}
                  className={styles.action}
                >
                  {backLabel}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Form */
          <div>
            <form
              noValidate
              onSubmit={handleSubmit}
              aria-busy={!ready || status === "sending"}
              className={styles.contactFields}
            >
              {/* Error Banner */}
              {status === "error" && errorMsg && (
                <div
                  id="contact-error"
                  role="alert"
                  className="flex items-start gap-3 p-3 bg-red-50 border border-red-200"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errorMsg}</p>
                </div>
              )}

              {/* Name */}
              <div>
                <label
                  htmlFor="contact-name"
                >
                  Full Name
                </label>
                <input
                  id="contact-name"
                  disabled={!ready || status === "sending"}
                  aria-invalid={invalidField === "contact-name"}
                  aria-describedby={
                    invalidField === "contact-name"
                      ? "contact-error"
                      : undefined
                  }
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    requestId.current = null;
                  }}
                  autoComplete="name"
                  placeholder="Your full name"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="contact-email"
                >
                  Email Address
                </label>
                <input
                  id="contact-email"
                  disabled={!ready || status === "sending"}
                  aria-invalid={invalidField === "contact-email"}
                  aria-describedby={
                    invalidField === "contact-email"
                      ? "contact-error"
                      : undefined
                  }
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    requestId.current = null;
                  }}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>

              <div className="field">
                <label htmlFor="contact-topic">What can we help with?</label>
                <select
                  id="contact-topic"
                  value={topic}
                  disabled={!ready || status === "sending"}
                  onChange={(event) => {
                    if (isContactTopic(event.target.value))
                      setTopic(event.target.value);
                    requestId.current = null;
                  }}
                >
                  {Object.entries(contactTopics).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {/* Message */}
              <div>
                <label
                  htmlFor="contact-message"
                >
                  Message
                </label>
                <textarea
                  maxLength={5000}
                  id="contact-message"
                  disabled={!ready || status === "sending"}
                  aria-invalid={invalidField === "contact-message"}
                  aria-describedby={
                    invalidField === "contact-message"
                      ? "contact-error"
                      : undefined
                  }
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    requestId.current = null;
                  }}
                  placeholder="How can we help you?"
                  className="resize-none sm:resize-y"
                />
              </div>

              {!ready && <p className="text-sm text-gray-700">The form is loading. You can also email <a className="underline" href="mailto:support@cgttracker.com">support@cgttracker.com</a>.</p>}
              {/* Submit */}
              <button
                type="submit"
                disabled={!ready || status === "sending"}
                className={styles.action}
              >
                {status === "sending" ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    Send message
                  </>
                )}
              </button>

              <p className={styles.meta}>
                If you have a CGT Tracker calculation or import reference, include it here. Do not
                attach passwords or financial exports.
              </p>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
