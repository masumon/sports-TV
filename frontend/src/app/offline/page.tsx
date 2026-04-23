import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-white">You are offline</h1>
      <p className="max-w-md text-slate-400">
        Check your network connection, then try again. Cached pages may still be available from the PWA.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
      >
        Go home
      </Link>
    </main>
  );
}
