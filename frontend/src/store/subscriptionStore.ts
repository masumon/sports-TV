"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SubscriptionTier = "free" | "premium";

type State = {
  tier: SubscriptionTier;
  setTier: (t: SubscriptionTier) => void;
};

export const useSubscriptionStore = create<State>()(
  persist(
    (set) => ({
      tier: "free",
      setTier: (t) => set({ tier: t }),
    }),
    {
      name: "gstv-subscription",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
