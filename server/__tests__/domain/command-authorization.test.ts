import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from '../../domain/commands/Command';

const { limit } = vi.hoisted(() => ({ limit: vi.fn() }));

vi.mock('../../storage', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit,
    })),
  },
}));

import {
  getRequiredCommandCapability,
  isCommandAuthorized,
} from '../../domain/commands/CommandAuthorization';
import { PaymentCommandTypes } from '../../domain/payments/PaymentCommands';
import { VaultCommandTypes } from '../../domain/vaults/VaultCommands';

function makeCommand(type: string, actor: string, payload: Record<string, unknown> = {}): Command {
  return {
    id: 'command-1',
    type,
    actor,
    correlationId: 'correlation-1',
    timestamp: new Date(),
    payload,
  };
}

describe('Command authorization policy', () => {
  beforeEach(() => {
    limit.mockReset();
  });

  it('fails closed for command types without an explicit policy', async () => {
    const command = makeCommand('UnregisteredFinancialCommand', 'user-1');

    expect(getRequiredCommandCapability(command.type)).toBeUndefined();
    expect(await isCommandAuthorized(command)).toBe(false);
  });

  it('limits the reconciliation identity to its explicitly granted payment capabilities', async () => {
    const webhook = makeCommand(PaymentCommandTypes.ReceiveWebhook, 'system:payment-reconciliation');
    const verify = makeCommand(PaymentCommandTypes.VerifyPayment, 'system:payment-reconciliation');
    const complete = makeCommand(PaymentCommandTypes.CompletePayment, 'system:payment-reconciliation');

    expect(await isCommandAuthorized(webhook, 'payment.provider_webhook')).toBe(true);
    expect(await isCommandAuthorized(verify, 'payment.verify')).toBe(true);
    expect(await isCommandAuthorized(complete, 'payment.complete')).toBe(true);
  });

  it('rejects provider webhook actors when the stored payment belongs to another provider', async () => {
    limit.mockResolvedValueOnce([{ provider: 'paystack' }]);
    const command = makeCommand(PaymentCommandTypes.ReceiveWebhook, 'provider-webhook:mpesa', {
      reference: 'payment-reference',
    });

    expect(await isCommandAuthorized(command, 'payment.provider_webhook')).toBe(false);
  });

  it('does not authorize generic withdrawals from DAO vaults', async () => {
    limit.mockResolvedValueOnce([{ id: 'vault-1', userId: null, daoId: 'dao-1' }]);
    const command = makeCommand(VaultCommandTypes.WithdrawVault, 'user-1', {
      vaultId: 'vault-1',
      userId: 'user-1',
    });

    expect(await isCommandAuthorized(command, 'vault.withdraw')).toBe(false);
  });

  it('requires an approved DAO admin membership to create DAO-owned vaults', async () => {
    const command = makeCommand(VaultCommandTypes.CreateVault, 'user-1', {
      ownerType: 'dao',
      ownerId: 'dao-1',
    });
    limit.mockResolvedValueOnce([{
      role: 'member',
      status: 'approved',
      isBanned: false,
      isAdmin: true,
      isElder: false,
    }]);

    expect(await isCommandAuthorized(command, 'vault.create')).toBe(true);

    limit.mockResolvedValueOnce([{
      role: 'admin',
      status: 'pending',
      isBanned: false,
      isAdmin: true,
      isElder: false,
    }]);
    expect(await isCommandAuthorized(command, 'vault.create')).toBe(false);
  });

  it('scopes payment metadata updates to the DAO-spawn worker and DAO-spawn records', async () => {
    const update = makeCommand(PaymentCommandTypes.UpdatePaymentMetadata, 'system:dao-spawn', {
      reference: 'spawn-reference',
      metadata: { spawnStatus: 'completed' },
    });
    limit.mockResolvedValueOnce([{
      type: 'dao_spawn_fee',
      metadata: { purpose: 'dao_spawn_fee' },
    }]);

    expect(await isCommandAuthorized(update, 'payment.metadata.update')).toBe(true);

    const arbitraryUpdate = makeCommand(PaymentCommandTypes.UpdatePaymentMetadata, 'system:dao-spawn', {
      reference: 'spawn-reference',
      metadata: { admin: true },
    });
    expect(await isCommandAuthorized(arbitraryUpdate, 'payment.metadata.update')).toBe(false);
  });
});
