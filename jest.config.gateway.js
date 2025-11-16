/**
 * Jest Configuration for Gateway Agent Tests
 * Tests: Unit, Integration, Security, and E2E
 */

module.exports = {
  displayName: 'gateway-tests',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  preset: 'ts-jest',

  // TypeScript Configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },

  // Coverage Configuration
  collectCoverageFrom: [
    'server/core/agents/gateway/**/*.ts',
    'server/routes/gateway.ts',
    'server/websocket/gateway-*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Test Setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,

  // Module Name Mapper (for aliases)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1',
  },

  // Reporter Configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results',
        outputName: 'junit.xml',
        ancestorSeparator: ' › ',
        usePathAsTestName: true,
      },
    ],
  ],

  // Performance
  maxWorkers: '50%',
  bail: false,
};
