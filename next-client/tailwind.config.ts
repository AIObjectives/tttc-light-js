import type { Config } from "tailwindcss";

const { fontFamily } = require("tailwindcss/defaultTheme");

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./.storybook/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
          subtle: "hsl(var(--muted-subtle))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        AOI_graph_cell: {
          DEFAULT: "hsl(var(--AOI-graph-cell))",
        },
        theme_violet: {
          DEFAULT: "hsl(var(--theme-violet))",
          accent: "hsl(var(--theme-violet-accent))",
        },
        theme_blueSea: {
          DEFAULT: "hsl(var(--theme-blueSea))",
          accent: "hsl(var(--theme-blueSea-accent))",
        },
        theme_blueSky: {
          DEFAULT: "hsl(var(--theme-blueSky))",
          accent: "hsl(var(--theme-blueSky-accent))",
        },
        theme_greenLeaf: {
          DEFAULT: "hsl(var(--theme-greenLeaf))",
          accent: "hsl(var(--theme-greenLeaf-accent))",
        },
        theme_greenLime: {
          DEFAULT: "hsl(var(--theme-greenLime))",
          accent: "hsl(var(--theme-greenLime-accent))",
        },
        theme_yellow: {
          DEFAULT: "hsl(var(--theme-yellow))",
          accent: "hsl(var(--theme-yellow-accent))",
        },
        theme_red: {
          DEFAULT: "hsl(var(--theme-red))",
          accent: "hsl(var(--theme-red-accent))",
        },
        theme_purple: {
          DEFAULT: "hsl(var(--theme-purple))",
          accent: "hsl(var(--theme-purple-accent))",
        },
        theme_brown: {
          DEFAULT: "hsl(var(--theme-brown))",
          accent: "hsl(var(--theme-brown-accent))",
        },
        theme_gray: {
          DEFAULT: "hsl(var(--theme-gray))",
          accent: "hsl(var(--theme-gray-accent))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      lineHeight: {
        "11": "48px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
