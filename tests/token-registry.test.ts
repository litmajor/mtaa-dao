import { describe, expect, it } from 'vitest';
import { TokenRegistry, SupportedTokenEnum } from '../shared/tokenRegistry';

describe('Token registry Celo native coverage', () => {
  it('includes bridged and native Celo assets in the Celo native symbol set', () => {
    const symbols = TokenRegistry.getCeloNativeSymbols();

    expect(symbols.has('CELO')).toBe(true);
    expect(symbols.has('cUSD')).toBe(true);
    expect(symbols.has('cEUR')).toBe(true);
    expect(symbols.has('cKES')).toBe(true);
    expect(symbols.has('USDT')).toBe(true);
    expect(symbols.has('USDC')).toBe(true);
  });

  it('exposes cKES in the runtime validation enum', () => {
    expect(SupportedTokenEnum.cKES).toBe('cKES');
  });

  it('exposes a Wormhole bridge route for USDT between Celo and Ethereum', () => {
    const usdt = TokenRegistry.getToken('USDT');

    expect(usdt?.chains?.ethereum?.bridges?.celo?.protocol).toBe('wormhole');
    expect(usdt?.chains?.ethereum?.bridges?.celo?.active).toBe(true);
  });
});
