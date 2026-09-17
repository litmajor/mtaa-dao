// eslint.config.js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    ignores: [
      'node_modules',
      'attatched_assets',
      'build',
      'dist',
      '.next',
      '.cache',
      'coverage',
      'typechain/**',
      'typechain-types/**',
      'types/**',
      '*.config.ts',
      '**/*.test.ts',
      'test/**',
      '**/*.test.tsx',
      '**/__tests__/**',
    ],
  }
);