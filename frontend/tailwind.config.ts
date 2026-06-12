import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#141420",
        line: "#26263a",
        ink: "#f5f3ee",
        muted: "#8b8b9e",
        history: "#ffb43a",
        music: "#ff4fa3",
        sports: "#3ddc84",
        screen: "#4f9dff",
        geography: "#2fd4c4",
        wildcard: "#b07aff",
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        drift: "drift 18s ease-in-out infinite alternate",
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
