"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Globe,
  Users,
  ArrowLeftRight,
  Activity,
  AlertTriangle,
  HardDrive,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import { Skeleton, SkeletonRows } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  DashboardData,
  ServiceStatus,
  LoginLogEntry,
  AdminStats,
} from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  href?: string;
}

export default function AdminDashboard() {
  const { success, error: showError } = useToast();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [recentLogins, setRecentLogins] = useState<LoginLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<DashboardData>("/admin/dashboard");
      setStats(data.stats);
      setServices(data.services || []);
      setRecentLogins(data.recent_logins || []);
    } catch {
      showError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function restartService(name: string) {
    try {
      await api.post(`/admin/services/${name}/restart`);
      success(`${name} restarted`);
      loadDashboard();
    } catch {
      showError(`Failed to restart ${name}`);
    }
  }

  const statCards: StatCard[] = stats
    ? [
        {
          label: "Active Domains",
          value: stats.active_domains,
          icon: <Globe className="w-5 h-5" />,
          color: "from-blue-500 to-blue-600",
          href: "/admin/domains",
        },
        {
          label: "Active Accounts",
          value: stats.active_accounts,
          icon: <Users className="w-5 h-5" />,
          color: "from-emerald-500 to-emerald-600",
          href: "/admin/accounts",
        },
        {
          label: "Email Aliases",
          value: stats.total_aliases,
          icon: <ArrowLeftRight className="w-5 h-5" />,
          color: "from-purple-500 to-purple-600",
          href: "/admin/aliases",
        },
        {
          label: "Logins Today",
          value: stats.logins_today,
          icon: <Activity className="w-5 h-5" />,
          color: "from-cyan-500 to-cyan-600",
          href: "/admin/logs",
        },
        {
          label: "Failed Logins",
          value: stats.failed_logins_today,
          icon: <AlertTriangle className="w-5 h-5" />,
          color: "from-red-500 to-red-600",
          href: "/admin/logs",
        },
        {
          label: "Disk Usage",
          value: `${stats.disk_percent}%`,
          icon: <HardDrive className="w-5 h-5" />,
          color: "from-amber-500 to-amber-600",
        },
      ]
    : [];

  return (
    <>
      <TopBar
        title="Dashboard"
        icon={<LayoutDashboard className="w-5 h-5" />}
        onRefresh={loadDashboard}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-4 space-y-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            : statCards.map((card) => {
                const content = (
                  <div className="card p-4 hover:border-surface-300 transition-all group cursor-pointer">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white mb-3",
                        card.color,
                      )}
                    >
                      {card.icon}
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {card.value}
                    </div>
                    <div className="text-xs text-brand-400 mt-0.5 flex items-center gap-1">
                      {card.label}
                      {card.href && (
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    {/* Disk progress bar */}
                    {card.label === "Disk Usage" && stats && (
                      <div className="mt-2 h-1.5 bg-brand-900 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            stats.disk_percent > 90
                              ? "bg-red-500"
                              : stats.disk_percent > 70
                                ? "bg-amber-500"
                                : "bg-emerald-500",
                          )}
                          style={{ width: `${stats.disk_percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
                return card.href ? (
                  <Link key={card.label} href={card.href}>
                    {content}
                  </Link>
                ) : (
                  <div key={card.label}>{content}</div>
                );
              })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Services */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" /> Services
              </h3>
            </div>
            <div className="divide-y divide-surface-200">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <Skeleton className="w-2 h-2 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))
                : services.map((svc) => (
                    <div
                      key={svc.name}
                      className="flex items-center gap-3 px-5 py-3 group"
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          svc.running
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                            : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">
                          {svc.display_name || svc.name}
                        </div>
                        <div className="text-[11px] text-brand-400">
                          {svc.running ? "Running" : "Stopped"}
                        </div>
                      </div>
                      {!svc.running && (
                        <button
                          onClick={() => restartService(svc.name)}
                          className="btn btn-ghost btn-icon btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Restart"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
            </div>
          </div>

          {/* Recent Logins */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" /> Recent Activity
              </h3>
              <Link href="/admin/logs" className="btn btn-ghost btn-sm">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>IP</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td>
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td>
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td>
                            <Skeleton className="h-5 w-14 rounded-full" />
                          </td>
                          <td>
                            <Skeleton className="h-4 w-12" />
                          </td>
                        </tr>
                      ))
                    : recentLogins.slice(0, 10).map((log) => (
                        <tr key={log.id}>
                          <td className="text-sm text-white truncate max-w-[160px]">
                            {log.email}
                          </td>
                          <td className="text-xs text-brand-400 font-mono">
                            {log.ip_address}
                          </td>
                          <td>
                            <span
                              className={cn(
                                "badge",
                                log.success ? "badge-success" : "badge-danger",
                              )}
                            >
                              {log.success ? (
                                <>
                                  <CheckCircle className="w-3 h-3" /> OK
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" /> Fail
                                </>
                              )}
                            </span>
                          </td>
                          <td className="text-xs text-brand-400">
                            {log.created_at
                              ? new Date(log.created_at).toLocaleTimeString(
                                  "en-US",
                                  { hour: "2-digit", minute: "2-digit" },
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* System Info */}
        {stats && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-accent" /> System Information
              </h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-[11px] text-brand-400 uppercase tracking-wider font-semibold">
                    Uptime
                  </div>
                  <div className="text-sm font-semibold text-white mt-1">
                    {stats.uptime}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-brand-400 uppercase tracking-wider font-semibold">
                    Total Disk
                  </div>
                  <div className="text-sm font-semibold text-white mt-1">
                    {stats.disk_total}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-brand-400 uppercase tracking-wider font-semibold">
                    Free Disk
                  </div>
                  <div className="text-sm font-semibold text-white mt-1">
                    {stats.disk_free}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-brand-400 uppercase tracking-wider font-semibold">
                    ProMail Version
                  </div>
                  <div className="text-sm font-semibold text-white mt-1">
                    v{process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
