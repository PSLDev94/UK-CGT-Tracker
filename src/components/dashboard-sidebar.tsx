"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
import {
  Calculator,
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
} from "lucide-react";
export type WorkspaceView = "accounts" | "imports" | "calculations" | "history";
const links = [
  {
    name: "Tax Overview",
    href: "/dashboard",
    icon: Calculator,
    view: "calculations",
  },
  {
    name: "Upload CSV",
    href: "/dashboard/upload",
    icon: Upload,
    view: "imports",
  },
  {
    name: "Tax-Loss Harvesting",
    href: "/dashboard/tax-loss-harvesting",
    icon: TrendingDown,
  },
  { name: "Reports", href: "/dashboard/reports", icon: FileText },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "Contact Us", href: "/dashboard/contact", icon: MessageSquare },
  {
    name: "Broker accounts",
    href: "/dashboard/accounts",
    icon: WalletCards,
    view: "accounts",
  },
  {
    name: "Import history",
    href: "/dashboard/history",
    icon: History,
    view: "history",
  },
];
export function DashboardSidebar({
  userEmail,
  view,
  onView,
  onSignOut,
  busy = false,
}: {
  userEmail: string;
  view?: WorkspaceView;
  onView?: (view: WorkspaceView) => void;
  onSignOut: () => void;
  busy?: boolean;
}) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <aside
      aria-label="Workspace navigation"
      className="bg-white border-r border-gray-200 flex flex-col"
    >
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          CGT Tracker
        </Link>
        <button
          type="button"
          ref={menuButton}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="dashboard-navigation"
          aria-label={open ? "Close sidebar menu" : "Open sidebar menu"}
          className="md:hidden p-2 text-gray-600 rounded-md hover:bg-gray-100"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <div
        id="dashboard-navigation"
        className={`${open ? "flex" : "hidden"} md:flex flex-col flex-1`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <nav className="flex-1 p-4 space-y-1" aria-label="Dashboard">
          {links.map((link) => {
            const Icon = link.icon;
            const active =
              onView && link.view ? view === link.view : pathname === link.href;
            const cls = `flex w-full items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`;
            const content = (
              <>
                <Icon
                  aria-hidden="true"
                  className={`w-5 h-5 mr-3 ${active ? "text-blue-600" : "text-gray-400"}`}
                />
                {link.name}
              </>
            );
            return onView && link.view ? (
              <button
                key={link.href}
                type="button"
                disabled={busy}
                className={cls}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  onView(link.view as WorkspaceView);
                  setOpen(false);
                }}
              >
                {content}
              </button>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={cls}
                aria-current={active ? "page" : undefined}
              >
                {content}
              </Link>
            );
          })}
          <Link
            href="/supported-brokers"
            className="block px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
          >
            Broker support
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-100 mt-auto">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider px-4 mb-2">
            Signed in as
          </div>
          <div className="text-sm font-medium text-gray-900 px-4 mb-4 break-all">
            {userEmail || "Private workspace"}
          </div>
          <Link
            href="/billing"
            className="block px-4 py-2 text-sm text-blue-600"
          >
            Billing test
          </Link>
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
