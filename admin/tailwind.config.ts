import type { Config } from "tailwindcss";

// Redesign pass: a warm, clay-accented palette in the spirit of Claude's
// own interface, replacing the black/maximalist tokens pulled from the
// original Figma draft. See docs/DASHBOARD_PLAN.md for the feature spec —
// this file only changes how it looks, not what it does.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-hanken-grotesk)", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
      colors: {
        // Page/surface — warm cream ground, warm-white cards
        canvas: "#F5F4EE",
        surface: "#FFFFFF",
        "surface-warm": "#FAF9F5",
        border: "#E6E4D9",
        "border-strong": "#D8D5C7",
        "active-bg": "#F0EEE3",
        // Text — warm charcoal, not pure black
        ink: "#2D2A26",
        muted: "#837F73",
        "muted-2": "#5C584E",
        // Brand accent — Claude clay/terracotta
        accent: {
          DEFAULT: "#C15F3C",
          hover: "#A94E2F",
          soft: "#F3E3DA",
          text: "#9C4A2C",
        },
        // Warning banner (low balance / plan expiring)
        warning: {
          bg: "#FBF0DE",
          border: "#E0A458",
          text: "#8A5A1E",
        },
        // Status chips
        success: { bg: "#E4EDDD", text: "#4C7A3A" },
        danger: { bg: "#F7E2DE", text: "#B3402A" },
        pending: { bg: "#EEECE3", text: "#837F73" },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(45, 42, 38, 0.04), 0 4px 16px -4px rgba(45, 42, 38, 0.08)",
      },
      keyframes: {
        "scale-in": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "check-draw": {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "scale-in": "scale-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "check-draw": "check-draw 0.4s 0.25s ease-out both",
        "fade-up": "fade-up 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
