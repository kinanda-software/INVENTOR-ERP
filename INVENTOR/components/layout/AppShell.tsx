"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    const tokenKeys = [
      "token",
      "authToken",
      "access_token",
      "accessToken",
      "jwt",
      "jwt_token",
      "audit-token",
      "auth_token",
    ];

    tokenKeys.forEach((key) => {
      localStorage.removeItem(key);
    });

    setMobileOpen(false);
    router.replace("/login");
    router.refresh();
  }

  // Login page has no sidebar or application header.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Main application area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold sm:text-base">
                Operations Workspace
              </h2>

              <p className="hidden text-xs text-slate-500 sm:block">
                Finance · Procurement · Inventory · Fleet
              </p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 sm:inline-flex">
              Management System
            </span>

            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white"
              title="Current workspace"
            >
              IO
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-red-200 px-2.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 sm:px-3"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={17} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Content: independent scrolling */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain p-2 sm:p-3 lg:p-4">
          {children}
        </main>

        {/* Footer */}
        <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 text-center text-xs text-slate-500">
          Integrated Operations Management System
        </footer>
      </div>
    </div>
  );
}