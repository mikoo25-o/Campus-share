import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: "#FFC629",
          gold: "#F5B719",
          night: "#07130D",
          forest: "#124D2D",
          cream: "#FFFDF7",
          ink: "#111820",
          muted: "#58697A",
          line: "#E5E7EB",
          success: "#268344",
          alert: "#E74C3C",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
