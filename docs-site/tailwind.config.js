
module.exports = {
  content: [
    './pages/**/*.{js,jsx,ts,tsx,md,mdx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './theme.config.tsx',
  ],
  theme: {
    extend: {
      colors: {
        mtaa: {
          orange: '#FF7F3F',
          gold: '#F5A623',
          green: '#27AE60',
          dark: '#1A1A1A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
