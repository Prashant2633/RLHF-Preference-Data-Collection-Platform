/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#16151A",
        cardBg: "#222026",
        cardBorder: "#2E2B35",
        textWarm: "#EDEAE0",
        textMuted: "#A39E93",
        accentA: "#FF7A33",       // Ember Amber
        accentB: "#4FD1C5",       // Desaturated Teal
        brandRed: "#FF5252",
        brandGreen: "#4CAF50",
      },
      fontFamily: {
        serif: ["Fraunces", "serif"],
        sans: ["Public Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
}
