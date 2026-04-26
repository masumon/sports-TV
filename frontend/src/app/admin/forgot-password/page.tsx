"use client";

import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Lock, Mail } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { apiClient } from "@/lib/apiClient";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"request" | "confirm">("request");

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.requestAdminPasswordReset(email);
      if (res.reset_token) {
        setToken(res.reset_token);
        setStep("confirm");
        toast.success("Token received — set your new password below");
      } else {
        toast.message(res.detail, { description: "If the account exists, check that the email is correct and try the next step when you have a token." });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.adminResetPassword(email, token, newPassword);
      toast.success(res.detail);
      setStep("request");
      setToken("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main data-admin className="admin-shell flex min-h-0 items-center justify-center px-4 py-12 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-glass w-full max-w-md rounded-2xl p-6 sm:p-8"
      >
        <div className="mb-5 flex items-center gap-3">
          <Image src="/icons/abo-logo.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl ring-1 ring-white/10" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/90">Admin</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Password reset</h1>
            <p className="text-xs text-zinc-500">Token from response (no email sent)</p>
          </div>
        </div>

        <p className="mb-4 text-sm text-zinc-400">
          The server does not send email. After requesting, copy the <strong className="text-zinc-300">reset_token</strong> from the
          success screen, then set a new password. Token expires in about one hour.
        </p>

        {step === "request" ? (
          <form onSubmit={onRequest} className="space-y-4">
            <label className="block">
              <span className="mb-2 inline-flex items-center gap-2 text-sm text-zinc-300">
                <Mail size={14} />
                Admin email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
                placeholder="admin@test.com"
                autoComplete="email"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-900/30 transition hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound size={16} />
              {loading ? "Requesting…" : "Get reset token"}
            </button>
          </form>
        ) : (
          <form onSubmit={onConfirm} className="space-y-4">
            <label className="block">
              <span className="mb-2 text-sm text-zinc-300">Token (pasted from previous step)</span>
              <textarea
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-2 inline-flex items-center gap-2 text-sm text-zinc-300">
                <Lock size={14} />
                New password
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="mb-2 text-sm text-zinc-300">Confirm new password</span>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
                autoComplete="new-password"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep("request"); setToken(""); setNewPassword(""); setConfirm(""); }}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-2.5 text-sm font-semibold text-black shadow-md shadow-emerald-900/25 transition hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save new password"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-zinc-500">
          <Link href="/admin/login" className="inline-flex items-center justify-center gap-1 text-emerald-400 hover:text-emerald-300">
            <ArrowLeft size={12} /> Back to sign in
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
