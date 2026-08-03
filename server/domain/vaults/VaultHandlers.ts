import { v4 as uuid } from 'uuid';
import { sql, eq, and } from 'drizzle-orm';
import type { CommandHandler, CommandResult, CommandContext } from '../commands/CommandBus';
import type { Command } from '../commands/Command';
import type { DomainEvent } from '../events/DomainEvent';
import { EventCatalog } from '../events/catalog';
import type {
  CreateVaultPayload,
  DepositVaultPayload,
  WithdrawVaultPayload,
} from './VaultCommands';
import { VaultCommandTypes } from './VaultCommands';
import type{ VaultRepository, VaultAggregate, VaultInsert} from './VaultRepository';
import { VaultOptimisticLockError } from './VaultRepository';
import { VaultStateMachine } from './VaultStateMachine';
import type {VaultStatus} from './VaultStateMachine';
import { vaults, vaultTransactions, vaultTokenHoldings } from '../../../shared/schema';

function buildVaultEvent(
  type: string,
  aggregateId: string,
  actor: string,
  correlationId: string,
  causationId: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return {
    id: uuid(),
    type,
    version: 1,
    aggregateType: 'Vault',
    aggregateId,
    correlationId,
    causationId,
    actor,
    timestamp: new Date(),
    payload,
    metadata: {
      source: 'vault-command-handler',
      environment: process.env.NODE_ENV ?? 'development',
      schemaVersion: 1,
    },
  };
}

function toNumber(value: string | number | null | undefined): number {
  const num = typeof value === 'number' ? value : value ? Number(value) : 0;
  return Number.isFinite(num) ? num : 0;
}

function calculateSharePrice(vault: VaultAggregate): number {
  const supply = toNumber(vault.shareSupply);
  const tvl = toNumber(vault.totalValueLocked);
  if (supply <= 0 || tvl <= 0) {
    return 1;
  }
  return tvl / supply;
}

export class CreateVaultHandler implements CommandHandler<Command<CreateVaultPayload>> {
  readonly commandType = VaultCommandTypes.CreateVault;

  constructor(private repo: VaultRepository) {}

  async execute(command: Command<CreateVaultPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;
    const ownerType = payload.ownerType;

    if (ownerType !== 'user' && ownerType !== 'dao') {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Invalid ownerType '${ownerType}'. Expected 'user' or 'dao'`,
      };
    }

    const vaultCreate: VaultInsert = {
      name: payload.name,
      currency: payload.currency,
      riskLevel: payload.riskLevel ?? 'low',
      minDeposit: payload.minDeposit ?? '0',
      vaultType: 'regular',
      status: 'ACTIVE',
      isActive: true,
      version: 1,
      totalValueLocked: '0',
      shareSupply: '0',
      ownerType: ownerType,
      ownerId: payload.ownerId,
      vaultConfig: payload.metadata ?? {},
      userId: ownerType === 'user' ? payload.ownerId : undefined,
      daoId: ownerType === 'dao' ? payload.ownerId : undefined,
    } as VaultInsert;
    const vault = await this.repo.create(vaultCreate, context.tx);

    const event = buildVaultEvent(
      EventCatalog.VaultUpdated,
      vault.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        vaultId: vault.id,
        name: vault.name,
        ownerType: vault.ownerType,
        ownerId: vault.ownerId,
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}

export class DepositVaultHandler implements CommandHandler<Command<DepositVaultPayload>> {
  readonly commandType = VaultCommandTypes.DepositVault;

  constructor(private repo: VaultRepository) {}

  async execute(command: Command<DepositVaultPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;
    const tx = context.tx;
    const vaultAddress = payload.vaultAddress;

    const vault = await this.repo.findById(payload.vaultId, tx);
    if (!vault) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Vault not found: ${payload.vaultId}`,
      };
    }

