
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardCheck,
  Boxes,
  Wallet,
  Truck,
  BarChart3,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

const navigation: {
  name: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Procurement", href: "/procurement", icon: ShoppingCart },
  { name: "Receiving", href: "/receiving", icon: ClipboardCheck },
  { name: "Inventory", href: "/inventory", icon: Boxes },
  { name: "Finance", href: "/finance", icon: Wallet },
  { name: "Trucking", href: "/trucking", icon: Truck },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Users", href: "/users", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-white">
      {/* Fixed brand header */}
      <div className="z-20 flex h-20 shrink-0 items-center gap-3 border-b border-white/10 bg-slate-950 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold">
          IO
        </div>

        <div className="min-w-0">
          <h1 className="text-sm font-bold">INTEGRATED OPS</h1>
          <p className="mt-1 text-xs text-slate-400">
            Business Management
          </p>
        </div>
      </div>

      {/* Independently scrollable menu */}
      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        <p className="px-6 pb-3 pt-6 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Main Menu
        </p>

        <nav className="space-y-1 px-3 pb-5">
          {navigation.map((item) => {
            const Icon = item.icon;

            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 font-semibold text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-white/10 p-4">
          <p className="text-xs font-semibold text-slate-300">
            Operations System
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Finance, inventory and fleet
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  mobileOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-64 shrink-0 bg-slate-950 text-white md:flex md:flex-col">
        <SidebarContent
          pathname={pathname}
          onNavigate={onClose}
        />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50"
          />

          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden bg-slate-950 text-white shadow-xl">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-4 top-6 z-30 text-slate-300 hover:text-white"
            >
              ✕
            </button>

            <SidebarContent
              pathname={pathname}
              onNavigate={onClose}
            />
          </aside>
        </div>
      )}
    </>
  );
}
