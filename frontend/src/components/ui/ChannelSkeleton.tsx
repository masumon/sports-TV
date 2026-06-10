export function PlayerSkeleton() {
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-subtle bg-surface-secondary shadow-glass">
      <div className="absolute inset-0 skeleton-shimmer" style={{ background: "var(--bg-hover)" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[var(--primary-accent)]" />
      </div>
    </div>
  );
}

export function CategorySkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-2 overflow-hidden py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-9 w-24 shrink-0 animate-pulse rounded-full" style={{ background: "var(--bg-hover)" }} />
      ))}
    </div>
  );
}

export function ChannelSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6 2xl:grid-cols-8">
      {Array.from({ length: count }).map((_, i) => (
        <ChannelSkeletonCard key={i} />
      ))}
    </div>
  );
}

function ChannelSkeletonCard() {
  return (
    <div
      className="relative overflow-hidden rounded-[14px] border"
      style={{ borderColor: "rgba(255,255,255,0.05)", background: "var(--bg-card)" }}
    >
      {/* shimmer sweep */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
          zIndex: 1,
        }}
      />
      {/* Thumbnail area */}
      <div className="w-full" style={{ aspectRatio: "1/1", background: "var(--bg-hover)" }} />
      {/* Info below */}
      <div className="space-y-1.5 px-2.5 py-2">
        <div className="h-3 w-4/5 rounded-full" style={{ background: "var(--bg-hover)" }} />
        <div className="h-2.5 w-2/3 rounded-full opacity-70" style={{ background: "var(--bg-hover)" }} />
      </div>
    </div>
  );
}
