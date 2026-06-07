"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function NetworkStatusBar() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    // ইনিশিয়াল স্টেট সেট করুন
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowBar(true);
      // ২ সেকেন্ড পর লুকান
      const timer = setTimeout(() => setShowBar(false), 2000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBar(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {showBar && (
        <motion.div
          key="network-status"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium"
          style={{
            background: isOnline
              ? "rgba(16, 185, 129, 0.15)"
              : "rgba(239, 68, 68, 0.15)",
            borderBottom: `1px solid ${isOnline ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            color: isOnline ? "#86efac" : "#fca5a5",
          }}
        >
          {isOnline ? (
            <>
              <Wifi size={16} />
              <span>অনলাইনে ফিরে এসেছেন</span>
            </>
          ) : (
            <>
              <WifiOff size={16} />
              <span>অফলাইনে - কন্টেন্ট ক্যাশ থেকে লোড হচ্ছে</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
