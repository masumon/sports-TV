import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#030712",
        surface: "#0b1220",
        accent: "#22c55e",
        accentSoft: "#4ade80",
      },
      boxShadow: {
        glass: "0 20px 50px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        "sports-grid":
          "radial-gradient(circle at 10% 20%, rgba(34,197,94,0.15), transparent 30%), radial-gradient(circle at 85% 10%, rgba(59,130,246,0.18), transparent 30%), linear-gradient(180deg, rgba(2,6,23,0.95), rgba(1,3,10,1))",
      },
    },
  },
  plugins: [],
};

export default config;
