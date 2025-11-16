import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: "./client",
  plugins: [react()],
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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "client/index.html"),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // React ecosystem - shared by all components
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
              return 'react-core';
            }
            // Router
            if (id.includes('react-router') || id.includes('wouter')) {
              return 'react-core';
            }
            // Chart libraries - heavy, lazy load
            if (id.includes('recharts') || id.includes('chart.js') || id.includes('react-chartjs')) {
              return 'charts';
            }
            // UI component library
            if (id.includes('@radix-ui/')) {
              const match = id.match(/@radix-ui\/react-([^\/]+)/);
              if (match) {
                return `radix-${match[1]}`;
              }
              return 'radix-ui';
            }
            // State management
            if (id.includes('@tanstack/react-query')) {
              return 'react-query';
            }
            // Web3 - heavy, used only in specific pages
            if (id.includes('ethers') || id.includes('viem') || id.includes('web3') || 
                id.includes('wagmi') || id.includes('@wagmi')) {
              return 'web3';
            }
            // Icons - split separately
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // Don't bundle everything else together - let Vite handle it
          }
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
    hmr: {
      clientPort: 443,
    },
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
    ],
    // Force pre-bundling of heavy dependencies
    force: true,
  },
});

