"use client";

import { TopBar } from "@/components/layout/TopBar";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkStatusBar } from "@/components/NetworkStatusBar";

type Props = {
  children: React.ReactNode;
  searchQuery: string;
  onSearch: (q: string) => void;
};

export function AppShell({ children, searchQuery, onSearch }: Props) {
  return (
    <ErrorBoundary>
      <NetworkStatusBar />
      <div className="flex min-h-screen bg-surface antialiased text-foreground">
        <SidebarNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onSearch={onSearch} searchQuery={searchQuery} />
          <main
            className="flex-1 overflow-x-hidden px-3 py-3 sm:px-5 sm:py-6 md:px-6 md:pb-8 lg:px-8 xl:px-10 2xl:px-12"
            style={{
              paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
              paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
              /* bottom nav height (3.75rem) + gap (0.75rem) + safe-area */
              paddingBottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {children}
          </main>
          <BottomNav />
        </div>
      </div>
    </ErrorBoundary>
  );
}
