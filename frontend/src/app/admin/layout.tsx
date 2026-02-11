"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  Globe,
  Users,
  ArrowLeftRight,
  Settings,
  FileText,
  ArrowLeft,
  Mail,
} from "lucide-react";
import { AuthProvider } from "@/providers/AuthProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "ProMail";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/domains", label: "Domains", icon: Globe },
  { href: "/admin/accounts", label: "Accounts", icon: Users },
  { href: "/admin/aliases", label: "Aliases", icon: ArrowLeftRight },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/logs", label: "Logs", icon: FileText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex h-screen overflow-hidden">
          {/* Admin Sidebar */}
          <aside className="w-[260px] h-screen bg-brand-800 border-r border-surface-200 flex flex-col shrink-0">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-surface-200">
              <Link href="/inbox" className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
                  <Mail className="w-4 h-4 text-brand-900" />
                </div>
                <span className="text-base font-bold text-white tracking-tight">
                  {APP_NAME}
                </span>
              </Link>
            </div>

            {/* Back to Mail */}
            <div className="p-4">
              <Link
                href="/inbox"
                className="btn btn-secondary w-full justify-center"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Mail
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 space-y-0.5">
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-500">
                <Shield className="w-3 h-3 inline-block mr-1" />
                Administration
              </p>
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors group",
                      isActive
                        ? "bg-white/[0.08] text-white"
                        : "text-brand-300 hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive
                          ? "text-white"
                          : "text-brand-400 group-hover:text-white",
                      )}
                    />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-surface-200">
              <div className="text-[11px] text-brand-500 text-center">
                {APP_NAME} Admin v
                {process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
