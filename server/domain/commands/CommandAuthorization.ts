import { and, eq } from 'drizzle-orm';
import type { Command } from './Command';
import { db } from '../../storage';
import {
  daoMemberships,
  paymentTransactions,
  vaults,
} from '../../../shared/schema';
import { PaymentCommandTypes } from '../payments/PaymentCommands';
import { VaultCommandTypes } from '../vaults/VaultCommands';

export type CommandCapability =
  | 'payment.initiate'
  | 'payment.provider_webhook'
  | 'payment.verify'
  | 'payment.settle'
  | 'payment.complete'
  | 'payment.fail'
  | 'payment.reconcile'
  | 'payment.metadata.update'
  | 'vault.create'
  | 'vault.deposit'
  | 'vault.withdraw';

const commandCapabilities: Readonly<Record<string, CommandCapability>> = {
  [PaymentCommandTypes.CreatePayment]: 'payment.initiate',
  [PaymentCommandTypes.ReceiveWebhook]: 'payment.provider_webhook',
  [PaymentCommandTypes.AcceptPayment]: 'payment.verify',
  [PaymentCommandTypes.VerifyPayment]: 'payment.verify',
  [PaymentCommandTypes.SettlePayment]: 'payment.settle',
  [PaymentCommandTypes.CompletePayment]: 'payment.complete',
  [PaymentCommandTypes.FailPayment]: 'payment.fail',
  [PaymentCommandTypes.ReconcilePayment]: 'payment.reconcile',
  [PaymentCommandTypes.UpdatePaymentMetadata]: 'payment.metadata.update',
  [VaultCommandTypes.CreateVault]: 'vault.create',
  [VaultCommandTypes.DepositVault]: 'vault.deposit',
  [VaultCommandTypes.WithdrawVault]: 'vault.withdraw',
};

const providerNames = new Set(['mpesa', 'paystack', 'flutterwave']);
const daoAdminRoles = new Set(['owner', 'founder', 'creator', 'admin', 'elder', 'treasury_manager']);
const daoSpawnMetadataKeys = new Set(['spawnStatus', 'daoId', 'spawnTx', 'spawnError']);
const systemCommandCapabilities: Readonly<Record<string, ReadonlySet<CommandCapability>>> = {
  'system:payment-reconciliation': new Set([
    'payment.provider_webhook',
    'payment.verify',
    'payment.settle',
    'payment.complete',
    'payment.fail',
    'payment.reconcile',
  ]),
  'system:dao-spawn': new Set(['payment.metadata.update']),
};

export function getRequiredCommandCapability(commandType: string): CommandCapability | undefined {
  return commandCapabilities[commandType];
}

async function hasDaoRole(actor: string, daoId: string, roles: ReadonlySet<string>): Promise<boolean> {
  if (!daoId) return false;
  const [membership] = await db.select({
    role: daoMemberships.role,
    status: daoMemberships.status,
    isBanned: daoMemberships.isBanned,
    isAdmin: daoMemberships.isAdmin,
    isElder: daoMemberships.isElder,
  })
    .from(daoMemberships)
    .where(and(
      eq(daoMemberships.daoId, daoId),
      eq(daoMemberships.userId, actor),
    ))
    .limit(1);

  return Boolean(
    membership &&
    membership.status === 'approved' &&
    !membership.isBanned &&
    (roles.has((membership.role || '').toLowerCase()) ||
      (roles.has('admin') && (membership.isAdmin || membership.isElder))),
  );
}

