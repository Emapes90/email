"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Send,
  Paperclip,
  X,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ChevronDown,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import { Button, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { cn, formatBytes, isValidEmail } from "@/lib/utils";
import { useToast } from "@/providers/ToastProvider";

export default function ComposePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const replyTo = searchParams.get("reply");
  const forwardFrom = searchParams.get("forward");

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!to.trim()) {
      errs.to = "At least one recipient is required";
    } else {
      const emails = to.split(/[,;]\s*/);
      const invalid = emails.filter((e) => e.trim() && !isValidEmail(e.trim()));
      if (invalid.length) errs.to = `Invalid email: ${invalid[0]}`;
    }
    if (!subject.trim()) errs.subject = "Subject is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSend() {
    if (!validate()) return;
    setSending(true);

    try {
      const formData = new FormData();
      formData.append("to", to.trim());
      formData.append("subject", subject.trim());
      formData.append("body", body);
      if (cc.trim()) formData.append("cc", cc.trim());
      if (bcc.trim()) formData.append("bcc", bcc.trim());
      if (replyTo) formData.append("reply_to_uid", replyTo);
      attachments.forEach((file) => formData.append("attachments", file));

      await api.upload("/mail/send", formData);
      success("Message sent successfully");
      router.push("/inbox");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send message";
      showError(message);
    } finally {
      setSending(false);
    }
  }

  function handleAttachFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = ""; // reset
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  const totalSize = attachments.reduce((sum, f) => sum + f.size, 0);

  return (
    <>
      <TopBar
        title={replyTo ? "Reply" : forwardFrom ? "Forward" : "New Message"}
        icon={<Send className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" /> Discard
            </Button>
            <Button onClick={handleSend} loading={sending} size="sm">
              <Send className="w-4 h-4" /> Send
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          {/* Compose Card */}
          <div className="card">
            {/* Header Fields */}
            <div className="space-y-0 divide-y divide-surface-200">
              {/* To */}
              <div className="flex items-center px-5 py-3 gap-3">
                <span className="text-xs font-semibold text-brand-400 uppercase w-12 shrink-0">
                  To
                </span>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setErrors((p) => ({ ...p, to: "" }));
                  }}
                  placeholder="recipient@example.com"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-brand-500 outline-none"
                />
                <div className="flex items-center gap-2">
                  {!showCc && (
                    <button
                      onClick={() => setShowCc(true)}
                      className="text-[11px] text-brand-400 hover:text-white transition-colors"
                    >
                      Cc
                    </button>
                  )}
                  {!showBcc && (
                    <button
                      onClick={() => setShowBcc(true)}
                      className="text-[11px] text-brand-400 hover:text-white transition-colors"
                    >
                      Bcc
                    </button>
                  )}
                </div>
              </div>
              {errors.to && (
                <div className="px-5 py-1.5 text-[11px] text-red-400 bg-red-500/5 border-0">
                  {errors.to}
                </div>
              )}

              {/* Cc */}
              {showCc && (
                <div className="flex items-center px-5 py-3 gap-3">
                  <span className="text-xs font-semibold text-brand-400 uppercase w-12 shrink-0">
                    Cc
                  </span>
                  <input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-brand-500 outline-none"
                  />
                  <button
                    onClick={() => {
                      setShowCc(false);
                      setCc("");
                    }}
                    className="text-brand-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Bcc */}
              {showBcc && (
                <div className="flex items-center px-5 py-3 gap-3">
                  <span className="text-xs font-semibold text-brand-400 uppercase w-12 shrink-0">
                    Bcc
                  </span>
                  <input
                    type="text"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="bcc@example.com"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-brand-500 outline-none"
                  />
                  <button
                    onClick={() => {
                      setShowBcc(false);
                      setBcc("");
                    }}
                    className="text-brand-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center px-5 py-3 gap-3">
                <span className="text-xs font-semibold text-brand-400 uppercase w-12 shrink-0">
                  Subj
                </span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setErrors((p) => ({ ...p, subject: "" }));
                  }}
                  placeholder="Subject"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-brand-500 outline-none"
                />
              </div>
              {errors.subject && (
                <div className="px-5 py-1.5 text-[11px] text-red-400 bg-red-500/5 border-0">
                  {errors.subject}
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 px-5 py-2 border-y border-surface-200 bg-brand-900/30">
              <button className="p-1.5 rounded-lg text-brand-400 hover:text-white hover:bg-surface-50 transition-colors">
                <Bold className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg text-brand-400 hover:text-white hover:bg-surface-50 transition-colors">
                <Italic className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg text-brand-400 hover:text-white hover:bg-surface-50 transition-colors">
                <LinkIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-surface-200 mx-1" />
              <button className="p-1.5 rounded-lg text-brand-400 hover:text-white hover:bg-surface-50 transition-colors">
                <List className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg text-brand-400 hover:text-white hover:bg-surface-50 transition-colors">
                <ListOrdered className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              className="w-full min-h-[350px] p-5 bg-transparent text-sm text-brand-200 leading-relaxed
                         placeholder:text-brand-500 outline-none resize-y"
            />

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="px-5 pb-4 space-y-2">
                <div className="text-[11px] text-brand-400 font-semibold uppercase tracking-wider">
                  Attachments ({attachments.length}) · {formatBytes(totalSize)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-2 bg-brand-900/50 border border-surface-200 rounded-lg text-sm"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-brand-400" />
                      <span className="text-brand-300 max-w-[180px] truncate">
                        {file.name}
                      </span>
                      <span className="text-[11px] text-brand-500">
                        {formatBytes(file.size)}
                      </span>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="text-brand-500 hover:text-red-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-surface-200">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleAttachFiles}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-ghost btn-sm"
                >
                  <Paperclip className="w-4 h-4" /> Attach Files
                </button>
              </div>
              <Button onClick={handleSend} loading={sending}>
                <Send className="w-4 h-4" /> Send Message
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
