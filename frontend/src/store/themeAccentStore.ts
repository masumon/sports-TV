import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeAccent = "gold" | "red" | "blue" | "amoled";

export const THEME_ACCENTS: { id: ThemeAccent; label: string; color: string; desc: string }[] = [
  { id: "gold",  label: "ABO Gold",    color: "#F5A623", desc: "ডিফল্ট — লোগোর রং" },
  { id: "red",   label: "Classic Red", color: "#E50914", desc: "ক্লাসিক স্টাইল" },
  { id: "blue",  label: "Royal Blue",  color: "#2563EB", desc: "প্রফেশনাল লুক" },
  { id: "amoled",label: "AMOLED",      color: "#F5A623", desc: "ব্যাটারি সাশ্রয়" },
];

interface ThemeAccentState {
  accent: ThemeAccent;
  setAccent: (accent: ThemeAccent) => void;
}

export const useThemeAccentStore = create<ThemeAccentState>()(
  persist(
    (set) => ({
      accent: "gold",
      setAccent: (accent) => {
        set({ accent });
        if (typeof document !== "undefined") {
          if (accent === "gold") {
            document.documentElement.removeAttribute("data-accent");
          } else {
            document.documentElement.setAttribute("data-accent", accent);
          }
        }
      },
    }),
    {
      name: "gstv-accent",
      storage: createJSONStorage(() => {
        if (typeof localStorage !== "undefined") return localStorage;
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
    }
  )
);
