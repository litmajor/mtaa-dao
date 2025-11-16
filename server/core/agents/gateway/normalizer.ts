/**
 * Data Normalizer
 * Standardizes data from different adapters into uniform format
 * Handles decimal conversion, APY/APR calculations, timestamp normalization
 */

import { NormalizedData } from "./types";

export interface NormalizationConfig {
  priceDecimalPlaces?: number;
  apyDecimalPlaces?: number;
  tvlDecimalPlaces?: number;
  balanceDecimalPlaces?: number;
  defaultConfidence?: number;
}

export class DataNormalizer {
  private config: NormalizationConfig;

  constructor(config: Partial<NormalizationConfig> = {}) {
    this.config = {
      priceDecimalPlaces: config.priceDecimalPlaces || 8,
      apyDecimalPlaces: config.apyDecimalPlaces || 4,
      tvlDecimalPlaces: config.tvlDecimalPlaces || 2,
      balanceDecimalPlaces: config.balanceDecimalPlaces || 18,
      defaultConfidence: config.defaultConfidence || 0.85,
    };
  }

  /**
   * Normalize price data from various sources
   * Converts to USD prices with consistent decimal places
   */
  normalizePrice(
    data: NormalizedData,
    tokenDecimals: number = 18
  ): NormalizedData {
    if (data.dataType !== "price") {
      throw new Error("Expected price data type");
    }

    return {
      ...data,
      value: this.roundDecimals(typeof data.value === "string" ? parseFloat(data.value) : data.value, this.config.priceDecimalPlaces!),
      metadata: {
        ...data.metadata,
        confidence: data.metadata?.confidence || this.config.defaultConfidence,
        tokenDecimals,
        normalizedDecimals: this.config.priceDecimalPlaces,
        normalized: true,
      },
    };
  }

  /**
   * Normalize APY/APR data across different protocols
   * Standardizes to percentage format (100 = 100%)
   */
  normalizeAPY(data: NormalizedData): NormalizedData {
    if (data.dataType !== "apy") {
      throw new Error("Expected apy data type");
    }

    let apyValue = typeof data.value === "string" ? parseFloat(data.value) : data.value;

    // Convert from decimal format (0.05) to percentage (5)
    if (apyValue > 0 && apyValue < 1) {
      apyValue = apyValue * 100;
    }

    // Handle ray format (1e27)
    if (apyValue > 1e20) {
      apyValue = apyValue / 1e25; // Convert ray to percentage
    }

    return {
      ...data,
      value: this.roundDecimals(apyValue, this.config.apyDecimalPlaces!),
      metadata: {
        ...data.metadata,
        confidence: data.metadata?.confidence || this.config.defaultConfidence,
        normalizedFormat: "percentage",
        normalized: true,
      },
    };
  }

  /**
   * Normalize liquidity/TVL data
   * Standardizes to USD value
   */
  normalizeLiquidity(data: NormalizedData): NormalizedData {
    const tvlValue = typeof data.value === "string" ? parseFloat(data.value) : data.value;
    
    return {
      ...data,
      value: this.roundDecimals(tvlValue, this.config.tvlDecimalPlaces!),
      metadata: {
        ...data.metadata,
        confidence: data.metadata?.confidence || this.config.defaultConfidence,
        normalizedFormat: "usd",
        normalized: true,
      },
    };
  }

  /**
   * Normalize wallet balance data
   * Handles token decimals, converts to human-readable format
   */
  normalizeBalance(
    data: NormalizedData,
    tokenDecimals: number = 18
  ): NormalizedData {
    if (data.dataType !== "balance") {
      throw new Error("Expected balance data type");
    }

    // Convert from raw balance to human-readable
    let normalizedValue = typeof data.value === "string" ? parseFloat(data.value) : data.value;
    const humanReadable = normalizedValue / 10 ** tokenDecimals;

    return {
      ...data,
      value: this.roundDecimals(humanReadable, tokenDecimals),
      metadata: {
        ...data.metadata,
        confidence: data.metadata?.confidence || this.config.defaultConfidence,
        tokenDecimals,
        rawBalance: data.value,
        humanReadable: true,
        normalized: true,
      },
    };
  }

  /**
   * Normalize risk score data
   * Standardizes to 0-100 scale where 100 = highest risk
   */
  normalizeRisk(data: NormalizedData): NormalizedData {
    if (data.dataType !== "risk") {
      throw new Error("Expected risk data type");
    }

    let riskScore = typeof data.value === "string" ? parseFloat(data.value) : data.value;

    // Convert from 0-1 to 0-100
    if (riskScore >= 0 && riskScore <= 1) {
      riskScore = riskScore * 100;
    }

    return {
      ...data,
      value: this.roundDecimals(riskScore, 2),
      metadata: {
        ...data.metadata,
        confidence: data.metadata?.confidence || this.config.defaultConfidence,
        normalizedFormat: "0-100",
        riskLevel: this.classifyRisk(riskScore),
        normalized: true,
      },
    };
  }

