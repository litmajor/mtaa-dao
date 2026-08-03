import { mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, {
  test: {
    setupFiles: ['server/__tests__/test.setup.ts'],
    include: ['server/__tests__/swap.fork.test.ts'],
    environment: 'node',
    threads: false,
    globals: true,
    testTimeout: 90000,
  },
});
