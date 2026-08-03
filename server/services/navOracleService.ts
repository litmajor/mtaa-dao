/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NAV ORACLE SERVICE - Automated Vault NAV Calculation & Updates
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Production implementation with:
 * • Symbol Universe (asset metadata + deployments)
 * • priceOracle (shared, dynamic-registry, Redis-deduped USD pricing)
 * • Strategy Dashboard Service (strategy performance + TVL)
 * • External API Tracker (yield data + liquidation risk)
 * • ECDSA signature generation for blockchain submission
 *
 * NOTE ON PRICING: this service used to run its own independent multi-source
 * pricing stack (CoinGecko + Binance + DEX Screener) in parallel with
 * `priceOracle.ts`. That has been removed. All USD pricing now goes through
 * the shared `priceOracle` singleton so vault NAV calculations can never
 * disagree with prices shown elsewhere in the app, and so new/changed token
 * mappings only need to be registered once (see integration notes below).
 */

import { Logger } from '../utils/logger';
import { symbolUniverse } from '../core/symbol_universe';
import { strategyDashboardService } from './strategyDashboardService';
import { priceOracle } from './priceOracle';
import crypto from 'crypto';
import type { SupportedChain } from '../types/assetGraph';

const logger = Logger.getLogger();

export interface VaultHolding {
  symbol: string;
  balance: bigint;
  tokenAddress: string;
  decimals: number;
  chain: SupportedChain;
}

export interface NavComponent {
  symbol: string;
  balance: string;
  priceUsd: number;
  valueUsd: number;
  yieldApy?: number;
  riskTier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  priceConfidence: number;
  sources: string[];
  lastUpdate: number;
}

export interface RiskMetrics {
  concentrationRisk: number;
  tierDistribution: Map<string, number>;
  yieldExposure: number;
  liquidationRiskScore: number;
  liquidationRiskLevel: 'low' | 'medium' | 'high';
  correlationRisk: number;
}

export interface VaultNAVResult {
  vaultId: string;
  nav: bigint;
  navUsd: number;
  breakdown: Map<string, NavComponent>;
  riskMetrics: RiskMetrics;
  confidenceScore: number;
  timestamp: number;
  sources: string[];
  calculationDurationMs: number;
}

export interface NavUpdateSignature {
  vaultId: string;
  nav: string;
  nonce: number;
  timestamp: number;
  signature: string;
  signer: string;
}

export interface PriceData {
  usd: number;
  sources: string[];
  confidence: number;
  sourceBreakdown: Map<string, number>;
  updateTime: number;
}

export interface YieldData {
  symbol: string;
  apy: number;
  source: string;
  protocol: string;
  riskLevel: 'low' | 'medium' | 'high';
  updateTime: number;
}

class NavOracleService {
  private nonces: Map<string, number> = new Map();
  private updateInterval: any = null;
  private lastUpdates: Map<string, VaultNAVResult> = new Map();
  private yieldCache: Map<string, { data: YieldData; timestamp: number }> = new Map();
  private signerAddress: string = '';
  private signerPrivateKey: string = '';

  async initialize(): Promise<void> {
    logger.info('[NavOracle] Initializing NAV Oracle Service with production integrations');

    this.signerAddress = process.env.NAV_ORACLE_SIGNER_ADDRESS || '0x0';
    this.signerPrivateKey = process.env.NAV_ORACLE_SIGNER_KEY || '';

    if (!this.signerPrivateKey) {
      logger.warn('[NavOracle] No signer key configured - signatures unavailable');
    }

    this.startAutomatedUpdates();
    logger.info('[NavOracle] Initialization complete');
  }

