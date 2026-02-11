"use client";

import { Search, Bell, RefreshCw } from "lucide-react";
import { useState, useCallback } from "react";
import { cn, debounce } from "@/lib/utils";

interface TopBarProps {
  title: string;
  icon?: React.ReactNode;
  onSearch?: (query: string) => void;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  searchPlaceholder?: string;
}

export default function TopBar({
  title,
  icon,
  onSearch,
  onRefresh,
  actions,
  searchPlaceholder,
}: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((q: string) => onSearch?.(q), 300),
    [onSearch],
  );

  const handleRefresh = async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="h-[60px] bg-brand-800/80 backdrop-blur-md border-b border-surface-200 flex items-center gap-4 px-5 shrink-0 sticky top-0 z-20">
      {/* Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-accent shrink-0">{icon}</span>}
        <h1 className="text-base font-semibold text-white truncate">{title}</h1>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      {onSearch && (
        <div
          className={cn(
            "relative transition-all duration-300",
            searchOpen ? "w-64" : "w-9",
          )}
        >
          {searchOpen ? (
            <input
              autoFocus
              type="text"
              placeholder={searchPlaceholder || "Search…"}
              className="input h-9 text-sm pl-9"
              onChange={(e) => debouncedSearch(e.target.value)}
              onBlur={(e) => {
                if (!e.target.value) setSearchOpen(false);
              }}
            />
          ) : null}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={cn(
              "absolute left-0 top-0 h-9 w-9 flex items-center justify-center rounded-xl",
              "text-brand-400 hover:text-white transition-colors",
              !searchOpen && "relative hover:bg-surface-50",
            )}
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Refresh */}
      {onRefresh && (
        <button
          onClick={handleRefresh}
          className="btn-icon p-2 rounded-xl text-brand-400 hover:text-white hover:bg-surface-50 transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        </button>
      )}

      {/* Notifications placeholder */}
      <button className="relative p-2 rounded-xl text-brand-400 hover:text-white hover:bg-surface-50 transition-colors">
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* Extra actions */}
      {actions}
    </div>
  );
}
