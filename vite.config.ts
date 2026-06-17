import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindVite from '@tailwindcss/vite';
// Optional: consider using unplugin-icons to compile icons at build time
// import Icons from 'unplugin-icons/vite';
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: "./client",
  plugins: [react(), tailwindVite() /*, Icons({ compiler: 'jsx', jsx: 'react' }) */],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },

  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,

    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "client/index.html"),
      },
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          // ─── NEVER bundle these entirely ───
          // Viem is 500KB+ — must be tree-shaken at import level
          if (id.includes('viem') && !id.includes('viem/chains')) {
            return 'web3-core';
          }
          // Only bundle chains you actually use
          if (id.includes('viem/chains')) {
            return 'web3-chains';
          }

          if (id.includes('wagmi') || id.includes('@wagmi')) {
            return 'web3-react';
          }

          if (id.includes('ethers')) {
            return 'web3-legacy';
          }

          // ─── Framework core (stable, cacheable) ───
          if (id.includes('/react/') || id.includes('/react-dom/') || 
              id.includes('react-router') || id.includes('wouter') || 
              id.includes('/scheduler/')) {
            return 'react-core';
          }

          // ─── Charts — split by library ───
          if (id.includes('chart.js') || id.includes('react-chartjs')) {
            return 'charts-chartjs';
          }

          // ─── UI — Radix is heavy, split by component ───
          if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-alert-dialog')) {
            return 'ui-dialog';
          }
          if (id.includes('@radix-ui/react-select') || id.includes('@radix-ui/react-dropdown-menu')) {
            return 'ui-select';
          }
          if (id.includes('@radix-ui')) {
            return 'ui-radix';
          }
          // Avoid forcing all `lucide-react` into a single chunk; prefer
          // tree-shaking or compile-time icons (unplugin-icons) instead.

          // ─── Utils ───
          if (id.includes('socket.io-client')) {
            return 'realtime';
          }
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) {
            return 'query-client';
          }
          if (id.includes('date-fns')) {
            return 'date-utils';
          }
          if (id.includes('lodash')) {
            return 'lodash'; // or better: use lodash-es + specific imports
          }

          return undefined;
        },
      },
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    hmr: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    },
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
    // REMOVED: force: true
    // REMOVED: recharts, viem, wagmi (let Vite discover these naturally)
  },
});