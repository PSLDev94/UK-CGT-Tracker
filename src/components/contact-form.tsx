"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Send,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  PieChart,
  Mail,
  User,
  MessageSquare,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";

export function ContactForm({ dashboard = false }: { dashboard?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    if (
      !name.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !message.trim()
    ) {
      setErrorMsg("Enter your name, a valid email and a message.");
      setStatus("error");
      return;
    }
    window.location.href = `mailto:support@cgttracker.com?subject=${encodeURIComponent("CGT Tracker support")}&body=${encodeURIComponent(`Name: ${name}\nReply email: ${email}\n\n${message}`)}`;
    setStatus("success");
  };

  return (
    <div className="bg-white font-sans text-gray-900">
      {/* Navigation */}
      {!dashboard && <PublicNav />}

      <div className="max-w-2xl mx-auto py-16 px-4">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
            Contact Us
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Have a question, feedback, or need help with your CGT calculations?
            Prepare a message to support@cgttracker.com in your email app.
          </p>
        </div>

        {/* Success State */}
        {status === "success" ? (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-green-400 to-emerald-500"></div>
            <div className="p-8 sm:p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Email Draft Prepared
              </h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Your email app has been asked to open a draft. Check and send it
                there. If no app opened, email support@cgttracker.com directly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setStatus("idle")}
                  className="px-6 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Edit your message
                </button>
                <Link
                  href="/"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-center"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Form */
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            <form
              noValidate
              onSubmit={handleSubmit}
              className="p-6 sm:p-8 space-y-6"
            >
              {/* Error Banner */}
              {status === "error" && errorMsg && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errorMsg}</p>
                </div>
              )}

              {/* Name */}
              <div>
                <label
                  htmlFor="contact-name"
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  Full Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow placeholder:text-gray-400"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="contact-email"
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2"
                >
                  <Mail className="w-4 h-4 text-gray-400" />
                  Email Address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow placeholder:text-gray-400"
                />
              </div>

              {/* Message */}
              <div>
                <label
                  htmlFor="contact-message"
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2"
                >
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  Message
                </label>
                <textarea
                  style={{ resize: "none" }}
                  id="contact-message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help you?"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none placeholder:text-gray-400"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-sm"
              >
                {status === "sending" ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Prepare email
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Include your broker and the issue you need help with. Do not
                attach passwords or financial exports.
              </p>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t py-12 text-center bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900">CGTTracker</span>
          </div>
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} CGT Tracker. Data provided for
            guidance. Consult a qualified advisor.
          </p>
          <div className="flex gap-6 text-sm font-medium">
            <Link
              href="/guide"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Tax Guide
            </Link>
            <Link
              href="/pricing"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
