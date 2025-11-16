
import React, { useEffect } from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: (
    <div className="flex items-center gap-2">
      <img src="/mtaa_dao_logo_128x128.png" alt="MtaaDAO" className="h-8 w-8" />
      <span className="font-bold text-xl">MtaaDAO Docs</span>
    </div>
  ),
  project: {
    link: 'https://github.com/litmajor/mtaa-dao',
  },
  chat: {
    link: 'https://t.me/mtaadao',
  },
  docsRepositoryBase: 'https://github.com/litmajor/mtaa-dao/tree/main/docs-site',
  footer: {
    text: (
      <span>
        {new Date().getFullYear()} © MtaaDAO. From Mtaa, For Mtaa 🌍
      </span>
    ),
  },
  primaryHue: 25, // Orange brand color
  primarySaturation: 100,
  useNextSeoProps() {
    return {
      titleTemplate: '%s – MtaaDAO Docs'
    }
  },
  head: (
    <>
      {/* Font preloading for faster rendering */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="MtaaDAO Documentation" />
      <meta property="og:description" content="Build your DAO in minutes. Empower your community." />
      <link rel="icon" href="/favicon.ico" />
      {/* Optimize font loading */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </>
  ),
  banner: {
    key: 'launch-banner',
    text: (
      <a href="/getting-started" target="_blank">
        🚀 MtaaDAO is live! Create your first DAO in 2 minutes →
      </a>
    ),
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
}

export default config
