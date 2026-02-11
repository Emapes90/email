import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ffffff",
          50: "#f8f8ff",
          100: "#e8e8f0",
          200: "#d0d0e0",
          300: "#a0a0b8",
          400: "#6b6b80",
          500: "#4a4a5e",
          600: "#2a2a3e",
          700: "#1a1a2e",
          800: "#12121a",
          900: "#0a0a0f",
          950: "#050508",
        },
        surface: {
          DEFAULT: "#12121a",
          50: "#1a1a2e",
          100: "#22223a",
          200: "#2a2a3e",
          300: "#323248",
          400: "#3a3a52",
        },
        accent: {
          DEFAULT: "#667eea",
          light: "#8b9cf5",
          dark: "#4a5fd0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glow: "0 0 40px rgba(102,126,234,0.15)",
        "glow-sm": "0 0 20px rgba(102,126,234,0.1)",
        card: "0 4px 24px rgba(0,0,0,0.3)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.4)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
