export function ChannelSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-slate-800/80 bg-slate-900/50 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-800" />
              <div className="h-3 w-1/2 rounded bg-slate-800/80" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