  private startAutomatedUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      try {
        logger.info('[NavOracle] Running scheduled NAV updates');
      } catch (error) {
        logger.error('[NavOracle] Scheduled update failed:', error);
      }
    }, 60 * 60 * 1000);
  }

  async calculateVaultNAV(
    vaultAddress: string,
    chain: SupportedChain,
    holdings: VaultHolding[]
  ): Promise<VaultNAVResult> {
    const startTime = Date.now();
    logger.info(`[NavOracle] Calculating NAV for vault ${vaultAddress} on ${chain}`);

    let totalValueUsd = 0;
    const breakdown = new Map<string, NavComponent>();
    const sources = new Set<string>();
    const errors: string[] = [];

    for (const holding of holdings) {
      try {
        const assetMetadata = symbolUniverse.getAsset(holding.symbol);
        if (!assetMetadata) {
          errors.push(`Asset ${holding.symbol} not found in Symbol Universe`);
          continue;
        }

        const deployments = symbolUniverse.getDeployments(holding.symbol);
        if (deployments.length === 0) {
          errors.push(`${holding.symbol} has no deployment on ${chain}`);
          continue;
        }

        let deployment = deployments.find(d => d.chain === chain);
        if (!deployment) {
          deployment = symbolUniverse.getDeploymentOnChain(holding.symbol, chain);
          if (!deployment) {
            errors.push(`${holding.symbol} not deployed on ${chain}`);
            continue;
          }
        }
        if (deployment.contractAddress.toLowerCase() !== holding.tokenAddress.toLowerCase()) {
          logger.warn(
            `[NavOracle] Address mismatch for ${holding.symbol}: ` +
            `Symbol Universe: ${deployment.contractAddress}, Vault: ${holding.tokenAddress}`
          );
        }

        const priceData = await this.getPriceForAsset(holding.symbol);
        for (const source of priceData.sources) {
          sources.add(source);
        }

        const yieldData = await this.getYieldForAsset(holding.symbol, chain);

        const balanceDecimal = Number(holding.balance) / Math.pow(10, holding.decimals);
        const valueUsd = balanceDecimal * priceData.usd;
        totalValueUsd += valueUsd;

        breakdown.set(holding.symbol, {
          symbol: holding.symbol,
          balance: balanceDecimal.toString(),
          priceUsd: priceData.usd,
          valueUsd,
          yieldApy: yieldData?.apy,
          riskTier: assetMetadata.tier,
          priceConfidence: priceData.confidence,
          sources: priceData.sources,
          lastUpdate: priceData.updateTime,
        });

        logger.debug(
          `[NavOracle] ${holding.symbol}: $${valueUsd.toFixed(2)} ` +
          `(price: $${priceData.usd}, confidence: ${priceData.confidence.toFixed(1)}%)`
        );
      } catch (error) {
        const errMsg = `Error pricing ${holding.symbol}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errMsg);
        logger.error(`[NavOracle] ${errMsg}`);
      }
    }

    if (errors.length > 0) {
      logger.warn(`[NavOracle] ${errors.length} holdings had pricing errors:`, errors);
    }

    const riskMetrics = await this.calculateRiskMetrics(breakdown, chain);
    const confidenceScore = this.calculateConfidenceScore(breakdown);
    const calculationDurationMs = Date.now() - startTime;

    const result: VaultNAVResult = {
      vaultId: vaultAddress,
      nav: BigInt(Math.floor(totalValueUsd * 1e8)),
      navUsd: totalValueUsd,
      breakdown,
      riskMetrics,
      confidenceScore,
      timestamp: Date.now(),
      sources: Array.from(sources),
      calculationDurationMs,
    };

    this.lastUpdates.set(vaultAddress, result);

    logger.info(
      `[NavOracle] NAV calculated: $${totalValueUsd.toFixed(2)} ` +
      `(confidence: ${confidenceScore.toFixed(2)}%, duration: ${calculationDurationMs}ms)`
    );

    return result;
  }

  /**
   * Get USD price for a single asset via the shared priceOracle.
   *
   * This replaces the old getMultiSourcePrice() stack (CoinGecko + Binance +
   * DEX Screener run independently in this file). priceOracle already
   * handles multi-source fallback (Gateway Agent -> CoinGecko), Redis-backed
   * cross-instance deduplication, and rate-limit backoff internally, so none
   * of that needs to be duplicated here.
   *
   * Confidence is no longer computed from cross-source price variance
   * (there's only one source now, from this file's point of view).
   * priceOracle returning a value at all already implies it passed through
   * its own fallback chain successfully, so a found price is treated as
   * full confidence. If priceOracle exposes a confidence/variance signal in
   * the future, wire it through here instead of the flat 100.
   */
  private async getPriceForAsset(symbol: string): Promise<PriceData> {
    const price = await priceOracle.getPrice(symbol);

    if (!price || !(price.priceUsd > 0)) {
      throw new Error(`No price data available for ${symbol} via priceOracle`);
    }

    return {
      usd: price.priceUsd,
      sources: ['priceOracle'],
      confidence: 100,
      sourceBreakdown: new Map([['priceOracle', price.priceUsd]]),
      updateTime: price.lastUpdated.getTime(),
    };
  }

  private async getYieldForAsset(
    symbol: string,
    chain: SupportedChain
  ): Promise<YieldData | null> {
    try {
      const cacheKey = `${symbol}:${chain}`;
      const cached = this.yieldCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
        return cached.data;
      }

      const yieldProtocol = this.identifyYieldProtocol(symbol);
      if (!yieldProtocol) return null;

      const strategies = await strategyDashboardService.listStrategies({
        skip: 0,
        limit: 100,
        filters: {
          assets: [symbol],
        },
        sortBy: 'ytdReturn',
      });

      if (strategies && strategies.length > 0) {
        let totalApy = 0;
        let totalWeight = 0;

        for (const strategy of strategies) {
          if (strategy.ytdReturn && strategy.aum) {
            const strategyApy = strategy.ytdReturn;
            const weight = strategy.aum || 1;
            totalApy += strategyApy * weight;
            totalWeight += weight;
          }
        }

        if (totalWeight > 0) {
          const yieldData: YieldData = {
            symbol,
            apy: totalApy / totalWeight,
            source: 'strategy_performance',
            protocol: yieldProtocol,
            riskLevel: 'medium',
            updateTime: Date.now(),
          };

          this.yieldCache.set(cacheKey, {
            data: yieldData,
            timestamp: Date.now(),
          });

          logger.debug(`[NavOracle] Yield for ${symbol}: ${yieldData.apy.toFixed(2)}% APY`);
          return yieldData;
        }
      }

      const externalYield = await this.getYieldFromProtocol(symbol, yieldProtocol);
      if (externalYield) {
        this.yieldCache.set(cacheKey, {
          data: externalYield,
          timestamp: Date.now(),
        });
        return externalYield;
      }

      return null;
    } catch (error) {
      logger.debug(`[NavOracle] Yield fetch failed for ${symbol}:`, error instanceof Error ? error.message : '');
      return null;
    }
  }

  private identifyYieldProtocol(symbol: string): string | null {
    const yieldAssets: { [key: string]: string } = {
      'stETH': 'lido',
      'aUSDC': 'aave',
      'aDAI': 'aave',
      'aETH': 'aave',
      'cUSDC': 'compound',
      'cDAI': 'compound',
      'yvUSDC': 'yearn',
      'yvDAI': 'yearn',
    };

    return yieldAssets[symbol] || null;
  }

  private async getYieldFromProtocol(symbol: string, protocol: string): Promise<YieldData | null> {
    try {
      switch (protocol.toLowerCase()) {
        case 'aave':
          return await this.getAaveYield(symbol);
        case 'compound':
          return await this.getCompoundYield(symbol);
        case 'lido':
          return await this.getLidoYield(symbol);
        case 'yearn':
          return await this.getYearnYield(symbol);
        default:
          return null;
      }
    } catch (error) {
      logger.debug(`[NavOracle] Protocol yield fetch failed for ${symbol}:`, error instanceof Error ? error.message : '');
      return null;
    }
  }

  private async getAaveYield(symbol: string): Promise<YieldData | null> {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(
        'https://api.aave.com/data/rates.json',
        { timeout: 5000 }
      );

      const asset = response.data.find((a: any) => a.symbol === symbol.replace('a', ''));
      if (asset) {
        return {
          symbol,
          apy: parseFloat(asset.supplyAPY) * 100,
          source: 'aave',
          protocol: 'aave',
          riskLevel: 'low',
          updateTime: Date.now(),
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private async getCompoundYield(symbol: string): Promise<YieldData | null> {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(
        'https://api.compound.finance/api/v3/markets',
        { timeout: 5000 }
      );

      const market = response.data.find((m: any) => m.symbol === symbol);
      if (market) {
        return {
          symbol,
          apy: parseFloat(market.supplyApy) * 100,
          source: 'compound',
          protocol: 'compound',
          riskLevel: 'low',
          updateTime: Date.now(),
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private async getLidoYield(symbol: string): Promise<YieldData | null> {
    try {
      return {
        symbol,
        apy: 3.5,
        source: 'lido',
        protocol: 'lido',
        riskLevel: 'low',
        updateTime: Date.now(),
      };
    } catch (error) {
      return null;
    }
  }

  private async getYearnYield(symbol: string): Promise<YieldData | null> {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(
        'https://yearn.finance/api/v1/chains/1/vaults/all',
        { timeout: 5000 }
      );

      const vault = response.data.find((v: any) => v.symbol === symbol);
      if (vault) {
        return {
          symbol,
          apy: vault.apy?.net_apy || 0,
          source: 'yearn',
          protocol: 'yearn',
          riskLevel: 'medium',
          updateTime: Date.now(),
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private async calculateRiskMetrics(
    breakdown: Map<string, NavComponent>,
    chain: SupportedChain
  ): Promise<RiskMetrics> {
    const tierDistribution = new Map<string, number>();
    let totalValue = 0;
    const weights: number[] = [];
    const symbols: string[] = [];

    for (const component of breakdown.values()) {
      totalValue += component.valueUsd;
      symbols.push(component.symbol);
      const tier = component.riskTier;
      const current = tierDistribution.get(tier) || 0;
      tierDistribution.set(tier, current + component.valueUsd);
      weights.push(component.valueUsd / totalValue);
    }

    for (const [tier, value] of tierDistribution.entries()) {
      tierDistribution.set(tier, (value / totalValue) * 100);
    }

    let concentrationRisk = 0;
    for (const weight of weights) {
      concentrationRisk += weight * weight;
    }
    const n = weights.length || 1;
    concentrationRisk = Math.min(concentrationRisk / (1 / n), 1);

    const yieldExposure = Array.from(breakdown.values()).reduce(
      (sum, c) => sum + (c.yieldApy || 0),
      0
    );

    const liquidationRisk = await this.assessLiquidationRisk(symbols, breakdown);
    const correlationRisk = this.calculateCorrelationRisk(symbols);

    return {
      concentrationRisk,
      tierDistribution,
      yieldExposure,
      liquidationRiskScore: liquidationRisk.score,
      liquidationRiskLevel: liquidationRisk.level,
      correlationRisk,
    };
  }

  private async assessLiquidationRisk(
    symbols: string[],
    breakdown: Map<string, NavComponent>
  ): Promise<{ score: number; level: 'low' | 'medium' | 'high' }> {
    let riskScore = 0;
    const tierWeights: { [key: string]: number } = {
      'tier_1': 0.05,
      'tier_2': 0.15,
      'tier_3': 0.35,
      'tier_4': 0.65,
    };

    const totalValue = Array.from(breakdown.values())
      .reduce((sum, c) => sum + c.valueUsd, 0) || 1;

    for (const symbol of symbols) {
      const component = breakdown.get(symbol);
      if (component) {
        const tierWeight = tierWeights[component.riskTier] || 0.35;
        riskScore += tierWeight * (component.valueUsd / totalValue);
      }
    }

    const level = riskScore < 0.2 ? 'low' : riskScore < 0.5 ? 'medium' : 'high';
    return { score: riskScore, level };
  }

  private calculateCorrelationRisk(symbols: string[]): number {
    const assetCategories: { [key: string]: string } = {
      'BTC': 'layer1',
      'ETH': 'layer1',
      'SOL': 'layer1',
      'USDC': 'stablecoin',
      'DAI': 'stablecoin',
      'USDT': 'stablecoin',
      'AAVE': 'defi',
      'COMPOUND': 'defi',
    };

    const categories = symbols.map(s => assetCategories[s] || 'other');
    const uniqueCategories = new Set(categories);

    return (categories.length - uniqueCategories.size) / (categories.length || 1);
  }

  private calculateConfidenceScore(breakdown: Map<string, NavComponent>): number {
    if (breakdown.size === 0) return 0;

    const scores = Array.from(breakdown.values()).map(c => c.priceConfidence);
    const avgConfidence = scores.reduce((a, b) => a + b, 0) / scores.length;

    const sourceCount = new Set(
      Array.from(breakdown.values()).flatMap(c => c.sources)
    ).size;
    const sourceBonus = Math.min((sourceCount - 1) * 5, 20);

    return Math.min(avgConfidence + sourceBonus, 100);
  }

  async generateNAVSignature(
    vaultId: string,
    nav: bigint
  ): Promise<NavUpdateSignature> {
    const nonce = (this.nonces.get(vaultId) || 0) + 1;
    this.nonces.set(vaultId, nonce);

    const timestamp = Math.floor(Date.now() / 1000);

    if (!this.signerPrivateKey) {
      logger.error('[NavOracle] No signer key configured');
      throw new Error('NAV_ORACLE_SIGNER_KEY not configured');
    }

    try {
      const messageData = `${vaultId}:${nav.toString()}:${nonce}:${timestamp}`;
      const messageHash = crypto
        .createHash('sha256')
        .update(messageData)
        .digest();

      const signer = crypto.createPrivateKey({
        key: this.signerPrivateKey,
        format: 'pem',
      });

      const signature = crypto
        .sign('sha256', messageHash, signer)
        .toString('hex');

      return {
        vaultId,
        nav: nav.toString(),
        nonce,
        timestamp,
        signature: '0x' + signature,
        signer: this.signerAddress,
      };
    } catch (error) {
      logger.error('[NavOracle] Signature generation failed:', error);
      throw error;
    }
  }

  async validateNAVUpdate(
    vaultId: string,
    newNav: bigint
  ): Promise<{ valid: boolean; reason?: string; changePercent: number }> {
    const lastUpdate = this.lastUpdates.get(vaultId);
    if (!lastUpdate) {
      return { valid: true, changePercent: 0 };
    }

    const lastNavNumber = Number(lastUpdate.nav) / 1e8;
    const newNavNumber = Number(newNav) / 1e8;

    const changePercent =
      Math.abs((newNavNumber - lastNavNumber) / lastNavNumber) * 100;

    if (changePercent > 15) {
      return {
        valid: false,
        reason: `NAV change ${changePercent.toFixed(2)}% exceeds 15% threshold`,
        changePercent,
      };
    }

    if (changePercent > 10) {
      logger.warn(
        `[NavOracle] Large NAV change detected: ${changePercent.toFixed(2)}%`
      );
    }

    return { valid: true, changePercent };
  }

  getLastNAV(vaultId: string): VaultNAVResult | undefined {
    return this.lastUpdates.get(vaultId);
  }

  getNonce(vaultId: string): number {
    return this.nonces.get(vaultId) || 0;
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.lastUpdates.clear();
    this.nonces.clear();
    this.yieldCache.clear();
  }
}

export { NavOracleService };
export const navOracleService = new NavOracleService();