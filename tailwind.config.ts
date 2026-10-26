import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          900: "#14532d",
        },
        slate: {
          850: "#151e2e",
          950: "#0b0f19",
        }
      },
      fontFamily: {
        garamond: ["Garamond", "Georgia", "serif"],
        baskerville: ["Baskerville", "Georgia", "serif"],
        palatino: ["'Palatino Linotype'", "Palatino", "serif"],
        georgia: ["Georgia", "serif"],
      }
    },
  },
  plugins: [],
};
export default config;
