"use client";

import { create } from "zustand";

type UiState = {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  /** Active module — shared across Sidebar + ViewerHome */
  activeModule: "sports" | "india" | "bangladesh";
  setActiveModule: (m: "sports" | "india" | "bangladesh") => void;
  /** Active category filter — shared across Sidebar + ViewerHome */
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  /** Bumped when nav should focus the main search field (header + wide hero share state). */
  searchFocusNonce: number;
  requestSearchFocus: () => void;
};

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  mobileMenuOpen: false,
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
  activeModule: "sports",
  setActiveModule: (m) => set({ activeModule: m, activeCategory: "" }),
  activeCategory: "",
  setActiveCategory: (c) => set({ activeCategory: c }),
  searchFocusNonce: 0,
  requestSearchFocus: () => set((s) => ({ searchFocusNonce: s.searchFocusNonce + 1 })),
}));
