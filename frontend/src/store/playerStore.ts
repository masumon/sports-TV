"use client";

import { create } from "zustand";
import { Channel } from "@/lib/types";

type PlayerState = {
  activeChannel: Channel | null;
  isTheaterMode: boolean;
  setActiveChannel: (channel: Channel | null) => void;
  toggleTheaterMode: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  activeChannel: null,
  isTheaterMode: false,
  setActiveChannel: (channel) => set({ activeChannel: channel }),
  toggleTheaterMode: () => set((state) => ({ isTheaterMode: !state.isTheaterMode })),
}));
