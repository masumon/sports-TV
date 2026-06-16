"use client";

import { create } from "zustand";
import type { Channel, ViewerModule } from "@/lib/types";

type ModuleCounts = {
  gsCount: number;
  bdCount: number;
  inCount: number;
  fastCount: number;
  liveCount: number;
  wcCount: number;
};

type UiState = {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  activeModule: ViewerModule;
  setActiveModule: (m: ViewerModule) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  searchFocusNonce: number;
  requestSearchFocus: () => void;
  /** Per-module channel counts — set by ViewerHome, read by Sidebar */
  moduleCounts: ModuleCounts;
  setModuleCounts: (counts: ModuleCounts) => void;
  /** Live search suggestions — set by ViewerHome, read by TopBar */
  searchSuggestions: Channel[];
  setSearchSuggestions: (channels: Channel[]) => void;
};

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  mobileMenuOpen: false,
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
  activeModule: "world_cup_2026",
  setActiveModule: (m) => set({ activeModule: m, activeCategory: "" }),
  activeCategory: "",
  setActiveCategory: (c) => set({ activeCategory: c }),
  searchFocusNonce: 0,
  requestSearchFocus: () => set((s) => ({ searchFocusNonce: s.searchFocusNonce + 1 })),
  moduleCounts: { gsCount: 0, bdCount: 0, inCount: 0, fastCount: 0, liveCount: 0, wcCount: 0 },
  setModuleCounts: (counts) => set({ moduleCounts: counts }),
  searchSuggestions: [],
  setSearchSuggestions: (channels) => set({ searchSuggestions: channels }),
}));
