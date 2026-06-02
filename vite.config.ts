import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindVite from '@tailwindcss/vite';
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: "./client",
  plugins: [react(), tailwindVite()],
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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "client/index.html"),
      },
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          // React core and router
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router') || id.includes('wouter') || id.includes('/scheduler/')) {
            return 'react-core';
          }

          // Web3 and blockchain libs
          if (id.includes('ethers') || id.includes('viem') || id.includes('/web3') || id.includes('wagmi') || id.includes('@wagmi')) {
            return 'web3';
          }

          // Charting libraries bundle
          if (id.includes('recharts') || id.includes('chart.js') || id.includes('react-chartjs') || id.includes('react-chartjs-2')) {
            return 'charts';
          }

          // UI libs (radix, icons, lucide)
          if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('react-icons')) {
            return 'ui-lib';
          }

          // Websocket / realtime
          if (id.includes('socket.io-client') || id.includes('ws')) {
            return 'realtime';
          }

          // Heavy utils used across app
          if (id.includes('@tanstack/react-query') || id.includes('date-fns') || id.includes('lodash')) {
            return 'utils';
          }

          return undefined;
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    middlewareMode: false,
    allowedHosts: 'all',
    // Let Vite determine the correct HMR host/protocol based on the current connection.
    // Removing hardcoded host/port avoids mismatched ws/wss when accessing via HTTPS or proxies.
    hmr: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    // Optimize development server performance
    watch: {
      // Ignore node_modules to prevent excessive recompilation
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    },
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      '@tanstack/react-query',
      'react-helmet-async',
      'recharts',
      'lucide-react',
      'socket.io-client',
      'web3',
      'ethers',
      'viem',
      'wagmi',
      '@wagmi/core',


    ],
    // Force pre-bundling of heavy dependencies
    force: true,
  },
  // Use Rolldown-specific options to control code-splitting behavior
  rolldownOptions: {
    output: {
      codeSplitting: true,
    },
  },
});

