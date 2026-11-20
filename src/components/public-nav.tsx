"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePublicAccount } from "@/ui/public-account";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Brand } from "@/ui/brand";
import styles from "./public-chrome.module.css";

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
  { href: "/sample-calculation", label: "Sample statement" },
  { href: "/pricing", label: "Pricing" },
  { href: "/guide", label: "CGT Guide" },
  { href: "/contact", label: "Contact" },
];

export function PublicNav({ backToUpload }: { backToUpload?: string } = {}) {
  const signedIn = usePublicAccount();
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

  const accountLabel = signedIn
    ? backToUpload
      ? "Back to upload"
      : "My workspace"
    : "Sign up free";
  function navLinks() {
    return NAV_LINKS.map((link) => (
      <Link
        key={link.href}
        href={link.href}
        aria-current={pathname === link.href ? "page" : undefined}
        onClick={() => setMobileOpen(false)}
      >
        {link.label}
      </Link>
    ));
  }
  function toolLinks() {
    return TOOLS.map((tool) => (
      <Link
        key={tool.href}
        href={tool.href}
        aria-current={pathname === tool.href ? "page" : undefined}
        onClick={() => {
          setOpen(false);
          setMobileOpen(false);
        }}
      >
        <span>{tool.label}</span>
        <small>{tool.subtitle}</small>
      </Link>
    ));
  }
  return (
    <nav className={styles.mast} aria-label="Main navigation">
      <div className={styles.mastInner}>
        <Brand />
        <div className={styles.actions}>
          <div className={styles.desktopLinks}>
            <div ref={dropdownRef} className={styles.dropdown}>
              <button
                type="button"
                ref={toolsButton}
                aria-controls="public-tools"
                aria-expanded={open}
                data-active={isToolsActive}
                onClick={() => setOpen((v) => !v)}
              >
                Free Tools <ChevronDown aria-hidden="true" size={14} />
              </button>
              <div id="public-tools" className={styles.toolList} hidden={!open}>
                {toolLinks()}
              </div>
            </div>
            {navLinks()}
            {!signedIn && <Link href="/login">Log in</Link>}
          </div>
          <Link
            className={styles.account}
            href={signedIn ? (backToUpload ?? "/dashboard") : "/signup"}
          >
            {accountLabel}
          </Link>
          <button
            className={styles.menuToggle}
            type="button"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-controls="public-mobile"
            ref={mobileButton}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>
        {mobileOpen && (
          <div id="public-mobile" className={styles.mobileList}>
            {navLinks()}
            <p>Free Tools</p>
            {toolLinks()}
            {!signedIn && (
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                Log in
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
