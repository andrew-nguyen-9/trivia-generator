import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Speakeasy / magic-mansion base palette
        bg: "#06060a",
        surface: "#0d0d18",
        line: "#1a1a2e",
        ink: "#f0ede6",
        muted: "#6b6b82",
        brass: "#b8902e",
        gold: "#d4af37",
        candle: "#f5c518",
        smoke: "#4a4a6a",
        ember: "#b22b2b",
        // Category jewel tones — mirrored in lib/types.ts CATEGORY_HEX
        history: "#c8852a",
        music: "#b83468",
        sports: "#2d9155",
        screen: "#2b6ab5",
        geography: "#178b99",
        wildcard: "#7040a8",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        drift: "drift 18s ease-in-out infinite alternate",
        flicker: "flicker 4s ease-in-out infinite",
        "gold-shimmer": "gold-shimmer 3s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        drift: {
          "0%": { transform: "translate(-10%, -10%) scale(1)" },
          "100%": { transform: "translate(10%, 10%) scale(1.2)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "48%": { opacity: "0.92" },
          "50%": { opacity: "0.75" },
          "52%": { opacity: "0.95" },
          "75%": { opacity: "0.88" },
        },
        "gold-shimmer": {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
    },
  },
  safelist: [
    // category colors are composed dynamically (text-/bg-/border-{category})
    { pattern: /(text|bg|border)-(history|music|sports|screen|geography|wildcard)/ },
  ],
  plugins: [],
};

export default config;
