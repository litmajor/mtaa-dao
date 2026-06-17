import { processRotation } from '../api/rotation_service';

// Mock the db module used by rotation_service
jest.mock('../db', () => {
  return {
    db: {
      select: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      transaction: jest.fn()
    }
  };
});

const { db } = require('../db');

describe('processRotation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('skips if DB lock is already held', async () => {
    const dao = {
      id: 'dao-1',
      durationModel: 'rotation',
      nextRotationDate: new Date(Date.now() - 1000),
      rotationSelectionMethod: 'sequential',
      currentRotationCycle: 0,
      treasuryBalance: '100',
    };

    // select().from().where(...).then(rows => rows[0])
    db.select.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([dao]) })
    });

    // Simulate update returning no rows (lock already held)
    db.update.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) })
    });

    const result = await processRotation('dao-1');
    expect(result).toBeDefined();
    expect(result.status).toBe('skipped');
    expect(result.reason).toMatch(/db lock/i);
  });

  test('completes rotation when lock acquired and balance present', async () => {
    const dao = {
      id: 'dao-2',
      durationModel: 'rotation',
      nextRotationDate: new Date(Date.now() - 1000),
      rotationSelectionMethod: 'sequential',
      currentRotationCycle: 1,
      treasuryBalance: '100',
    };

    db.select.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([dao]) })
    });

    // Simulate successful lock acquisition
    db.update.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([ { id: 'dao-2' } ]) }) })
    });

    // transaction should call the provided fn with a tx object
    db.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: () => ({ from: () => ({ where: () => Promise.resolve([dao]) }) }),
        insert: () => ({ values: () => ({ returning: () => Promise.resolve([{}]) }) }),
        update: () => ({ set: () => ({ where: () => Promise.resolve([{}]) }) })
      };
      return await fn(tx);
    });

    const result = await processRotation('dao-2');
    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
    expect(result.recipientUserId).toBeDefined();
  });
});
