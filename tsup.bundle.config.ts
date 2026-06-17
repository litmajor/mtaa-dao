import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['server/index.ts'],
  outDir: 'server/dist-bundle',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  dts: false,
  bundle: true,
  splitting: false,
  sourcemap: false,
  minify: true,
  treeshake: true,
  esbuildOptions(options) {
    // Treat declaration files as empty
    options.loader = {
      ...(options.loader || {}),
      '.d.ts': 'empty',
    };
    // Drop console in production
    options.drop = ['console', 'debugger'];
  },
  // Externalize only native drivers and very large build-only tools
  external: [
    'pg',
    'sqlite3',
    'better-sqlite3',
    '@neondatabase/serverless',
    '@tailwindcss/oxide',
    'tailwindcss',
    '@tailwindcss/vite',
    '@tailwindcss/typography',
    'postcss',
    'postcss-import',
    'autoprefixer',
    'jiti',
    'vite',
    'express',
    'ws',
    'ioredis',
    'drizzle-orm',
    'drizzle-orm/*',
    'zod',
    'telegraf',
    'ccxt',
    '@trpc/server',
    '@trpc/client',
    'react',
    'react-dom',
    'wagmi',
    '@wagmi/*',
    '@tanstack/react-query',
    '@tanstack/query-core',
  ],
});
