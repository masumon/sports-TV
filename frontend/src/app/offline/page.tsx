import type { Metadata } from "next";
import { OfflinePageView } from "@/components/offline/OfflinePageView";

export const metadata: Metadata = {
  title: "Offline",
  description: "No network — try again or open the app when you are back online.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col" style={{ background: "var(--bg-dark)" }}>
      <OfflinePageView />
    </main>
  );
}
