"use client";

import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

type Props = {
  children: React.ReactNode;
  searchQuery: string;
  onSearch: (q: string) => void;
};

export function AppShell({ children, searchQuery, onSearch }: Props) {
  return (
    <div className="flex min-h-screen text-slate-100" style={{ background: "var(--bg-dark)" }}>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onSearch={onSearch} searchQuery={searchQuery} />
        <main className="flex-1 overflow-x-hidden px-3 py-4 pb-24 md:px-4 lg:px-6 md:pb-8">{children}</main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
