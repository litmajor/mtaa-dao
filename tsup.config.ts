import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['server/index.ts'],
  outDir: 'server/dist',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  dts: false,
  minify: false,
  legacyOutput: false,
  // Externals: native / large runtime deps (let node resolve them)
  external: [
    'pg',
    'sqlite3',
    'better-sqlite3',
    '@neondatabase/serverless',
    // Prevent bundling Tailwind native bindings (oxide) into server build
    '@tailwindcss/oxide',
    'tailwindcss',
    '@tailwindcss/vite',
    '@tailwindcss/typography',
  ],
});
