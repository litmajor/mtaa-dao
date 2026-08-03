import type { ethers } from 'ethers';

interface VaultEventLike {
  eventName?: string | null;
  fragment?: {
    name?: string | null;
    inputs?: Array<{ name?: string | null }>;
  } | null;
  args?: readonly unknown[] | null;
  blockNumber: number;
  transactionHash?: string | null;
}

export interface VaultGapBackfillDependencies {
  contract: Pick<ethers.Contract, 'queryFilter'>;
  provider: Pick<ethers.Provider, 'getBlock'>;
  callback: (event: {
    type: string;
    vaultId: string;
    transactionHash: string;
    blockNumber: number;
    timestamp: number | string;
    userAddress?: string | null;
    tokenSymbol?: string;
    amount?: string | number;
    newNAV?: string | null;
    newFee?: string | null;
    newStatus?: string | null;
    [key: string]: unknown;
  }) => Promise<void> | void;
}

function toStringValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    const maybeStringifiable = value as { toString?: () => unknown };
    if (typeof maybeStringifiable.toString === 'function') {
      const stringValue = maybeStringifiable.toString();
      if (typeof stringValue === 'string') {
        return stringValue;
      }
    }
  }

  return undefined;
}

function toNullableString(value: unknown): string | null {
  const normalized = toStringValue(value);
  return normalized ?? null;
}

export function createVaultGapBackfillHandler({
  contract,
  provider,
  callback,
}: VaultGapBackfillDependencies) {
  return async function backfillGap(fromBlock: number, toBlock: number): Promise<void> {
    if (fromBlock > toBlock) return;

    const events = (await contract.queryFilter('*', fromBlock, toBlock)) as VaultEventLike[];

    for (const event of events) {
      const eventName = event.eventName || event.fragment?.name;
      if (!eventName) continue;

      const block = await provider.getBlock(event.blockNumber);
      const blockTimestamp = block?.timestamp ?? Math.floor(Date.now() / 1000);

      const normalizedArgs: Record<string, unknown> = {};
      if (event.args && event.fragment?.inputs) {
        event.fragment.inputs.forEach((input, index) => {
          const value = event.args?.[index];
          if (input.name) {
            normalizedArgs[input.name] = typeof value === 'bigint' ? value.toString() : value;
          }
        });
      }

      const userAddress = toNullableString(normalizedArgs.user ?? normalizedArgs.caller ?? normalizedArgs.owner);
      const vaultId = toStringValue(normalizedArgs.vaultId ?? normalizedArgs.id) ?? 'canonical_vault';

      await callback({
        type: eventName,
        vaultId,
        transactionHash: event.transactionHash ?? '',
        blockNumber: event.blockNumber,
        timestamp: blockTimestamp,
        userAddress: userAddress ? userAddress.toLowerCase() : null,
        tokenSymbol: toStringValue(normalizedArgs.symbol) ?? 'cUSD',
        amount: toStringValue(normalizedArgs.amount ?? normalizedArgs.value) ?? '0',
        newNAV: toNullableString(normalizedArgs.newNAV),
        newFee: toNullableString(normalizedArgs.newFee),
        newStatus: toNullableString(normalizedArgs.newStatus),
      });
    }
  };
}
