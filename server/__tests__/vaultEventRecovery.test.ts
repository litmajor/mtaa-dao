import { describe, expect, it, vi } from 'vitest';
import { createVaultGapBackfillHandler } from '../services/vaultEventRecovery';

describe('createVaultGapBackfillHandler', () => {
  it('queries the missed block range and normalizes events for callback', async () => {
    const callback = vi.fn();
    const contract = {
      queryFilter: vi.fn().mockResolvedValue([
        {
          eventName: 'DepositMade',
          blockNumber: 123,
          transactionHash: '0xabc',
          args: [{ toString: () => '100' }],
          fragment: {
            name: 'DepositMade',
            inputs: [{ name: 'amount' }],
          },
        },
      ]),
    } as any;
    const provider = {
      getBlock: vi.fn().mockResolvedValue({ timestamp: 1700000000 }),
    } as any;

    const handler = createVaultGapBackfillHandler({ contract, provider, callback });

    await handler(120, 123);

    expect(contract.queryFilter).toHaveBeenCalledWith('*', 120, 123);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DepositMade',
        blockNumber: 123,
        transactionHash: '0xabc',
        amount: '100',
      })
    );
  });
});
