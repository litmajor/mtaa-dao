import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // Design system color palette
        orange: {
          light: "var(--color-orange-light)",
          base: "var(--color-orange-base)",
          dark: "var(--color-orange-dark)",
          darker: "var(--color-orange-darker)",
        },
        purple: {
          light: "var(--color-purple-light)",
          base: "var(--color-purple-base)",
          dark: "var(--color-purple-dark)",
          darker: "var(--color-purple-darker)",
        },
        emerald: {
          light: "var(--color-emerald-light)",
          base: "var(--color-emerald-base)",
          dark: "var(--color-emerald-dark)",
          darker: "var(--color-emerald-darker)",
        },
        red: {
          light: "var(--color-red-light)",
          base: "var(--color-red-base)",
          dark: "var(--color-red-dark)",
          darker: "var(--color-red-darker)",
        },
        amber: {
          light: "var(--color-amber-light)",
          base: "var(--color-amber-base)",
          dark: "var(--color-amber-dark)",
          darker: "var(--color-amber-darker)",
        },
        blue: {
          light: "var(--color-blue-light)",
          base: "var(--color-blue-base)",
          dark: "var(--color-blue-dark)",
          darker: "var(--color-blue-darker)",
        },
        teal: {
          light: "var(--color-teal-light)",
          base: "var(--color-teal-base)",
          dark: "var(--color-teal-dark)",
          darker: "var(--color-teal-darker)",
        },
        cyan: {
          light: "var(--color-cyan-light)",
          base: "var(--color-cyan-base)",
          dark: "var(--color-cyan-dark)",
          darker: "var(--color-cyan-darker)",
        },
        rose: {
          light: "var(--color-rose-light)",
          base: "var(--color-rose-base)",
          dark: "var(--color-rose-dark)",
          darker: "var(--color-rose-darker)",
        },
        lime: {
          light: "var(--color-lime-light)",
          base: "var(--color-lime-base)",
          dark: "var(--color-lime-dark)",
          darker: "var(--color-lime-darker)",
        },
        gray: {
          light: "var(--color-gray-light)",
          base: "var(--color-gray-base)",
          dark: "var(--color-gray-dark)",
          darker: "var(--color-gray-darker)",
        },
        slate: {
          light: "var(--color-slate-light)",
          base: "var(--color-slate-base)",
          dark: "var(--color-slate-dark)",
          darker: "var(--color-slate-darker)",
        },
        // Keep green palette for optional use
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Semantic colors
        background: "var(--semantic-background)",
        foreground: "var(--semantic-foreground)",
        card: {
          DEFAULT: "var(--semantic-card)",
          foreground: "var(--semantic-card-foreground)",
        },
        popover: {
          DEFAULT: "var(--semantic-popover)",
          foreground: "var(--semantic-popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--semantic-primary)",
          foreground: "var(--semantic-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--semantic-secondary)",
          foreground: "var(--semantic-secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--semantic-muted)",
          foreground: "var(--semantic-muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--semantic-accent)",
          foreground: "var(--semantic-accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--semantic-destructive)",
          foreground: "var(--semantic-destructive-foreground)",
        },
        border: "var(--semantic-border)",
        input: "var(--semantic-input)",
        ring: "var(--semantic-ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      fontSize: {
        caption: "var(--font-size-caption)",
        xs: "var(--font-size-xs)",
        sm: "var(--font-size-sm)",
        base: "var(--font-size-base)",
        lg: "var(--font-size-lg)",
        xl: "var(--font-size-xl)",
        "2xl": "var(--font-size-2xl)",
        "3xl": "var(--font-size-3xl)",
        "4xl": "var(--font-size-4xl)",
      },
      spacing: {
        "0.5": "var(--space-0-5)",
        "0.75": "var(--space-0-75)",
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
        "3xl": "var(--space-3xl)",
        "4xl": "var(--space-4xl)",
        "5xl": "var(--space-5xl)",
        "6xl": "var(--space-6xl)",
        "7xl": "var(--space-7xl)",
        "8xl": "var(--space-8xl)",
        "9xl": "var(--space-9xl)",
      },
      gap: {
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
        "3xl": "var(--space-3xl)",
        "4xl": "var(--space-4xl)",
      },
      borderRadius: {
        sm: "var(--border-radius-sm)",
        md: "var(--border-radius-md)",
        lg: "var(--border-radius-lg)",
        xl: "var(--border-radius-xl)",
        full: "var(--border-radius-full)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      transitionDuration: {
        shortest: "var(--animation-duration-shortest)",
        shorter: "var(--animation-duration-shorter)",
        short: "var(--animation-duration-short)",
        standard: "var(--animation-duration-standard)",
        complex: "var(--animation-duration-complex)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-up": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-left": {
          from: { transform: "translateX(10px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "slide-right": {
          from: { transform: "translateX(-10px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "scale-out": {
          from: { transform: "scale(1)", opacity: "1" },
          to: { transform: "scale(0.95)", opacity: "0" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in var(--animation-duration-standard) var(--animation-easing-inout)",
        "fade-out": "fade-out var(--animation-duration-standard) var(--animation-easing-inout)",
        "slide-up": "slide-up var(--animation-duration-standard) var(--animation-easing-out)",
        "slide-down": "slide-down var(--animation-duration-standard) var(--animation-easing-out)",
        "slide-left": "slide-left var(--animation-duration-standard) var(--animation-easing-out)",
        "slide-right": "slide-right var(--animation-duration-standard) var(--animation-easing-out)",
        "scale-in": "scale-in var(--animation-duration-short) var(--animation-easing-out)",
        "scale-out": "scale-out var(--animation-duration-short) var(--animation-easing-out)",
        "bounce-in": "bounce-in var(--animation-duration-complex) var(--animation-easing-bounce)",
        "pulse": "pulse var(--animation-duration-complex) var(--animation-easing-inout) infinite",
        "shake": "shake var(--animation-duration-standard) var(--animation-easing-inout)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
