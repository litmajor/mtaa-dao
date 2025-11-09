
const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  defaultShowCopyCode: true,
  latex: true,
  flexsearch: {
    codeblocks: true
  }
})

module.exports = withNextra({
  reactStrictMode: true,
  images: {
    domains: ['mtaadao.com'],
  },
})
