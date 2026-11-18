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
  PieChart,
  CreditCard,
} from "lucide-react";

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
}: {
  userEmail: string;
  onSignOut: () => void;
  busy?: boolean;
  brokerSupportHref?: string;
}) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
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
    <aside
      aria-label="Workspace navigation"
      className="bg-white border-r border-gray-200 flex flex-col"
    >
      <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-gray-100 p-[16px] min-[801px]:p-6">
        <Link
          href="/dashboard"
          className="flex min-w-0 max-w-full items-center gap-[8px] text-xl font-bold text-gray-900"
        >
          <span className="shrink-0 rounded-lg bg-blue-600 p-[6px]">
            <PieChart size={18} className="text-white" aria-hidden="true" />
          </span>
          <span className="min-w-0 [overflow-wrap:anywhere]">
            CGT<wbr /><span className="text-blue-600">Tracker</span>
          </span>
        </Link>
        <button
          type="button"
          ref={menuButton}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="dashboard-navigation"
          aria-label={open ? "Close sidebar menu" : "Open sidebar menu"}
          className="ms-auto inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md p-[8px] text-gray-600 hover:bg-gray-100 min-[801px]:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <div
        id="dashboard-navigation"
        className={`${open ? "flex" : "hidden"} min-[801px]:flex flex-col flex-1`}
      >
        <nav className="flex-1 p-4" aria-label="Dashboard">
          {groups.map((group, index) => (
            <div
              key={group[0].href}
              className={index ? "mt-3 pt-3 border-t border-gray-100" : ""}
            >
              {group.map(({ name, href, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (pathname === "/workspace" && href === "/dashboard/accounts");
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-disabled={busy || undefined}
                    onClick={(event) => {
                      if (busy) event.preventDefault();
                      else setOpen(false);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center px-4 py-2.5 text-sm font-medium rounded-md ${active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    <Icon aria-hidden="true" className="w-5 h-5 mr-3" />
                    {name}
                  </Link>
                );
              })}
            </div>
          ))}
          <Link
            href={brokerSupportHref}
            className="block px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
          >
            Broker support
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-100 mt-auto">
          <div className="text-sm font-medium text-gray-900 px-4 mb-2 break-all">
            {userEmail || "Private workspace"}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onSignOut}
            className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
          >
            <LogOut aria-hidden="true" className="w-5 h-5 mr-3" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
