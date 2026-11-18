"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PieChart, ChevronDown, Menu, X } from "lucide-react";

const TOOLS = [
  {
    href: "/tools/bed-and-breakfast-calculator",
    label: "B&B Rule Calculator",
    subtitle: "Check the 30-day rule",
  },
  {
    href: "/tools/section-104-calculator",
    label: "Section 104 Calculator",
    subtitle: "Build your cost pool",
  },
  {
    href: "/tools/cgt-allowance-checker",
    label: "CGT Allowance Checker",
    subtitle: "Estimate your annual allowance",
  },
];

const NAV_LINKS = [
  { href: "/supported-brokers", label: "Broker support" },
  { href: "/pricing", label: "Pricing" },
  { href: "/guide", label: "CGT Guide" },
  { href: "/contact", label: "Contact" },
];

export function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // desktop tools dropdown
  const [mobileOpen, setMobileOpen] = useState(false); // mobile hamburger
  const toolsButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close desktop dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (open) toolsButton.current?.focus();
        else if (mobileOpen) mobileButton.current?.focus();
        setOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open, mobileOpen]);
  const isToolsActive = pathname.startsWith("/tools/");

  return (
    <nav
      aria-label="Main navigation"
      className="border-b sticky top-0 bg-white/80 backdrop-blur-md z-50 transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm shadow-blue-200">
              <PieChart className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="text-xl font-bold tracking-tight text-gray-900">
              CGT<span className="text-blue-600">Tracker</span>
            </div>
          </Link>

          <div className="flex gap-1 sm:gap-4 items-center">
            {/* Free Tools Dropdown — desktop only (hover + click) */}
            <div ref={dropdownRef} className="relative hidden lg:block">
              <button
                type="button"
                aria-expanded={open}
                ref={toolsButton}
                aria-controls="public-tools"
                onClick={() => setOpen((v) => !v)}
                className={`text-sm font-medium px-3 py-2 transition-colors flex items-center gap-1 ${
                  isToolsActive
                    ? "text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Free Tools
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown panel */}
              <div
                id="public-tools"
                hidden={!open}
                className={`absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 transition-all duration-150 ${
                  open
                    ? "opacity-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 -translate-y-1 pointer-events-none"
                }`}
              >
                {TOOLS.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    aria-current={pathname === tool.href ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-2.5 transition-colors ${
                      pathname === tool.href
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50 text-gray-900"
                    }`}
                  >
                    <span className="text-sm font-medium block">
                      {tool.label}
                    </span>
                    <span className="text-xs text-gray-500 block mt-0.5">
                      {tool.subtitle}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop nav links */}
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 aria-[current=page]:text-blue-700 px-3 py-2 hidden lg:inline transition-colors"
              >
                {link.label}
              </Link>
            ))}

            {/* Desktop-only Log in */}
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 transition-colors hidden lg:inline"
            >
              Log in
            </Link>

            {/* Sign up free — always visible */}
            <Link
              href="/signup"
              className="min-h-11 inline-flex items-center text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-all shadow-sm hover:shadow active:scale-95"
            >
              Sign up free
            </Link>

            {/* Mobile hamburger button — rightmost on mobile */}
            <button
              type="button"
              aria-expanded={mobileOpen}
              ref={mobileButton}
              aria-controls="public-mobile"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden min-h-11 min-w-11 inline-flex items-center justify-center p-2 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <>
          {/* Panel */}
          <div
            id="public-mobile"
            className="absolute max-h-[calc(100dvh-4rem)] overflow-y-auto left-0 right-0 top-16 bg-white border-b shadow-lg z-50 lg:hidden animate-slide-down"
          >
            <div className="max-w-7xl mx-auto px-4 py-3">
              {/* Main nav links */}
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Free Tools — expanded by default */}
              <div className="mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  Free Tools
                </p>
                {TOOLS.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    aria-current={pathname === tool.href ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex flex-col px-3 py-3 pl-6 rounded-lg transition-colors ${
                      pathname === tool.href
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-sm font-medium">{tool.label}</span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      {tool.subtitle}
                    </span>
                  </Link>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 my-3" />

              {/* Auth links */}
              <Link
                href="/login"
                className={`block px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/login"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-900 hover:bg-gray-50"
                }`}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="block mt-2 text-center bg-blue-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Sign up free
              </Link>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
