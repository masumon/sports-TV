"use client";

import { motion } from "framer-motion";
import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";

export default function AdminLoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.login(email, password);
      setSession(response.access_token, {
        id: response.user.id,
        full_name: response.user.full_name,
        email: response.user.email,
        is_admin: response.user.is_admin,
        subscription_tier: response.user.subscription_tier === "premium" ? "premium" : "free",
      });
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "লগইন ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main data-admin className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full rounded-2xl border border-white/10 bg-zinc-950/70 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/abo-logo.svg" alt="ABO" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Login</h1>
            <p className="text-xs text-zinc-400">ABO SPORTS TV LIVE</p>
          </div>
        </div>
        <p className="mb-6 text-sm text-zinc-400">Secure dashboard access for stream and score management.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 inline-flex items-center gap-2 text-sm text-zinc-300">
              <Mail size={14} />
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
              placeholder="admin@test.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 inline-flex items-center gap-2 text-sm text-zinc-300">
              <Lock size={14} />
              Password
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
              placeholder="••••••••"
            />
          </label>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Return to{" "}
          <Link href="/" className="text-emerald-400 hover:text-emerald-300">
            viewer
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