    if (vaultAddress && vault.address && vaultAddress !== vault.address) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Vault address mismatch for ${payload.vaultId}`,
      };
    }

    VaultStateMachine.guardCanDeposit(vault.status as VaultStatus);

    if (!payload.transactionHash) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: 'Deposit requires a transactionHash for idempotency',
      };
    }

    const [existing] = await tx
      .select()
      .from(vaultTransactions)
      .where(eq(vaultTransactions.transactionHash, payload.transactionHash))
      .limit(1);

    if (existing) {
      return { success: true, commandId: command.id, events: [] };
    }

    const depositAmount = toNumber(payload.amount);
    if (depositAmount <= 0) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: 'Deposit amount must be greater than zero',
      };
    }

    const sharePrice = calculateSharePrice(vault);
    const sharesMinted = depositAmount / sharePrice;
    const updatedTotalValueLocked = toNumber(vault.totalValueLocked) + depositAmount;
    const updatedShareSupply = toNumber(vault.shareSupply) + sharesMinted;

    const [existingHolding] = await tx
      .select()
      .from(vaultTokenHoldings)
      .where(
        and(
          eq(vaultTokenHoldings.vaultId, payload.vaultId),
          eq(vaultTokenHoldings.tokenSymbol, payload.tokenSymbol),
        )
      )
      .limit(1);

    if (existingHolding) {
      await tx
        .update(vaultTokenHoldings)
        .set({
          balance: sql`${vaultTokenHoldings.balance} + ${depositAmount}`,
          totalDeposited: sql`${vaultTokenHoldings.totalDeposited} + ${depositAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(vaultTokenHoldings.id, existingHolding.id));
    } else {
      await tx.insert(vaultTokenHoldings).values({
        vaultId: payload.vaultId,
        tokenSymbol: payload.tokenSymbol,
        balance: depositAmount,
        totalDeposited: depositAmount,
        valueUSD: 0,
      });
    }

    await tx.insert(vaultTransactions).values({
      vaultId: payload.vaultId,
      userId: payload.userId,
      transactionType: 'deposit',
      tokenSymbol: payload.tokenSymbol,
      amount: depositAmount,
      valueUSD: 0,
      transactionHash: payload.transactionHash,
      status: 'completed',
      sharesMinted: sharesMinted,
      metadata: payload.metadata ?? {},
      provider: 'vault',
      fromAddress: payload.senderAddress,
      timestamp: new Date(),
    });

    const expectedVersion = vault.version ?? 0;
    try {
      await this.repo.update(
        vault.id,
        expectedVersion,
        {
          totalValueLocked: updatedTotalValueLocked.toString(),
          shareSupply: updatedShareSupply.toString(),
          balance: sql`${vaults.balance} + ${depositAmount}` as any,
        },
        tx,
      );
    } catch (err) {
      if (err instanceof VaultOptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      throw err;
    }

    const event = buildVaultEvent(
      EventCatalog.DepositCompleted,
      vault.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        vaultId: vault.id,
        vaultAddress,
        amount: depositAmount,
        tokenSymbol: payload.tokenSymbol,
        sharesMinted,
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}

export class WithdrawVaultHandler implements CommandHandler<Command<WithdrawVaultPayload>> {
  readonly commandType = VaultCommandTypes.WithdrawVault;

  constructor(private repo: VaultRepository) {}

  async execute(command: Command<WithdrawVaultPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;
    const tx = context.tx;
    const vaultAddress = payload.vaultAddress;

    const vault = await this.repo.findById(payload.vaultId, tx);
    if (!vault) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Vault not found: ${payload.vaultId}`,
      };
    }

    if (vaultAddress && vault.address && vaultAddress !== vault.address) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Vault address mismatch for ${payload.vaultId}`,
      };
    }

    VaultStateMachine.guardCanWithdraw(vault.status as VaultStatus);

    if (!payload.transactionHash) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: 'Withdrawal requires a transactionHash for idempotency',
      };
    }

    const [existing] = await tx
      .select()
      .from(vaultTransactions)
      .where(eq(vaultTransactions.transactionHash, payload.transactionHash))
      .limit(1);

    if (existing) {
      return { success: true, commandId: command.id, events: [] };
    }

    const sharesToBurn = toNumber(payload.shares);
    if (sharesToBurn <= 0) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: 'Withdrawal shares must be greater than zero',
      };
    }

    const currentSupply = toNumber(vault.shareSupply);
    if (sharesToBurn > currentSupply) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: 'Cannot withdraw more shares than the vault currently supplies',
      };
    }

    const sharePrice = calculateSharePrice(vault);
    const withdrawalAmount = sharesToBurn * sharePrice;
    const updatedTotalValueLocked = Math.max(0, toNumber(vault.totalValueLocked) - withdrawalAmount);
    const updatedShareSupply = Math.max(0, currentSupply - sharesToBurn);

    const tokenSymbol = vault.currency;

    const [holding] = await tx
      .select()
      .from(vaultTokenHoldings)
      .where(
        and(
          eq(vaultTokenHoldings.vaultId, payload.vaultId),
          eq(vaultTokenHoldings.tokenSymbol, tokenSymbol),
        )
      )
      .limit(1);

    if (!holding || toNumber(holding.balance) < withdrawalAmount) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Insufficient vault holding for ${tokenSymbol}`,
      };
    }

    await tx
      .update(vaultTokenHoldings)
      .set({
        balance: sql`${vaultTokenHoldings.balance} - ${withdrawalAmount}`,
        totalWithdrawn: sql`${vaultTokenHoldings.totalWithdrawn} + ${withdrawalAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(vaultTokenHoldings.id, holding.id));

    await tx.insert(vaultTransactions).values({
      vaultId: payload.vaultId,
      userId: payload.userId,
      transactionType: 'withdrawal',
      tokenSymbol,
      amount: withdrawalAmount,
      valueUSD: 0,
      transactionHash: payload.transactionHash,
      status: 'completed',
      sharesBurned: sharesToBurn,
      metadata: payload.metadata ?? {},
      provider: 'vault',
      fromAddress: payload.recipientAddress,
      timestamp: new Date(),
    });

    const expectedVersion = vault.version ?? 0;
    try {
      await this.repo.update(
        vault.id,
        expectedVersion,
        {
          totalValueLocked: updatedTotalValueLocked.toString(),
          shareSupply: updatedShareSupply.toString(),
          balance: sql`${vaults.balance} - ${withdrawalAmount}` as any,
        },
        tx,
      );
    } catch (err) {
      if (err instanceof VaultOptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      throw err;
    }

    const event = buildVaultEvent(
      EventCatalog.WithdrawalCompleted,
      vault.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        vaultId: vault.id,
        vaultAddress,
        sharesBurned: sharesToBurn,
        amount: withdrawalAmount,
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}
