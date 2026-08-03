import { mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, {
  root: '.',
  test: {
    setupFiles: ['server/__tests__/test.setup.ts'],
    include: [
      'server/**/*.test.ts',
      'server/**/*.spec.ts',
      'shared/**/*.test.ts',
      'shared/**/*.spec.ts',
      'client/**/*.test.ts',
      'client/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],
    environment: 'node',
    threads: true,
    globals: true,
    testTimeout: 20000,
  },
});