async function authorizePaymentCommand(actor: string, capability: CommandCapability, command: Command): Promise<boolean> {
  const payload = (command.payload || {}) as Record<string, unknown>;
  const providerActor = actor.startsWith('provider-webhook:') ? actor.slice('provider-webhook:'.length) : '';
  if (capability === 'payment.provider_webhook' || capability === 'payment.complete' || capability === 'payment.fail') {
    if (providerActor && providerNames.has(providerActor)) {
      const reference = typeof payload.reference === 'string' ? payload.reference : '';
      const paymentId = typeof payload.paymentId === 'string' ? payload.paymentId : '';
      if (!reference && !paymentId) return false;
      const [payment] = await db.select({ provider: paymentTransactions.provider })
        .from(paymentTransactions)
        .where(reference
          ? eq(paymentTransactions.reference, reference)
          : eq(paymentTransactions.id, paymentId))
        .limit(1);
      return payment?.provider === providerActor;
    }

    return systemCommandCapabilities[actor]?.has(capability) === true;
  }

  if (capability === 'payment.metadata.update') {
    if (!systemCommandCapabilities[actor]?.has(capability)) return false;
    const reference = typeof payload.reference === 'string' ? payload.reference : '';
    const paymentId = typeof payload.paymentId === 'string' ? payload.paymentId : '';
    const metadata = payload.metadata;
    if ((!reference && !paymentId) || !metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
    if (Object.keys(metadata).some((key) => !daoSpawnMetadataKeys.has(key))) return false;

    const [payment] = await db.select({
      type: paymentTransactions.type,
      metadata: paymentTransactions.metadata,
    })
      .from(paymentTransactions)
      .where(reference
        ? eq(paymentTransactions.reference, reference)
        : eq(paymentTransactions.id, paymentId))
      .limit(1);
    const existingMetadata = payment?.metadata;
    return payment?.type === 'dao_spawn_fee' &&
      typeof existingMetadata === 'object' &&
      existingMetadata !== null &&
      !Array.isArray(existingMetadata) &&
      (existingMetadata as Record<string, unknown>).purpose === 'dao_spawn_fee';
  }

  if (capability === 'payment.initiate') {
    return typeof payload.userId === 'string' && payload.userId === actor;
  }
  if (systemCommandCapabilities[actor]?.has(capability)) return true;
  return false;
}

async function authorizeVaultCommand(actor: string, capability: CommandCapability, command: Command): Promise<boolean> {
  const payload = (command.payload || {}) as Record<string, unknown>;
  if (capability === 'vault.create') {
    if (payload.ownerType === 'user') return payload.ownerId === actor;
    if (payload.ownerType === 'dao' && typeof payload.ownerId === 'string') {
      return hasDaoRole(actor, payload.ownerId, daoAdminRoles);
    }
    return false;
  }

  if (typeof payload.vaultId !== 'string' || payload.userId !== actor) return false;
  const [vault] = await db.select({
    id: vaults.id,
    userId: vaults.userId,
    daoId: vaults.daoId,
  }).from(vaults)
    .where(eq(vaults.id, payload.vaultId))
    .limit(1);
  if (!vault) return false;

  if (capability === 'vault.deposit') {
    if (vault.userId) return vault.userId === actor;
    return vault.daoId ? hasDaoRole(actor, vault.daoId, new Set(['member', ...daoAdminRoles])) : false;
  }

  // DAO vault withdrawals are executed through the DAO multisig, never directly
  // through the generic vault command.
  if (vault.daoId) return false;
  return vault.userId === actor;
}

export async function isCommandAuthorized(command: Command, requiredCapability?: string): Promise<boolean> {
  if (
    !requiredCapability ||
    typeof command.actor !== 'string' ||
    !command.actor ||
    command.actor.trim() !== command.actor
  ) return false;
  const capability = requiredCapability as CommandCapability;
  if (!Object.values(commandCapabilities).includes(capability)) return false;
  if (capability.startsWith('payment.')) {
    return authorizePaymentCommand(command.actor, capability, command);
  }
  if (capability.startsWith('vault.')) {
    return authorizeVaultCommand(command.actor, capability, command);
  }
  return false;
}

export async function authorizeCommandForHandler(command: Command, capability: CommandCapability): Promise<boolean> {
  return isCommandAuthorized(command, capability);
}
