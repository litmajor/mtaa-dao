import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { Command } from '../../domain/commands/Command';
import type { CommandContext } from '../../domain/commands/CommandBus';
import {
  CreateVaultHandler,
  DepositVaultHandler,
  WithdrawVaultHandler,
} from '../../domain/vaults/VaultHandlers';
import {
  VaultRepository,
  VaultAggregate,
} from '../../domain/vaults/VaultRepository';
import { VaultCommandTypes } from '../../domain/vaults/VaultCommands';
import { vaultTransactions, vaultTokenHoldings } from '../../../shared/schema';

function makeVaultAggregate(overrides: Partial<VaultAggregate> = {}): VaultAggregate {
  return {
    id: 'vault-1',
    name: 'Test Vault',
    currency: 'USDC',
    address: '0xvault-address',
    balance: '0',
    totalValueLocked: '100',
    shareSupply: '100',
    status: 'ACTIVE',
    version: 1,
    ownerType: 'user',
    ownerId: 'user-1',
    userId: 'user-1',
    daoId: null,
    creatorId: 'user-1',
    riskLevel: 'low',
    minDeposit: '0',
    vaultType: 'regular',
    isActive: true,
    vaultConfig: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    // The type includes many optional fields; allow overrides to fill them in.
    ...(overrides as object),
  } as unknown as VaultAggregate;
}

function makeCommand<T>(type: string, payload: T): Command<T> {
  return {
    id: uuidv4(),
    type,
    actor: 'test-actor',
    correlationId: 'corr-1',
    timestamp: new Date(),
    payload,
  };
}

