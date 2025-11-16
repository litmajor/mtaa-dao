
import { beforeAll, afterAll, afterEach } from '@jest/globals';
import '@testing-library/jest-dom';

// Test database setup
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mtaadao_test';

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
});

afterEach(async () => {
  // Clean up test data after each test
  // Add cleanup logic here
});

afterAll(async () => {
  // Close database connections
  // Add cleanup logic here
});

// Global test utilities
global.testUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  username: 'testuser'
};

// Mock external services
jest.mock('../server/notificationService', () => ({
  notificationService: {
    sendEmail: jest.fn(),
    sendPushNotification: jest.fn(),
    createNotification: jest.fn()
  }
}));
