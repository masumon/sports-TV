"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { PlaylistUploader } from "@/components/admin/PlaylistUploader";

type Playlist = {
  id: number;
  name: string;
  source_type: string;
  is_active: boolean;
  channel_count: number;
  last_sync_at: string | null;
  last_sync_status: string;
};

export default function PlaylistsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.is_admin) {
      router.push("/admin/login");
      return;
    }
    loadPlaylists();
  }, [user, router]);

  const loadPlaylists = async () => {
    try {
      const response = await fetch("/api/v1/admin/playlists");
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data);
      } else {
        toast.error("Failed to load playlists");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading playlists");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="border-b border-border-subtle px-6 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle hover:bg-surface-secondary transition"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
              M3U8 Playlists
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Import and manage M3U8 playlists
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8 p-6 sm:p-8">
        {/* Upload section */}
        <div className="rounded-xl border border-border-subtle p-6" style={{ background: "var(--bg-card)" }}>
          <h2 className="mb-6 text-lg font-bold" style={{ color: "var(--text-main)" }}>
            Import M3U8 Playlist
          </h2>
          <PlaylistUploader />
        </div>

        {/* Playlists list */}
        <div>
          <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--text-main)" }}>
            Your Playlists {playlists.length > 0 && <span className="text-sm font-normal">({playlists.length})</span>}
          </h2>

          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw size={24} className="mx-auto animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : playlists.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle p-12 text-center" style={{ background: "rgba(245,166,35,0.05)" }}>
              <p style={{ color: "var(--text-muted)" }}>No playlists yet. Upload your first M3U8 file above.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {playlists.map((p) => (
                <div key={p.id} className="rounded-xl border border-border-subtle p-4 hover:border-accent-gold/50 transition" style={{ background: "var(--bg-card)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold" style={{ color: "var(--text-main)" }}>
                          {p.name}
                        </h3>
                        {p.is_active && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase" style={{ background: "rgba(16,185,129,0.18)", color: "#6ee7b7" }}>
                            ✓ Active
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{p.channel_count} channels</p>
                      {p.last_sync_at && (
                        <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <Clock size={12} />
                          Last sync: {new Date(p.last_sync_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex shrink-0 items-center gap-2">
                      {p.last_sync_status === "success" ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : (
                        <AlertCircle size={16} className="text-yellow-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