  /**
   * Normalize transaction data
   * Standardizes gas amounts, fees, timestamps
   */
  normalizeTransaction(data: NormalizedData): NormalizedData {
    if (data.dataType !== "transaction") {
      throw new Error("Expected transaction data type");
    }

    // Keep transaction values as string (they can be very large)
    const txValue = typeof data.value === "string" ? data.value : data.value.toString();

    return {
      ...data,
      value: txValue as any, // Keep as string for precision
      metadata: {
        ...data.metadata,
        confidence: data.metadata?.confidence || this.config.defaultConfidence,
        normalized: true,
        transactionTimestamp: data.timestamp,
      },
    };
  }

  /**
   * Batch normalize multiple data points
   */
  normalizeMultiple(data: NormalizedData[]): NormalizedData[] {
    return data.map((item) => this.normalize(item));
  }

  /**
   * Route to appropriate normalizer based on data type
   */
  normalize(
    data: NormalizedData,
    context?: { tokenDecimals?: number }
  ): NormalizedData {
    switch (data.dataType) {
      case "price":
        return this.normalizePrice(data, context?.tokenDecimals);
      case "apy":
        return this.normalizeAPY(data);
      case "liquidity":
      case "tvl":
        return this.normalizeLiquidity(data);
      case "balance":
        return this.normalizeBalance(data, context?.tokenDecimals);
      case "risk":
        return this.normalizeRisk(data);
      case "transaction":
        return this.normalizeTransaction(data);
      default:
        // Return as-is for unknown types
        return {
          ...data,
          metadata: {
            ...data.metadata,
            normalized: false,
          },
        };
    }
  }

  /**
   * Calculate APY from APR
   * APY = (1 + APR/365)^365 - 1
   */
  aprToApy(apr: number, compoundingPerDay: number = 1): number {
    const dailyRate = apr / 365 / 100;
    const apy = (Math.pow(1 + dailyRate, 365 * compoundingPerDay) - 1) * 100;
    return this.roundDecimals(apy, this.config.apyDecimalPlaces!);
  }

  /**
   * Calculate net APY after fees
   */
  calculateNetAPY(
    grossAPY: number,
    performanceFeePercent: number,
    managementFeePercent: number
  ): number {
    const performanceFee = (grossAPY * performanceFeePercent) / 100;
    const managementFee = managementFeePercent;
    const netAPY = grossAPY - performanceFee - managementFee;
    return this.roundDecimals(netAPY, this.config.apyDecimalPlaces!);
  }

  /**
   * Interpolate missing data points using weighted average
   */
  interpolate(
    values: { timestamp: Date; value: number }[],
    targetTimestamp: Date
  ): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0].value;

    // Sort by timestamp
    values.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Find surrounding values
    let before = values[0];
    let after = values[values.length - 1];

    for (let i = 0; i < values.length - 1; i++) {
      if (
        values[i].timestamp <= targetTimestamp &&
        values[i + 1].timestamp >= targetTimestamp
      ) {
        before = values[i];
        after = values[i + 1];
        break;
      }
    }

    // Linear interpolation
    const totalTime =
      after.timestamp.getTime() - before.timestamp.getTime();
    const targetTime = targetTimestamp.getTime() - before.timestamp.getTime();
    const weight = targetTime / totalTime;

    return (
      before.value + (after.value - before.value) * weight
    );
  }

  /**
   * Detect and flag anomalies in data
   */
  detectAnomalies(
    current: number,
    historical: number[],
    stdDevThreshold: number = 2
  ): { isAnomaly: boolean; reason?: string } {
    if (historical.length === 0) {
      return { isAnomaly: false };
    }

    const mean =
      historical.reduce((a, b) => a + b, 0) / historical.length;
    const variance =
      historical.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      historical.length;
    const stdDev = Math.sqrt(variance);

    const zScore = Math.abs(current - mean) / stdDev;

    if (zScore > stdDevThreshold) {
      const changePercent = ((current - mean) / mean) * 100;
      return {
        isAnomaly: true,
        reason: `Value deviated ${changePercent.toFixed(2)}% from mean (${Math.round(zScore)} sigma)`,
      };
    }

    return { isAnomaly: false };
  }

  /**
   * Classify risk level based on score
   */
  private classifyRisk(score: number): string {
    if (score < 20) return "very-low";
    if (score < 40) return "low";
    if (score < 60) return "medium";
    if (score < 80) return "high";
    return "very-high";
  }

  /**
   * Round to specified decimal places
   */
  private roundDecimals(value: number, decimals: number): number {
    return Math.round(value * 10 ** decimals) / 10 ** decimals;
  }
}
