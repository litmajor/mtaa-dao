import { defineConfig } from 'tsup';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  // Compile the entire server tree so runtime-relative imports (./routes, ./models, etc.)
  // are emitted into `server/dist` when using `bundle: false`.
  // Compile the entire server tree but exclude tests which may contain test-specific syntax
  // that shouldn't be emitted for production runtime.
  entry: [
    'server/**/*.ts',
    '!server/tests/**',
    // Exclude type-only files that compile to empty JS chunks
    '!server/**/types.ts',
    '!server/**/types/*.ts',
  ],
  outDir: 'server/dist',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  dts: false,

  /* ─── Core optimizations ─── */
  // Disable code-splitting for backend. Node.js suffers from FS overhead
  // when loading 100+ tiny chunks. This collapses everything into index.js.
  splitting: false,

  // Remove dead code (makes a big difference with large dependency trees)
  treeshake: true,

  // Minify in production only (keep readable for local debugging)
  

  /* ─── Externals ─── */
  external: [
    // Native / DB drivers
    'pg',
    'sqlite3',
    'better-sqlite3',
    '@neondatabase/serverless',

    // Build tools that leaked into server code (you have chunks for these!)
    // These should NOT be in your runtime bundle.
    '@tailwindcss/oxide',
    'tailwindcss',
    '@tailwindcss/vite',
    '@tailwindcss/typography',
    'postcss',
    'postcss-import',
    'autoprefixer',
    'jiti',
    'vite',

    // Large runtime libraries — externalize anything >100 KB from node_modules
    // so Node.js loads them natively. Add/remove based on your package.json.
    'express',
    'ws',                 // websocket lib
    'ioredis',
    'drizzle-orm',
    'drizzle-orm/*',
    'zod',
    'telegraf',           // telegram bot
    'ccxt',               // crypto exchange lib
    '@trpc/server',
    '@trpc/client',
    // React and front-end libs that accidentally ended up in server
    'react',
    'react-dom',
    'wagmi',
    '@wagmi/*',
    '@tanstack/react-query',
    '@tanstack/query-core',
  ],

  /* ─── esbuild fine-tuning ─── */
  esbuildOptions(options) {
    if (isProd) {
      // Strip console.log and debugger statements from production builds
      options.drop = ['console', 'debugger'];
    }
    // Treat type-only declaration files as empty so tsup/esbuild doesn't
    // emit 1-byte JS shims for `.d.ts` files which show up as empty chunks.
    options.loader = {
      ...(options.loader || {}),
      '.d.ts': 'empty',
    };
    // Note: don't inject a banner that imports `fileURLToPath` — many
    // source files already import it which caused duplicate declaration
    // errors during bundling. Files should define __dirname/__filename
    // themselves using `fileURLToPath(import.meta.url)` when needed.
  },

  // Transpile-only mode: do not bundle node_modules, emit JS files per source file.
  // This is the fastest and smallest-on-disk option for large, server-side codebases.
  bundle: false,
  minify: false,
  // Disable sourcemaps for production artifacts
  sourcemap: false,

  // If you have path aliases in tsconfig, ensure they resolve in the bundle
  // (tsup usually handles this automatically, but explicit is safer)
  // tsconfig: './tsconfig.json',
});