"use client";

import { create } from "zustand";

type UiState = {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  /** Active module: "sports" | "bangladesh" — shared across Sidebar + ViewerHome */
  activeModule: "sports" | "bangladesh";
  setActiveModule: (m: "sports" | "bangladesh") => void;
  /** Active category filter — shared across Sidebar + ViewerHome */
  activeCategory: string;
  setActiveCategory: (c: string) => void;
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
}));
