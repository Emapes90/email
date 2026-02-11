"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Inbox,
  Star,
  Trash2,
  Archive,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  MoreHorizontal,
  CheckSquare,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import { Avatar, EmptyState, SkeletonRows } from "@/components/ui";
import { api } from "@/lib/api";
import { cn, timeAgo, truncate } from "@/lib/utils";
import type { MailMessage, MailListResponse } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: showError } = useToast();

  const folder = searchParams.get("folder") || "INBOX";
  const page = parseInt(searchParams.get("page") || "1", 10);

  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const perPage = 50;

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<MailListResponse>("/mail/messages", {
        folder,
        page: String(page),
        per_page: String(perPage),
      });
      setMessages(data.messages || []);
      setTotal(data.total || 0);
    } catch {
      showError("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [folder, page, showError]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function toggleStar(uid: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.post(`/mail/messages/${uid}/star`, { folder });
      setMessages((prev) =>
        prev.map((m) => (m.uid === uid ? { ...m, starred: !m.starred } : m)),
      );
    } catch {
      showError("Failed to star message");
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map((uid) =>
          api.post(`/mail/messages/${uid}/delete`, { folder }),
        ),
      );
      success(`${selected.size} message(s) deleted`);
      setSelected(new Set());
      loadMessages();
    } catch {
      showError("Failed to delete messages");
    }
  }

  async function archiveSelected() {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map((uid) =>
          api.post(`/mail/messages/${uid}/move`, { folder, target: "Archive" }),
        ),
      );
      success(`${selected.size} message(s) archived`);
      setSelected(new Set());
      loadMessages();
    } catch {
      showError("Failed to archive messages");
    }
  }

  function toggleSelect(uid: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === messages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(messages.map((m) => m.uid)));
    }
  }

  const folderDisplayNames: Record<string, string> = {
    INBOX: "Inbox",
    Sent: "Sent Mail",
    Drafts: "Drafts",
    Trash: "Trash",
    Junk: "Spam",
    Archive: "Archive",
  };

  return (
    <>
      <TopBar
        title={folderDisplayNames[folder] || folder}
        icon={<Inbox className="w-5 h-5" />}
        onSearch={(q) => {
          // TODO: implement search
          console.log("search:", q);
        }}
        onRefresh={loadMessages}
        actions={
          selected.size > 0 ? (
            <div className="flex items-center gap-2 animate-fade-in">
              <span className="text-xs text-brand-400">
                {selected.size} selected
              </span>
              <button
                onClick={archiveSelected}
                className="btn btn-ghost btn-sm"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </button>
              <button
                onClick={deleteSelected}
                className="btn btn-danger btn-sm"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <SkeletonRows rows={12} />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-8 h-8" />}
            title="No messages"
            description={`Your ${(folderDisplayNames[folder] || folder).toLowerCase()} is empty`}
          />
        ) : (
          <div>
            {/* Select All / Bulk bar */}
            <div className="flex items-center gap-3 px-5 py-2 border-b border-surface-200 bg-brand-800/50">
              <button
                onClick={selectAll}
                className={cn(
                  "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                  selected.size === messages.length
                    ? "bg-white border-white text-brand-900"
                    : "border-surface-300 text-transparent hover:border-brand-300",
                )}
              >
                <CheckSquare className="w-3 h-3" />
              </button>
              <span className="text-[11px] text-brand-400">
                {total} message{total !== 1 ? "s" : ""}
                {selected.size > 0 && ` · ${selected.size} selected`}
              </span>
            </div>

            {/* Email List */}
            {messages.map((msg) => {
              const isSelected = selected.has(msg.uid);
              return (
                <Link
                  key={msg.uid}
                  href={`/mail/${msg.uid}?folder=${encodeURIComponent(folder)}`}
                  className={cn(
                    "flex items-center gap-4 px-5 py-3.5 border-b border-surface-200 transition-all group",
                    !msg.read && "bg-white/[0.02]",
                    isSelected && "bg-accent/5",
                    "hover:bg-white/[0.04]",
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSelect(msg.uid);
                    }}
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isSelected
                        ? "bg-white border-white text-brand-900"
                        : "border-surface-300 text-transparent opacity-0 group-hover:opacity-100",
                    )}
                  >
                    <CheckSquare className="w-3 h-3" />
                  </button>

                  {/* Star */}
                  <button
                    onClick={(e) => toggleStar(msg.uid, e)}
                    className={cn(
                      "shrink-0 transition-colors",
                      msg.starred
                        ? "text-amber-400"
                        : "text-brand-500 hover:text-amber-400",
                    )}
                  >
                    <Star
                      className={cn("w-4 h-4", msg.starred && "fill-current")}
                    />
                  </button>

                  {/* Avatar */}
                  <Avatar name={msg.from_name || msg.from_email} size="sm" />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm truncate",
                          !msg.read
                            ? "font-semibold text-white"
                            : "font-medium text-brand-300",
                        )}
                      >
                        {msg.from_name || msg.from_email}
                      </span>
                      {msg.has_attachments && (
                        <Paperclip className="w-3 h-3 text-brand-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span
                        className={cn(
                          "text-sm truncate",
                          !msg.read ? "text-brand-100" : "text-brand-400",
                        )}
                      >
                        {msg.subject || "(No subject)"}
                      </span>
                      <span className="text-xs text-brand-500 truncate hidden sm:inline">
                        — {truncate(msg.preview, 80)}
                      </span>
                    </div>
                  </div>

                  {/* Date */}
                  <span className="text-xs text-brand-400 shrink-0 tabular-nums">
                    {timeAgo(msg.date)}
                  </span>

                  {/* Actions */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="p-1 rounded-lg text-brand-500 hover:text-white hover:bg-surface-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </Link>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-surface-200 bg-brand-800/50">
                <span className="text-xs text-brand-400">
                  Page {page} of {totalPages} · {total} messages
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      router.push(
                        `/inbox?folder=${encodeURIComponent(folder)}&page=${page - 1}`,
                      )
                    }
                    disabled={page <= 1}
                    className="btn btn-ghost btn-icon btn-sm disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      router.push(
                        `/inbox?folder=${encodeURIComponent(folder)}&page=${page + 1}`,
                      )
                    }
                    disabled={page >= totalPages}
                    className="btn btn-ghost btn-icon btn-sm disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
