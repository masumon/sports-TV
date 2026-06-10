import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        bengali: [
          "var(--font-anek-bangla)",
          "var(--font-hind-siliguri)",
          "var(--font-bengali)",
          "Anek Bangla",
          "Hind Siliguri",
          "Noto Sans Bengali",
          "sans-serif",
        ],
        display: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["1.5rem", { lineHeight: "1.2", fontWeight: "700" }],
        "heading-1": ["1.5rem", { lineHeight: "1.25", fontWeight: "700" }],
        "heading-2": ["1.125rem", { lineHeight: "1.3", fontWeight: "600" }],
        "heading-3": ["1rem", { lineHeight: "1.35", fontWeight: "600" }],
        body: ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["0.75rem", { lineHeight: "1.4", fontWeight: "400" }],
      },
      screens: {
        xs: "480px",
      },
      colors: {
        /* Premium dark theme tokens */
        surface: {
          DEFAULT: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          elevated: "var(--bg-elevated)",
        },
        foreground: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        accent: {
          gold: "var(--accent-gold)",
          "gold-glow": "var(--accent-gold-glow)",
          cyan: "var(--accent-cyan)",
          neon: "var(--accent-neon)",
          DEFAULT: "var(--accent-cyan)",
          soft: "var(--accent-cyan)",
        },
        live: {
          red: "var(--live-red)",
        },
        glass: {
          DEFAULT: "var(--glass-bg)",
          border: "var(--glass-border)",
        },
        border: {
          subtle: "var(--border-subtle-cyan)",
        },
        /* Legacy aliases — kept for gradual migration */
        background: "var(--bg-primary)",
        muted: "var(--text-secondary)",
        primary: "var(--accent-cyan)",
      },
      borderRadius: {
        card: "1rem",
        pill: "9999px",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.45)",
        "glow-gold":
          "0 0 12px var(--accent-gold-glow), inset 0 0 0 1px var(--accent-gold)",
        "glow-cyan": "0 0 8px rgba(0, 229, 255, 0.2)",
        neon: "0 0 8px rgba(0, 229, 255, 0.2), 0 0 0 1px rgba(34, 211, 238, 0.3)",
        primary: "0 0 24px rgba(34, 211, 238, 0.25)",
      },
      backgroundImage: {
        "sports-grid":
          "radial-gradient(circle at 10% 20%, rgba(34,211,238,0.06), transparent 30%), radial-gradient(circle at 85% 10%, rgba(245,197,24,0.05), transparent 30%), linear-gradient(180deg, rgba(10,14,23,0.98), rgba(10,14,23,1))",
      },
      keyframes: {
        "live-pulse": {
          "0%, 100%": {
            opacity: "1",
            boxShadow: "0 0 0 0 rgba(57, 255, 20, 0.45)",
          },
          "50%": {
            opacity: "0.88",
            boxShadow: "0 0 0 6px rgba(57, 255, 20, 0)",
          },
        },
      },
      animation: {
        "live-pulse": "live-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
