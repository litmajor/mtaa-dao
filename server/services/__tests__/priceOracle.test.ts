import { priceOracle } from '../priceOracle';

describe('PriceOracle defaults', () => {
  test('contains seeded mappings like FTT', () => {
    const supported = priceOracle.getSupportedCurrencies();
    expect(supported).toContain('FTT');
  });
});
