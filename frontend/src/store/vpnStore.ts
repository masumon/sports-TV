"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** "On" = always relay first · "Smart" = relay when a channel is flagged · "Off" = direct first (auto still boosts flagged). */
export type VpnMode = "on" | "smart" | "off";

const CYCLE: VpnMode[] = ["on", "smart", "off"];

type VpnState = {
  mode: VpnMode;
  setMode: (m: VpnMode) => void;
  cycleMode: () => void;
};

export const useVpnStore = create<VpnState>()(
  persist(
    (set) => ({
      mode: "on",
      setMode: (m) => set({ mode: m }),
      cycleMode: () =>
        set((s) => {
          const i = CYCLE.indexOf(s.mode);
          const next = CYCLE[i === -1 ? 0 : (i + 1) % CYCLE.length]!;
          return { mode: next };
        }),
    }),
    { name: "gstv-relay-vpn-mode", version: 1 }
  )
);
