"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, ArrowRight, Shield, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "ProMail";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nextUrl = searchParams.get("next") || "/inbox";
  const sessionExpired = searchParams.get("session") === "expired";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post<AuthResponse>("/auth/login", { email, password });
      router.push(nextUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-brand-900">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />

        <div className="relative z-10 max-w-md px-12 text-center">
          <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center mx-auto mb-8 shadow-glow">
            <Mail className="w-9 h-9 text-brand-900" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
            {APP_NAME}
          </h1>
          <p className="text-brand-300 text-lg leading-relaxed">
            Professional self-hosted email platform with webmail, calendar,
            contacts & complete admin control.
          </p>
          <div className="flex items-center justify-center gap-6 mt-10 text-sm text-brand-400">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4" /> End-to-end encrypted
            </span>
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> DKIM / SPF / DMARC
            </span>
          </div>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-glow-sm">
              <Mail className="w-5 h-5 text-brand-900" />
            </div>
            <span className="text-2xl font-bold text-white">{APP_NAME}</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-brand-400 text-sm">
              Sign in to access your mailbox
            </p>
          </div>

          {sessionExpired && (
            <div className="flex items-center gap-2 px-4 py-3 mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400">
              <Shield className="w-4 h-4 shrink-0" />
              Your session has expired. Please sign in again.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 mb-5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <Lock className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="label">Email Address</label>
              <div className="relative">
                <div className="input-icon">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  required
                  autoFocus
                  autoComplete="email"
                  className="input pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label">Password</label>
              <div className="relative">
                <div className="input-icon">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                  className="input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn btn-primary w-full justify-center h-12 text-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-brand-500 mt-8">
            Secured by {APP_NAME} — Self-hosted Email Platform
          </p>
        </div>
      </div>
    </div>
  );
}
