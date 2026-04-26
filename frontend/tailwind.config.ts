import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      screens: {
        xs: "480px",
      },
      colors: {
        background: "#0A0F1C",
        surface: "#121826",
        primary: "#00BFFF",
        muted: "#9CA3AF",
        accent: "#00BFFF",
        accentSoft: "#7dd3fc",
      },
      boxShadow: {
        glass: "0 20px 50px rgba(0,0,0,0.35)",
        primary: "0 0 24px rgba(0,191,255,0.25)",
      },
      backgroundImage: {
        "sports-grid":
          "radial-gradient(circle at 10% 20%, rgba(0,191,255,0.08), transparent 30%), radial-gradient(circle at 85% 10%, rgba(59,130,246,0.12), transparent 30%), linear-gradient(180deg, rgba(10,15,28,0.98), rgba(10,15,28,1))",
      },
    },
  },
  plugins: [],
};

export default config;
