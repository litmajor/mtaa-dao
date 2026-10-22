import { describe, expect, it } from 'vitest';
import {
  getStablecoinAsset,
  getWalletNetwork,
  SUPPORTED_STABLECOIN_ASSETS,
} from './blockchain';

describe('canonical stablecoin asset registry', () => {
  it('binds supported assets to exact network, contract, and decimals', () => {
    expect(getStablecoinAsset('celo-mainnet-cusd')).toMatchObject({
      symbol: 'cUSD',
      chainId: 42220,
      address: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
      decimals: 18,
    });
    expect(getStablecoinAsset('celo-mainnet-usdc')).toMatchObject({
      symbol: 'USDC',
      chainId: 42220,
      address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
      decimals: 6,
    });
    expect(getStablecoinAsset('celo-mainnet-usdt')).toMatchObject({
      symbol: 'USDT',
      chainId: 42220,
      address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
      decimals: 6,
    });
  });

  it('limits Ethereum and Base to their explicitly allowlisted tokens', () => {
    expect(SUPPORTED_STABLECOIN_ASSETS.filter((asset) => asset.chainId === 1).map((asset) => asset.symbol))
      .toEqual(['USDC', 'USDT']);
    expect(SUPPORTED_STABLECOIN_ASSETS.filter((asset) => asset.chainId === 8453).map((asset) => asset.symbol))
      .toEqual(['USDC']);
    expect(getWalletNetwork(8453)?.name).toBe('Base Mainnet');
  });

  it('rejects an unlisted token/network pair', () => {
    expect(() => getStablecoinAsset('base-mainnet-usdt')).toThrow(
      'This stablecoin/network combination is not supported.',
    );
  });
});
