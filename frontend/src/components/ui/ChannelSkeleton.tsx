export function ChannelSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ChannelSkeletonCard key={i} />
      ))}
    </div>
  );
}

function ChannelSkeletonCard() {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      {/* shimmer sweep */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.055) 50%, transparent 100%)",
        }}
      />
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg" style={{ background: "var(--bg-hover)" }} />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded" style={{ background: "var(--bg-hover)" }} />
          <div className="h-3 w-1/2 rounded opacity-80" style={{ background: "var(--bg-hover)" }} />
        </div>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <div className="h-4 w-16 rounded-full" style={{ background: "var(--bg-hover)" }} />
        <div className="h-4 w-10 rounded-full" style={{ background: "var(--bg-hover)" }} />
      </div>
    </div>
  );
}
