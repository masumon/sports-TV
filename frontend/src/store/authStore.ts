"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthUser } from "@/lib/types";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
};

/** Validate token format to prevent injection attacks */
function isValidToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  if (token.length > 1000) return false; // JWT tokens are typically < 1KB
  // Allow alphanumeric, hyphens, underscores, and dots (JWT structure)
  return /^[a-zA-Z0-9._\-]+$/.test(token);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => {
        // Validate token format before storing
        if (!isValidToken(token)) {
          console.warn('Invalid token format rejected');
          return;
        }
        set({
          token,
          user: { ...user, subscription_tier: user.subscription_tier ?? "free" },
        });
      },
      clearSession: () => set({ token: null, user: null }),
    }),
    {
      name: "gstv-auth-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
