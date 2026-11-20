"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  ChartNoAxesCombined,
  Upload,
  LogOut,
  Settings,
  FileText,
  TrendingDown,
  Menu,
  X,
  MessageSquare,
  WalletCards,
  History,
  CreditCard,
} from "lucide-react";

import { Brand } from "@/ui/brand";
import styles from "./dashboard-sidebar.module.css";

export type WorkspaceView =
  "overview" | "accounts" | "imports" | "calculations" | "history";

const groups = [
  [
    { name: "Overview", href: "/dashboard", icon: ChartNoAxesCombined },
    { name: "Broker accounts", href: "/dashboard/accounts", icon: WalletCards },
    { name: "Upload CSV", href: "/dashboard/upload", icon: Upload },
    { name: "Import history", href: "/dashboard/history", icon: History },
    { name: "Calculations", href: "/dashboard/calculations", icon: Calculator },
    { name: "Reports", href: "/dashboard/reports", icon: FileText },
  ],
  [
    {
      name: "Tax-Loss Harvesting",
      href: "/dashboard/tax-loss-harvesting",
      icon: TrendingDown,
    },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
    { name: "Billing", href: "/billing", icon: CreditCard },
    { name: "Contact Us", href: "/dashboard/contact", icon: MessageSquare },
  ],
];

export function DashboardSidebar({
  userEmail,
  onSignOut,
  busy = false,
  brokerSupportHref = "/supported-brokers",
  selectedYear,
}: {
  userEmail: string;
  onSignOut: () => void;
  busy?: boolean;
  brokerSupportHref?: string;
  selectedYear?: string;
}) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const currentPath = pathname === "/workspace" ? "/dashboard/accounts" : pathname;
  useEffect(() => {
    if (!open) return;
    function closeMenu(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
      setOpen(false);
      menuButton.current?.focus();
    }
    document.addEventListener("keydown", closeMenu);
    return () => document.removeEventListener("keydown", closeMenu);
  }, [open]);
  return (
    <aside aria-label="Workspace navigation" className={styles.sidebar}>
      <div className={styles.rail}>
        <div className={styles.mast}>
          <Brand href="/dashboard" />
          <button
            type="button"
            ref={menuButton}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="dashboard-navigation"
            aria-label={open ? "Close sidebar menu" : "Open sidebar menu"}
            className={styles.toggle}
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            {open ? "Close" : "Menu"}
          </button>
        </div>
        <div id="dashboard-navigation" data-open={open} className={styles.navigation}>
          <nav className={styles.links} aria-label="Dashboard">
            {groups.map((group) => (
              <ul className={styles.group} key={group[0].href}>
                {group.map(({ name, href, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={selectedYear && (href === "/dashboard/calculations" || href === "/dashboard/reports")
                        ? href + "?year=" + encodeURIComponent(selectedYear)
                        : href}
                      aria-disabled={busy || undefined}
                      onClick={(event) => {
                        if (busy) event.preventDefault();
                        else setOpen(false);
                      }}
                      aria-current={currentPath === href ? "page" : undefined}
                      className={styles.link}
                    >
                      <Icon aria-hidden="true" size={18} />
                      <span>{name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
            <Link href={brokerSupportHref} className={styles.support}>Broker support</Link>
          </nav>
          <div className={styles.identity}>
            <div className={styles.user}>{userEmail || "Private workspace"}</div>
            <button type="button" disabled={busy} onClick={onSignOut} className={styles.signOut}>
              <LogOut aria-hidden="true" size={17} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
