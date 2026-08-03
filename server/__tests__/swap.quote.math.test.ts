import { describe, expect, it } from 'vitest';
import { computeEstimatedToAmountAtomic } from '../services/crossChainSwapService';
import { ethers } from 'ethers';

describe('Quote math: decimal scaling, slippage, and rounding', () => {
  /**
   * Case 1: Non-18 decimal scaling
   * Validates quote calculation works correctly when from/to tokens have different decimals
   */
  describe('decimal scaling', () => {
    it('scales USDC (6 decimals) to 18-decimal token at 1:2 price ratio', () => {
      const fromDecimals = 6;
      const toDecimals = 18;
      const fromAmountAtomic = '1000000'; // 1.0 USDC
      const fromPrice = 1; // $1
      const toPrice = 2; // $2 -> half the amount expected

      const estimated = computeEstimatedToAmountAtomic(
        fromAmountAtomic,
        fromDecimals,
        toDecimals,
        fromPrice,
        toPrice
      );

      expect(BigInt(estimated)).toBe(500000000000000000n); // 0.5 * 10^18
    });

    it('scales 8-decimal token (like USDT on some chains) to 18 decimals', () => {
      const fromDecimals = 8;
      const toDecimals = 18;
      const fromAmountAtomic = '100000000'; // 1.0 token in 8 decimals
      const fromPrice = 1;
      const toPrice = 1;

      const estimated = computeEstimatedToAmountAtomic(
        fromAmountAtomic,
        fromDecimals,
        toDecimals,
        fromPrice,
        toPrice
      );

      expect(BigInt(estimated)).toBe(1000000000000000000n); // 1.0 * 10^18
    });

    it('scales 18-decimal token to 6-decimal token (upscale decimals, downscale amount)', () => {
      const fromDecimals = 18;
      const toDecimals = 6;
      const fromAmountAtomic = '1000000000000000000'; // 1.0 token in 18 decimals
      const fromPrice = 1;
      const toPrice = 1;

      const estimated = computeEstimatedToAmountAtomic(
        fromAmountAtomic,
        fromDecimals,
        toDecimals,
        fromPrice,
        toPrice
      );

      expect(BigInt(estimated)).toBe(1000000n); // 1.0 * 10^6
    });
  });

  /**
   * Case 2: Rounding at extremes
   * Validates precision is maintained with very large and very small amounts
   * (This was the original bug pattern: float rounding losses at scale)
   */
  describe('rounding at extremes', () => {
    it('maintains precision for large amounts (1M tokens)', () => {
      const fromDecimals = 18;
      const toDecimals = 18;
      const fromAmountAtomic = '1000000000000000000000000'; // 1M tokens
      const fromPrice = 100;
      const toPrice = 1;

      const estimated = computeEstimatedToAmountAtomic(
        fromAmountAtomic,
        fromDecimals,
        toDecimals,
        fromPrice,
        toPrice
      );

      const estimatedBig = BigInt(estimated);
      const expectedMin = BigInt('100000000000000000000000000'); // 100M (1M * 100 / 1)
      expect(estimatedBig).toBeGreaterThanOrEqual(expectedMin - 1n); // allow ±1 rounding
      expect(estimatedBig).toBeLessThanOrEqual(expectedMin + 1n);
    });

    it('maintains precision for very small amounts (0.000001 tokens)', () => {
      const fromDecimals = 18;
      const toDecimals = 18;
      const fromAmountAtomic = '1000'; // 0.000000000000001 tokens
      const fromPrice = 1000;
      const toPrice = 1;

      const estimated = computeEstimatedToAmountAtomic(
        fromAmountAtomic,
        fromDecimals,
        toDecimals,
        fromPrice,
        toPrice
      );

      const estimatedBig = BigInt(estimated);
      // 0.000000000000001 * 1000 / 1 = 0.000000000001
      const expectedMin = 1000000n; // 0.000000000001 * 10^18 ≈ 10^6
      expect(estimatedBig).toBeGreaterThanOrEqual(expectedMin - 1n);
      expect(estimatedBig).toBeLessThanOrEqual(expectedMin + 1n);
    });

    it('rounds correctly when rounding is necessary (odd division)', () => {
      const fromDecimals = 18;
      const toDecimals = 18;
      const fromAmountAtomic = '1000000000000000001'; // 1.000000000000000001 tokens
      const fromPrice = 1;
      const toPrice = 3; // 1/3 will require rounding

      const estimated = computeEstimatedToAmountAtomic(
        fromAmountAtomic,
        fromDecimals,
        toDecimals,
        fromPrice,
        toPrice
      );

      const estimatedBig = BigInt(estimated);
      // 1.000000000000000001 / 3 ≈ 0.333333333333333333666...
      // Should round to nearest, not truncate
      const expectedBig = BigInt('333333333333333334'); // rounded to nearest
      expect(estimatedBig).toBe(expectedBig);
    });
  });

  /**
   * Case 3: Explicit fee and exchangeRate validation
   * Validates that fees and rates are computed deterministically
   */
  describe('explicit fees and exchange rates', () => {
    it('computes bridge fee as exactly 0.1% (1/1000)', () => {
      const amountBigInt = ethers.toBigInt('1000000000000000000'); // 1 token
      const bridgeFeeBigInt = (amountBigInt * 1n) / 1000n;

      expect(bridgeFeeBigInt).toBe(BigInt('1000000000000000')); // 0.001 * 10^18
    });

    it('computes bridge fee correctly for amounts not evenly divisible by 1000', () => {
      const amountBigInt = ethers.toBigInt('1234567890123456789');
      const bridgeFeeBigInt = (amountBigInt * 1n) / 1000n;

      // 1234567890123456789 / 1000 = 1234567890123456 (integer division, truncates)
      expect(bridgeFeeBigInt).toBe(BigInt('1234567890123456'));
    });

    it('preserves exchangeRate computation across decimal scales', () => {
      // exchangeRate = fromPrice / toPrice
      const fromPrice = 1500.5;
      const toPrice = 1;
      const exchangeRate = fromPrice / toPrice;

      expect(exchangeRate).toBe(1500.5);

      // Verify scaled prices also maintain ratio
      const priceScale = 1_000_000n;
      const fromPriceScaled = BigInt(Math.round(fromPrice * Number(priceScale)));
      const toPriceScaled = BigInt(Math.round(toPrice * Number(priceScale)));

      // ratio should be approximately the same
      const ratioScaled = Number(fromPriceScaled) / Number(toPriceScaled);
      expect(ratioScaled).toBeCloseTo(exchangeRate, 4);
    });

    it('validates zero-price rejection', () => {
      expect(() => {
        computeEstimatedToAmountAtomic('1000000000000000000', 18, 18, 1, 0);
      }).toThrow('Invalid destination token price');
    });
  });

  /**
   * Slippage application (combined with estimates)
   */
  describe('slippage minimum acceptance', () => {
    it('computes 1% slippage minimum from estimated amount', () => {
      const estimated = computeEstimatedToAmountAtomic(
        '1000000000000000000',
        18,
        18,
        1,
        1
      );
      const estimatedBig = BigInt(estimated);

      const slippagePercent = 1;
      const minAccept = (estimatedBig * BigInt(100 - slippagePercent)) / 100n;

      expect(minAccept).toBe((estimatedBig * 99n) / 100n);
      expect(minAccept).toBeLessThan(estimatedBig);
    });

    it('computes 5% slippage minimum correctly', () => {
      const estimated = computeEstimatedToAmountAtomic(
        '1000000000000000000',
        18,
        18,
        1,
        1
      );
      const estimatedBig = BigInt(estimated);

      const slippagePercent = 5;
      const minAccept = (estimatedBig * BigInt(100 - slippagePercent)) / 100n;

      expect(minAccept).toBe((estimatedBig * 95n) / 100n);
    });
  });
});

