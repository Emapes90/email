"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Reply,
  Forward,
  Trash2,
  Archive,
  Star,
  Download,
  Paperclip,
  MoreHorizontal,
  Printer,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import { Avatar, Button, SkeletonRows } from "@/components/ui";
import { api } from "@/lib/api";
import {
  cn,
  formatDate,
  formatTime,
  formatBytes,
  stringToColor,
} from "@/lib/utils";
import type { MailMessageFull } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

export default function MailReadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { success, error: showError } = useToast();

  const uid = params.id as string;
  const folder = searchParams.get("folder") || "INBOX";

  const [message, setMessage] = useState<MailMessageFull | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMessage = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ message: MailMessageFull }>(
        `/mail/messages/${uid}`,
        { folder },
      );
      setMessage(data.message);
    } catch {
      showError("Failed to load message");
    } finally {
      setLoading(false);
    }
  }, [uid, folder, showError]);

  useEffect(() => {
    loadMessage();
  }, [loadMessage]);

  async function handleStar() {
    if (!message) return;
    try {
      await api.post(`/mail/messages/${uid}/star`, { folder });
      setMessage((prev) => (prev ? { ...prev, starred: !prev.starred } : prev));
    } catch {
      showError("Failed to star message");
    }
  }

  async function handleDelete() {
    try {
      await api.post(`/mail/messages/${uid}/delete`, { folder });
      success("Message deleted");
      router.push(`/inbox?folder=${encodeURIComponent(folder)}`);
    } catch {
      showError("Failed to delete message");
    }
  }

  async function handleArchive() {
    try {
      await api.post(`/mail/messages/${uid}/move`, {
        folder,
        target: "Archive",
      });
      success("Message archived");
      router.push(`/inbox?folder=${encodeURIComponent(folder)}`);
    } catch {
      showError("Failed to archive message");
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="Loading…" icon={<ArrowLeft className="w-5 h-5" />} />
        <SkeletonRows rows={8} />
      </>
    );
  }

  if (!message) {
    return (
      <>
        <TopBar
          title="Message not found"
          icon={<ArrowLeft className="w-5 h-5" />}
        />
        <div className="flex-1 flex items-center justify-center text-brand-400">
          This message could not be loaded.
        </div>
      </>
    );
  }

  return (
    <>
      {/* Top Bar */}
      <TopBar
        title=""
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={`/inbox?folder=${encodeURIComponent(folder)}`}
              className="btn btn-ghost btn-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <div className="w-px h-5 bg-surface-200 mx-1" />
            <Link
              href={`/compose?reply=${uid}&folder=${encodeURIComponent(folder)}`}
              className="btn btn-ghost btn-sm"
            >
              <Reply className="w-4 h-4" /> Reply
            </Link>
            <Link
              href={`/compose?forward=${uid}&folder=${encodeURIComponent(folder)}`}
              className="btn btn-ghost btn-sm"
            >
              <Forward className="w-4 h-4" /> Forward
            </Link>
            <div className="w-px h-5 bg-surface-200 mx-1" />
            <button
              onClick={handleArchive}
              className="btn btn-ghost btn-icon btn-sm"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              className="btn btn-ghost btn-icon btn-sm text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleStar}
              className="btn btn-ghost btn-icon btn-sm"
            >
              <Star
                className={cn(
                  "w-4 h-4",
                  message.starred && "fill-amber-400 text-amber-400",
                )}
              />
            </button>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Message View */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Subject */}
          <h1 className="text-xl font-bold text-white leading-snug">
            {message.subject || "(No subject)"}
          </h1>

          {/* Sender Info */}
          <div className="flex items-start gap-4">
            <Avatar
              name={message.from_name || message.from_email}
              color={stringToColor(message.from_email)}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white">
                  {message.from_name || message.from_email}
                </span>
                <span className="text-xs text-brand-400">
                  &lt;{message.from_email}&gt;
                </span>
              </div>
              <div className="text-xs text-brand-400 mt-0.5">
                To: <span className="text-brand-300">{message.to}</span>
                {message.cc && (
                  <>
                    {" "}
                    · Cc: <span className="text-brand-300">{message.cc}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-brand-400">
                {formatDate(message.date)}
              </div>
              <div className="text-[11px] text-brand-500">
                {formatTime(message.date)}
              </div>
            </div>
          </div>

          {/* Attachments */}
          {message.attachments?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="flex items-center gap-2 text-sm font-medium text-brand-300">
                  <Paperclip className="w-4 h-4" />
                  {message.attachments.length} Attachment
                  {message.attachments.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={`/api/mail/messages/${uid}/attachments/${att.index}?folder=${encodeURIComponent(folder)}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-brand-900/50 hover:bg-surface-50 border border-surface-200 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {att.filename}
                      </div>
                      <div className="text-[11px] text-brand-400">
                        {formatBytes(att.size)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Email Body */}
          <div className="card">
            <div className="p-6">
              {message.body_html ? (
                <div
                  className="prose prose-invert max-w-none text-sm leading-relaxed
                    [&_a]:text-accent [&_a]:underline
                    [&_img]:max-w-full [&_img]:rounded-lg
                    [&_blockquote]:border-l-2 [&_blockquote]:border-surface-300 [&_blockquote]:pl-4 [&_blockquote]:text-brand-400
                    [&_pre]:bg-brand-900 [&_pre]:rounded-lg [&_pre]:p-4
                    [&_table]:border-collapse [&_td]:border [&_td]:border-surface-200 [&_td]:p-2"
                  dangerouslySetInnerHTML={{ __html: message.body_html }}
                />
              ) : (
                <pre className="text-sm text-brand-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {message.body_text}
                </pre>
              )}
            </div>
          </div>

          {/* Quick Reply */}
          <div className="flex gap-3">
            <Link
              href={`/compose?reply=${uid}&folder=${encodeURIComponent(folder)}`}
              className="btn btn-primary"
            >
              <Reply className="w-4 h-4" /> Reply
            </Link>
            <Link
              href={`/compose?forward=${uid}&folder=${encodeURIComponent(folder)}`}
              className="btn btn-secondary"
            >
              <Forward className="w-4 h-4" /> Forward
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
