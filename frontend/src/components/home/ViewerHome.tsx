"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Activity, RefreshCw, ShieldCheck, SlidersHorizontal, Tv2 } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdSlot } from "@/components/ads/AdSlot";
import { ChannelCard } from "@/components/channel/ChannelCard";
import { AppShell } from "@/components/layout/AppShell";
import { ChannelSkeletonGrid } from "@/components/ui/ChannelSkeleton";
import { fetchAllChannels, apiClient } from "@/lib/apiClient";
import { useI18n } from "@/lib/i18n/LocaleContext";
import type { Channel, LiveScore } from "@/lib/types";
import { usePlayerStore } from "@/store/playerStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";

const LiveScoreOverlay = dynamic(() => import("@/components/LiveScoreOverlay"), { ssr: false });
const PremiumPlayer = dynamic(
  () => import("@/components/PremiumPlayer").then((m) => m.default),
  { ssr: false, loading: () => <div className="player-shell aspect-video animate-pulse bg-slate-900" /> }
);

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function ViewerHome() {
  const { t } = useI18n();
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [filterCountry, setFilterCountry] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [scores, setScores] = useState<LiveScore[]>([]);
  const tier = useSubscriptionStore((s) => s.tier);

  const activeChannel = usePlayerStore((state) => state.activeChannel);
  const isTheaterMode = usePlayerStore((state) => state.isTheaterMode);
  const setActiveChannel = usePlayerStore((state) => state.setActiveChannel);
  const toggleTheaterMode = usePlayerStore((state) => state.toggleTheaterMode);

  const loadChannels = useCallback(async (showToast = false, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchAllChannels();
      setAllChannels(data);
      if (showToast && data.length) toast.success(`Loaded ${data.length} channels`);
    } catch (e) {
      if (silent) return;
      const msg = e instanceof Error ? e.message : "Load failed";
      setError(msg);
      toast.error(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels(false);
  }, [loadChannels]);

  useEffect(() => {
    const id = setInterval(() => {
      void loadChannels(false, true);
    }, 30 * 60_000);
    return () => clearInterval(id);
  }, [loadChannels]);

  useEffect(() => {
    if (allChannels.length > 0 && !activeChannel) {
      setActiveChannel(allChannels[0]);
    }
  }, [allChannels, activeChannel, setActiveChannel]);

  useEffect(() => {
    const tick = async () => {
      try {
        setScores(await apiClient.getLiveScores(undefined, 8));
      } catch {
        /* optional */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 15_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    let list = allChannels;
    const q = deferredSearch.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    if (filterCountry) {
      const f = filterCountry.toLowerCase();
      list = list.filter((c) => c.country.toLowerCase().includes(f));
    }
    if (filterLanguage) {
      const f = filterLanguage.toLowerCase();
      list = list.filter((c) => c.language.toLowerCase().includes(f));
    }
    if (filterCategory) {
      const f = filterCategory.toLowerCase();
      list = list.filter((c) => c.category.toLowerCase().includes(f));
    }
    return list;
  }, [allChannels, deferredSearch, filterCountry, filterLanguage, filterCategory]);

  const countryOptions = useMemo(() => uniqueSorted(allChannels.map((c) => c.country)), [allChannels]);
  const languageOptions = useMemo(() => uniqueSorted(allChannels.map((c) => c.language)), [allChannels]);
  const categoryOptions = useMemo(() => uniqueSorted(allChannels.map((c) => c.category)), [allChannels]);

  const statusText = useMemo(() => {
    if (loading) return t("loading");
    if (error) return error;
    return `${allChannels.length} loaded · ${filtered.length} shown`;
  }, [loading, error, allChannels.length, filtered.length, t]);

  return (
    <AppShell searchQuery={searchQuery} onSearch={setSearchQuery}>
      <div className="mx-auto w-full max-w-[1920px]">
        {tier === "free" ? <AdSlot variant="banner" className="mb-4" /> : null}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">{t("appTitle")}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white md:text-3xl">{t("tagline")}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {statusText} · {filtered.length} / {allChannels.length}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadChannels(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <Badge icon={<Tv2 size={14} />} label="HLS" />
            <Badge icon={<Activity size={14} />} label="Scores" />
            <Badge icon={<ShieldCheck size={14} />} label="Admin" />
          </div>
        </motion.header>

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/30 p-3">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
          <span className="text-xs text-slate-500">{t("filters")}:</span>
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="max-w-[140px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
          >
            <option value="">{t("allCountries")}</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="max-w-[140px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
          >
            <option value="">{t("allLanguages")}</option>
            {languageOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="max-w-[160px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
          >
            <option value="">{t("allCategories")}</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="lg:col-span-7 xl:col-span-8">
            {activeChannel ? (
              <PremiumPlayer
                streamUrl={activeChannel.stream_url}
                title={activeChannel.name}
                isTheaterMode={isTheaterMode}
                onToggleTheaterMode={toggleTheaterMode}
                overlay={<LiveScoreOverlay scores={scores} />}
              />
            ) : (
              <div className="player-shell flex aspect-video items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 text-slate-400">
                {t("noChannel")}
              </div>
            )}
          </section>
          <aside className="space-y-3 lg:col-span-5 xl:col-span-4">
            {tier === "free" ? <AdSlot variant="inline" /> : null}
            <p className="text-xs text-slate-500">{t("installHint")}</p>
          </aside>
        </div>

        <section className="mt-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t("directory")}</h2>
            <span className="text-xs text-slate-500">{t("tapToPlay")}</span>
          </div>
          {loading ? (
            <ChannelSkeletonGrid count={18} />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center text-sm text-amber-100/90">
              <p>{t("noResults")}</p>
              <p className="mt-1 text-slate-500">{t("tryAdjust")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {filtered.map((ch, i) => (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  active={activeChannel?.id === ch.id}
                  onSelect={setActiveChannel}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-[10px] text-slate-300">
      {icon} {label}
    </div>
  );
}
