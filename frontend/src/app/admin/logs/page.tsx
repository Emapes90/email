"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import { SkeletonRows, EmptyState } from "@/components/ui";
import { api } from "@/lib/api";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { LoginLogEntry, PaginatedResponse } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

export default function LogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: showError } = useToast();

  const page = parseInt(searchParams.get("page") || "1", 10);
  const logType = searchParams.get("type") || "all";

  const [logs, setLogs] = useState<LoginLogEntry[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<LoginLogEntry>>(
        "/admin/logs",
        {
          page: String(page),
          type: logType,
        },
      );
      setLogs(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch {
      showError("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [page, logType, showError]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  function setFilter(type: string) {
    router.push(`/admin/logs?type=${type}&page=1`);
  }

  function goPage(p: number) {
    router.push(`/admin/logs?type=${logType}&page=${p}`);
  }

  const filters = [
    { value: "all", label: "All" },
    { value: "success", label: "Successful" },
    { value: "failed", label: "Failed" },
  ];

  return (
    <>
      <TopBar
        title="Login Logs"
        icon={<FileText className="w-5 h-5" />}
        onRefresh={loadLogs}
        actions={
          <div className="flex items-center gap-1 bg-brand-900/50 rounded-xl p-0.5">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  logType === f.value
                    ? "bg-white text-brand-900"
                    : "text-brand-300 hover:text-white",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="card overflow-hidden">
          {loading ? (
            <SkeletonRows rows={15} />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-8 h-8" />}
              title="No logs found"
              description={
                logType !== "all"
                  ? `No ${logType} login attempts`
                  : "No login activity recorded yet"
              }
            />
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>IP Address</th>
                    <th>User Agent</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-sm font-medium text-white max-w-[200px] truncate">
                        {log.email}
                      </td>
                      <td className="text-xs text-brand-400 font-mono">
                        {log.ip_address}
                      </td>
                      <td
                        className="text-xs text-brand-500 max-w-[200px] truncate"
                        title={log.user_agent}
                      >
                        {log.user_agent
                          ? log.user_agent.slice(0, 40) + "…"
                          : "—"}
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
                              <CheckCircle className="w-3 h-3" /> Success
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Failed
                            </>
                          )}
                        </span>
                      </td>
                      <td className="text-xs text-brand-400">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="text-xs text-brand-400">
                        {log.created_at ? formatTime(log.created_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-surface-200 bg-brand-900/30">
                  <span className="text-xs text-brand-400">
                    Page {page} of {totalPages} · {total} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => goPage(page - 1)}
                      disabled={page <= 1}
                      className="btn btn-ghost btn-icon btn-sm disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let p: number;
                      if (totalPages <= 5) {
                        p = i + 1;
                      } else if (page <= 3) {
                        p = i + 1;
                      } else if (page >= totalPages - 2) {
                        p = totalPages - 4 + i;
                      } else {
                        p = page - 2 + i;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => goPage(p)}
                          className={cn(
                            "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                            page === p
                              ? "bg-white text-brand-900"
                              : "text-brand-300 hover:bg-surface-50",
                          )}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => goPage(page + 1)}
                      disabled={page >= totalPages}
                      className="btn btn-ghost btn-icon btn-sm disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
