"use client";

import { useEffect, useRef } from "react";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";

const ME_INTERVAL_MS = 15 * 60_000;

/** Refreshes `/auth/me` so subscription_tier and admin flags stay in sync. */
export function AuthSessionSync() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const setTier = useSubscriptionStore((s) => s.setTier);
  const boot = useRef(false);

  useEffect(() => {
    if (!token) {
      boot.current = false;
      return;
    }

    const run = () => {
      void (async () => {
        try {
          const me = await apiClient.getMe(token);
          setSession(token, {
            id: me.id,
            full_name: me.full_name,
            email: me.email,
            is_admin: me.is_admin,
            subscription_tier: me.subscription_tier === "premium" ? "premium" : "free",
          });
          setTier(me.subscription_tier === "premium" ? "premium" : "free");
        } catch {
          /* 401 already clears session in apiRequest */
        }
      })();
    };

    if (!boot.current) {
      boot.current = true;
      run();
    }
    const id = setInterval(run, ME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, setSession, setTier]);

  return null;
}
