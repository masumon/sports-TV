"use client";

import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

export function ViewerPageShell({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <AppShell searchQuery={searchQuery} onSearch={setSearchQuery}>
      {children}
    </AppShell>
  );
}
