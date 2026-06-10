import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        passport: "#111827",
        ink: "#172033",
        burgundy: "#6E1E2F",
        gold: "#D6A84F",
        paper: "#F7F1E3",
        runway: "#5F6874",
        signal: "#2F8F68",
        vermilion: "#D94A38",
        cloud: "#FBFAF7",
        stamped: "#111111",
        teal: "#2E6F73",
      },
      fontFamily: {
        display: ["var(--font-marcellus)", "serif"],
        sans: ["var(--font-sora)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