describe('Vault Command Handlers', () => {
  let mockRepo: Partial<VaultRepository>;
  let mockTx: any;
  let context: CommandContext;
  let selectChain: any;
  let updateChain: any;
  let insertChain: any;

  beforeEach(() => {
    selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    insertChain = {
      values: vi.fn().mockResolvedValue(undefined),
    };

    mockTx = {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
      insert: vi.fn().mockReturnValue(insertChain),
    };

    mockRepo = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    context = { tx: mockTx };
  });

  describe('CreateVaultHandler', () => {
    it('creates a vault and returns an event', async () => {
      const handler = new CreateVaultHandler(mockRepo as VaultRepository);
      const vault = makeVaultAggregate({ id: 'vault-create-1' });
      (mockRepo.create as any).mockResolvedValue(vault);

      const command = makeCommand(VaultCommandTypes.CreateVault, {
        name: 'Test Vault',
        currency: 'USDC',
        ownerType: 'user',
        ownerId: 'user-1',
        riskLevel: 'medium',
        minDeposit: '10',
        metadata: { purpose: 'testing' },
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events?.[0].payload).toMatchObject({
        vaultId: 'vault-create-1',
        ownerType: 'user',
        ownerId: 'user-1',
      });
      expect(mockRepo.create).toHaveBeenCalledOnce();
    });
  });

  describe('DepositVaultHandler', () => {
    it('records a deposit when no previous transaction exists', async () => {
      const handler = new DepositVaultHandler(mockRepo as VaultRepository);
      const vault = makeVaultAggregate({ id: 'vault-deposit-1' });
      (mockRepo.findById as any).mockResolvedValue(vault);
      (mockRepo.update as any).mockResolvedValue({ ...vault, version: 2 });
      selectChain.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const command = makeCommand(VaultCommandTypes.DepositVault, {
        vaultId: 'vault-deposit-1',
        vaultAddress: '0xvault-address',
        userId: 'user-1',
        senderAddress: '0xsender',
        tokenSymbol: 'USDC',
        amount: '50',
        transactionHash: 'tx-123',
        metadata: { source: 'unit-test' },
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events?.[0].payload).toMatchObject({
        vaultId: 'vault-deposit-1',
        vaultAddress: '0xvault-address',
        tokenSymbol: 'USDC',
      });
      expect(mockTx.select).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
      expect((mockTx.insert as any).mock.calls[0][0]).toBe(vaultTokenHoldings);
      expect((mockTx.insert as any).mock.calls[1][0]).toBe(vaultTransactions);
      expect(mockRepo.update).toHaveBeenCalledWith(
        'vault-deposit-1',
        1,
        expect.objectContaining({
          totalValueLocked: expect.any(String),
          shareSupply: expect.any(String),
        }),
        context.tx,
      );
    });

    it('returns success when the deposit transaction already exists', async () => {
      const handler = new DepositVaultHandler(mockRepo as VaultRepository);
      const vault = makeVaultAggregate({ id: 'vault-folded' });
      (mockRepo.findById as any).mockResolvedValue(vault);
      selectChain.limit.mockResolvedValueOnce([{ id: 'tx-123' }]);

      const command = makeCommand(VaultCommandTypes.DepositVault, {
        vaultId: 'vault-folded',
        vaultAddress: '0xvault-address',
        userId: 'user-1',
        senderAddress: '0xsender',
        tokenSymbol: 'USDC',
        amount: '50',
        transactionHash: 'tx-123',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toEqual([]);
      expect(mockTx.insert).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('rejects deposit when vault address mismatches', async () => {
      const handler = new DepositVaultHandler(mockRepo as VaultRepository);
      const vault = makeVaultAggregate({ id: 'vault-deposit-2' });
      (mockRepo.findById as any).mockResolvedValue(vault);

      const command = makeCommand(VaultCommandTypes.DepositVault, {
        vaultId: 'vault-deposit-2',
        vaultAddress: '0xwrong-address',
        userId: 'user-1',
        senderAddress: '0xsender',
        tokenSymbol: 'USDC',
        amount: '50',
        transactionHash: 'tx-456',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Vault address mismatch');
      expect(mockTx.insert).not.toHaveBeenCalled();
    });
  });

  describe('WithdrawVaultHandler', () => {
    it('processes a withdrawal when the vault has enough shares and holdings', async () => {
      const handler = new WithdrawVaultHandler(mockRepo as VaultRepository);
      const vault = makeVaultAggregate({ id: 'vault-withdraw-1' });
      const holding = { id: 'holding-1', balance: '20', totalWithdrawn: '0' };
      (mockRepo.findById as any).mockResolvedValue(vault);
      (mockRepo.update as any).mockResolvedValue({ ...vault, version: 2 });
      selectChain.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([holding]);

      const command = makeCommand(VaultCommandTypes.WithdrawVault, {
        vaultId: 'vault-withdraw-1',
        vaultAddress: '0xvault-address',
        userId: 'user-1',
        recipientAddress: '0xrecipient',
        shares: '10',
        transactionHash: 'tx-789',
        metadata: { note: 'withdraw' },
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events?.[0].payload).toMatchObject({
        vaultId: 'vault-withdraw-1',
        vaultAddress: '0xvault-address',
      });
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
      expect((mockTx.insert as any).mock.calls[0][0]).toBe(vaultTransactions);
      expect(mockRepo.update).toHaveBeenCalledWith(
        'vault-withdraw-1',
        1,
        expect.objectContaining({
          totalValueLocked: expect.any(String),
          shareSupply: expect.any(String),
        }),
        context.tx,
      );
    });

    it('rejects withdrawal when the vault address mismatches', async () => {
      const handler = new WithdrawVaultHandler(mockRepo as VaultRepository);
      const vault = makeVaultAggregate({ id: 'vault-withdraw-2' });
      (mockRepo.findById as any).mockResolvedValue(vault);

      const command = makeCommand(VaultCommandTypes.WithdrawVault, {
        vaultId: 'vault-withdraw-2',
        vaultAddress: '0xwrong-address',
        userId: 'user-1',
        recipientAddress: '0xrecipient',
        shares: '10',
        transactionHash: 'tx-890',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Vault address mismatch');
      expect(mockTx.insert).not.toHaveBeenCalled();
    });
  });
});
