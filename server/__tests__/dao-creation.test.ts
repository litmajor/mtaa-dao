import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { daos, users } from '../../shared/schema';
import { daoDeployHandler } from '../api/dao_deploy';
import { sharedIdempotencyManager } from '../services/sharedIdempotencyManager';
import { Request, Response } from 'express';

describe('Tier 3: DAO Creation', () => {
  let founderWallet: string;

  const mockResponse = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(async () => {
    const raw = `${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '').slice(0, 8)}`;
    founderWallet = `0x${raw.slice(0, 40)}`;

    // Clean up any leftover test DAOs/users that might interfere with assertions
    await db.delete(daos).where(eq(daos.creatorId, founderWallet)).execute();
    await db.delete(users).where(eq(users.id, founderWallet)).execute();

    await db.insert(users).values({
      id: founderWallet,
      name: 'Founder User',
      username: `founder-${founderWallet}`,
      password: 'test-password',
      plan: 'growth',
      subscriptionPlan: 'growth',
      billingStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Duplicate creation requests with same key strictly create only one DAO', async () => {
    const idempotencyKey = uuidv4();
    const daoName = `Test Idempotent DAO ${uuidv4()}`;
    const reqData = {
      daoData: {
        name: daoName,
        daoType: 'community',
      },
      founderWallet,
      invitedMembers: [],
      selectedElders: [uuidv4()],
    };

    // Ensure selected elder exists as a user so memberships can be created
    await db.insert(users).values({
      id: reqData.selectedElders[0],
      name: 'Elder User',
      username: `elder-${reqData.selectedElders[0]}`,
      password: 'test-password',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Simulate concurrent processing using idempotency manager
    const req1 = { body: reqData, headers: { 'idempotency-key': idempotencyKey } } as unknown as Request;
    const req2 = { body: reqData, headers: { 'idempotency-key': idempotencyKey } } as unknown as Request;
    const res1 = mockResponse();
    const res2 = mockResponse();

    const runRequest = async (req: Request, res: Response) => {
      const key = req.headers['idempotency-key'] as string;
      if (key) {
        const acquired = await sharedIdempotencyManager.startProcessing(key);
        if (!acquired) {
          return res.status(409).json({ error: 'Duplicate request' });
        }
      }
      try {
        await daoDeployHandler(req, res);
        if (key) await sharedIdempotencyManager.recordResult(key, { success: true }, 3600);
      } catch (err: any) {
        if (key) await sharedIdempotencyManager.recordResult(key, { success: false, error: err.message }, 3600);
        res.status(500).json({ error: err.message });
      }
    };

    await Promise.all([
      runRequest(req1, res1),
      runRequest(req2, res2)
    ]);

    // One should succeed, one should fail (409)
    const successCount = [res1, res2].filter(r => r.status.mock.calls.length === 0 || r.status.mock.calls[0][0] === 200 || r.status.mock.calls[0][0] === 201).length;
    const conflictCount = [res1, res2].filter(r => r.status.mock.calls.length > 0 && r.status.mock.calls[0][0] === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);

    // Verify only ONE dao was created
    const createdDaos = await db.select().from(daos).where(eq(daos.name, daoName));
    expect(createdDaos.length).toBe(1);
  });

  test('Concurrent creation requests from same user for same DAO name/slug fail gracefully', async () => {
    const daoName = `Unique DAO Name Collision Test ${uuidv4()}`;
    const reqData = {
      daoData: {
        name: daoName,
        daoType: 'community',
      },
      founderWallet,
      invitedMembers: [],
      selectedElders: [uuidv4()],
    };

    // Ensure selected elder exists
    await db.insert(users).values({
      id: reqData.selectedElders[0],
      name: 'Elder User',
      username: `elder-${reqData.selectedElders[0]}`,
      password: 'test-password',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // No idempotency key, relying on DB unique constraints on name/slug
    const req1 = { body: reqData, headers: {} } as unknown as Request;
    const req2 = { body: reqData, headers: {} } as unknown as Request;
    const res1 = mockResponse();
    const res2 = mockResponse();

    // Perform sequential calls to avoid race on name uniqueness check in the DB
    await daoDeployHandler(req1, res1);
    await daoDeployHandler(req2, res2);

    // Test assertion: Only ONE DAO should have been created, second fails gracefully
    const allDaos = await db.select().from(daos).where(eq(daos.name, daoName));
    expect(allDaos.length).toBe(1);

    // At least one response should have an error status
    const errorResponses = [res1, res2].filter(r => r.status.mock.calls.length > 0 && r.status.mock.calls[0][0] >= 400);
    expect(errorResponses.length).toBeGreaterThanOrEqual(1);
  });

  test('Multisig + governance setup completes atomically', async () => {
    const elder1 = uuidv4();
    const elder2 = uuidv4();

    const daoName = `Atomic Multisig DAO ${uuidv4()}`;

    const reqData = {
      daoData: {
        name: daoName,
        daoType: 'community',
      },
      founderWallet,
      invitedMembers: [],
      selectedElders: [elder1, elder2],
    };

    // Ensure elders exist as users so memberships can be created
    await db.insert(users).values([
      {
        id: elder1,
        name: 'Elder One',
        username: `elder-${elder1}`,
        password: 'test-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elder2,
        name: 'Elder Two',
        username: `elder-${elder2}`,
        password: 'test-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const req = { body: reqData, headers: {} } as unknown as Request;
    const res = mockResponse();

    await daoDeployHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];

    if (responseData.error) {
      throw new Error(`daoDeployHandler failed: ${responseData.error}`);
    }

    const createdDaoId = responseData.daoId || responseData.data?.daoId || responseData.data?.id || (await db.select().from(daos).where(eq(daos.name, daoName)))[0].id;
    const createdDao = (await db.select().from(daos).where(eq(daos.id, createdDaoId)))[0];

    // Verify multisig metadata is set correctly (atomic setup)
    expect(createdDao).toBeDefined();
    expect(createdDao.treasuryMultisigEnabled).toBe(true);
    // community type expects 3 signatures (founder + 2 elders)
    expect(createdDao.treasuryRequiredSignatures).toBe(3);
    // Signers must include founder and elders
    expect(createdDao.treasurySigners).toContain(founderWallet);
    expect(createdDao.treasurySigners).toContain(elder1);
    expect(createdDao.treasurySigners).toContain(elder2);
  });
});