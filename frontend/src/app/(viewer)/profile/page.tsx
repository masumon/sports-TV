"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Globe, History, LogOut, Moon, Sun, User } from "lucide-react";
import { ViewerPageShell } from "@/components/layout/ViewerPageShell";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { useAuthStore } from "@/store/authStore";

const SETTINGS = [
  { id: "history", label: "Watch History", labelBn: "দেখার ইতিহাস", icon: History, href: "/history" },
  { id: "reminders", label: "Match Reminders", labelBn: "ম্যাচ রিমাইন্ডার", icon: Bell, href: "/sports" },
] as const;

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const { locale, setLocale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();

  const displayName = user?.full_name ?? "Guest Viewer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "G";

  return (
    <ViewerPageShell>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <GlassPanel className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent-gold/30 bg-accent-gold/10 text-2xl font-bold text-accent-gold">
            {user ? initial : <User size={28} />}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-heading-1 text-foreground">{displayName}</h1>
            <p className="text-sm text-foreground-secondary">
              {user?.email ?? "Browse live sports for free"}
            </p>
            {user ? (
              <p className="mt-1 text-xs text-foreground-muted">
                Member · {user.subscription_tier === "premium" ? "Premium" : "Free"}
              </p>
            ) : null}
          </div>
        </GlassPanel>

        <section className="space-y-2">
          <h2 className="text-heading-2 text-foreground">Settings</h2>
          <GlassPanel padding="none" className="overflow-hidden">
            {SETTINGS.map((item) => {
              const Icon = item.icon;
              const label = locale === "bn" ? item.labelBn : item.label;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3 border-b border-glass-border px-4 py-3.5 text-sm text-foreground transition hover:bg-surface-elevated last:border-0"
                >
                  <Icon size={18} className="text-accent-cyan" aria-hidden />
                  {label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "bn" : "en")}
              className="flex w-full items-center gap-3 border-b border-glass-border px-4 py-3.5 text-left text-sm text-foreground transition hover:bg-surface-elevated"
            >
              <Globe size={18} className="text-accent-cyan" aria-hidden />
              Language / ভাষা ({locale.toUpperCase()})
            </button>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-foreground transition hover:bg-surface-elevated"
            >
              {resolvedTheme === "dark" ? (
                <Sun size={18} className="text-accent-gold" aria-hidden />
              ) : (
                <Moon size={18} className="text-accent-gold" aria-hidden />
              )}
              Theme
            </button>
          </GlassPanel>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={() => router.push("/")}>
            Back to Home
          </Button>
          {user ? (
            <Button variant="ghost" className="flex-1" onClick={() => clearSession()}>
              <LogOut size={16} className="mr-2" aria-hidden />
              Sign out
            </Button>
          ) : null}
        </div>
      </div>
    </ViewerPageShell>
  );
}
