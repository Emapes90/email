"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Star,
  Archive,
  Calendar,
  Users,
  Shield,
  Settings,
  LogOut,
  ChevronDown,
  Mail,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { MailFolder } from "@/lib/types";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "ProMail";

const defaultFolders = [
  { name: "INBOX", display_name: "Inbox", icon: "inbox", count: 0, unread: 0 },
  { name: "Sent", display_name: "Sent", icon: "send", count: 0, unread: 0 },
  {
    name: "Drafts",
    display_name: "Drafts",
    icon: "file-text",
    count: 0,
    unread: 0,
  },
  {
    name: "Trash",
    display_name: "Trash",
    icon: "trash-2",
    count: 0,
    unread: 0,
  },
  { name: "Junk", display_name: "Spam", icon: "archive", count: 0, unread: 0 },
];

const folderIcons: Record<string, React.ReactNode> = {
  inbox: <Inbox className="w-4 h-4" />,
  send: <Send className="w-4 h-4" />,
  "file-text": <FileText className="w-4 h-4" />,
  "trash-2": <Trash2 className="w-4 h-4" />,
  archive: <Archive className="w-4 h-4" />,
  star: <Star className="w-4 h-4" />,
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [folders, setFolders] = useState<MailFolder[]>(defaultFolders);
  const [toolsOpen, setToolsOpen] = useState(true);

  useEffect(() => {
    api
      .get<{ folders: MailFolder[] }>("/mail/folders")
      .then((data) => {
        if (data.folders?.length) setFolders(data.folders);
      })
      .catch(() => {});
  }, []);

  const currentFolder =
    new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    ).get("folder") || "INBOX";

  return (
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

      {/* Compose Button */}
      <div className="p-4">
        <Link href="/compose" className="btn btn-primary w-full justify-center">
          <Plus className="w-4 h-4" />
          Compose
        </Link>
      </div>

      {/* Mailbox Folders */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 space-y-0.5">
        <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-500">
          Mailbox
        </p>
        {folders.map((folder) => {
          const isActive =
            pathname === "/inbox" && currentFolder === folder.name;

          return (
            <Link
              key={folder.name}
              href={`/inbox?folder=${encodeURIComponent(folder.name)}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors group",
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-brand-300 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <span
                className={cn(
                  "shrink-0",
                  isActive
                    ? "text-white"
                    : "text-brand-400 group-hover:text-white",
                )}
              >
                {folderIcons[folder.icon] || <Inbox className="w-4 h-4" />}
              </span>
              <span className="flex-1 truncate font-medium">
                {folder.display_name}
              </span>
              {folder.unread > 0 && (
                <span className="bg-white text-brand-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {folder.unread}
                </span>
              )}
            </Link>
          );
        })}

        {/* Starred */}
        <Link
          href="/inbox?folder=INBOX&starred=1"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors",
            "text-brand-300 hover:bg-white/[0.04] hover:text-white",
          )}
        >
          <Star className="w-4 h-4 text-brand-400" />
          <span className="flex-1 font-medium">Starred</span>
        </Link>

        {/* Tools */}
        <div className="pt-4">
          <button
            onClick={() => setToolsOpen(!toolsOpen)}
            className="flex items-center gap-2 px-3 pb-1.5 w-full text-[10px] font-bold uppercase tracking-widest text-brand-500 hover:text-brand-300 transition-colors"
          >
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform",
                !toolsOpen && "-rotate-90",
              )}
            />
            Tools
          </button>
          {toolsOpen && (
            <div className="space-y-0.5">
              <Link
                href="/calendar"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors",
                  pathname === "/calendar"
                    ? "bg-white/[0.08] text-white"
                    : "text-brand-300 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Calendar</span>
              </Link>
              <Link
                href="/contacts"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors",
                  pathname === "/contacts"
                    ? "bg-white/[0.08] text-white"
                    : "text-brand-300 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Users className="w-4 h-4" />
                <span className="font-medium">Contacts</span>
              </Link>
            </div>
          )}
        </div>

        {/* Admin */}
        {user?.is_admin && (
          <div className="pt-4">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-500">
              Admin
            </p>
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-white/[0.08] text-white"
                  : "text-brand-300 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <Shield className="w-4 h-4" />
              <span className="font-medium">Admin Panel</span>
            </Link>
          </div>
        )}
      </nav>

      {/* User Card */}
      <div className="p-3 border-t border-surface-200">
        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-50 transition-colors group">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.email?.slice(0, 2).toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {user?.name || user?.email}
            </div>
            <div className="text-[11px] text-brand-400 truncate">
              {user?.email}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link
              href="/settings"
              className="p-1.5 rounded-lg hover:bg-surface-100 text-brand-400 hover:text-white transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-brand-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
