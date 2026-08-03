import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './client/src'),
      '@assets': path.resolve(__dirname, './attached_assets'),
    },
  },
  test: {
    setupFiles: ['server/__tests__/test.setup.ts'],
    include: [
      'server/**/*.test.ts',
      'server/**/*.spec.ts',
      'shared/**/*.test.ts',
      'shared/**/*.spec.ts',
    ],
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    root: '.',
  },
});
