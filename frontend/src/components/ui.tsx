"use client";

/* ========================================================================
   ProMail — Reusable UI Components
   ======================================================================== */

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
} from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Modal ─────────────────────────────────────────────────────────────── */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  className,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "w-full max-w-lg bg-brand-800 border border-surface-200 rounded-2xl shadow-card animate-slide-up",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            {icon}
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-brand-400 hover:text-white hover:bg-surface-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Button ────────────────────────────────────────────────────────────── */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      icon,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const variants = {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      danger: "btn-danger",
    };
    const sizes = {
      sm: "btn-sm",
      md: "",
      lg: "px-6 py-3 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn("btn", variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

/* ── Input ─────────────────────────────────────────────────────────────── */
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, hint, error, icon, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="label">{label}</label>}
        <div className="relative">
          {icon && <div className="input-icon">{icon}</div>}
          <input
            ref={ref}
            className={cn(
              "input",
              icon && "pl-10",
              error &&
                "border-red-500 focus:border-red-500 focus:ring-red-500/30",
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
        {hint && !error && <p className="form-hint">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

/* ── Textarea ──────────────────────────────────────────────────────────── */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="label">{label}</label>}
        <textarea
          ref={ref}
          className={cn(
            "input min-h-[120px] resize-y",
            error && "border-red-500",
            className,
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

/* ── Select ────────────────────────────────────────────────────────────── */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string | number; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="label">{label}</label>}
        <select
          ref={ref}
          className={cn("input pr-8 appearance-none", className)}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
);
Select.displayName = "Select";

/* ── Skeleton ──────────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/* ── Empty State ───────────────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-50 flex items-center justify-center mb-4 text-brand-400">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-brand-400 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Avatar ────────────────────────────────────────────────────────────── */
export function Avatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = name
    ? name
        .replace(/@.*$/, "")
        .split(/[\s._-]+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  const sizes = {
    sm: "w-8 h-8 text-[11px]",
    md: "w-10 h-10 text-xs",
    lg: "w-12 h-12 text-sm",
  };

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white shrink-0",
        sizes[size],
        className,
      )}
      style={{
        background: color || `linear-gradient(135deg, #667eea, #764ba2)`,
      }}
    >
      {initials}
    </div>
  );
}

/* ── Confirm Dialog ────────────────────────────────────────────────────── */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-brand-300">{message}</p>
    </Modal>
  );
}
