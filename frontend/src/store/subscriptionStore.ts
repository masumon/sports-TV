"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SubscriptionTier = "free" | "premium";

type State = {
  tier: SubscriptionTier;
  setTier: (t: SubscriptionTier) => void;
  toggleTier: () => void;
};

export const useSubscriptionStore = create<State>()(
  persist(
    (set) => ({
      tier: "free",
      setTier: (t) => set({ tier: t }),
      toggleTier: () => set((s) => ({ tier: s.tier === "free" ? "premium" : "free" })),
    }),
    {
      name: "gstv-subscription",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
