"use client";
/* Re-export for convenience — only Toaster needs to live outside providers */
export { ToastProvider, useToast } from "@/providers/ToastProvider";

import { ToastProvider } from "@/providers/ToastProvider";

export function Toaster() {
  /* The ToastProvider itself renders the toast container */
  return null;
}

/* A standalone Toaster wrapper for the root layout (no context needed) */
export function AppToaster({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
