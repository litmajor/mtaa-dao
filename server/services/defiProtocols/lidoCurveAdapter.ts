/**
 * LIDO Adapter - Liquid Staking Protocol
 * Ethereum, Polygon support
 */

import { ethers } from 'ethers';
import { logger } from '../../utils/logger';

export interface LidoPosition {
  userAddress: string;
  stETHBalance: number;
  stETHBalanceUSD: number;
  underlyingETH: number;
  apy: number;
  accruedRewards: number;
  rewardsUSD: number;
}

class LidoAdapter {
  private stETHAddress = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';
  private provider: ethers.Provider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || 'https://eth.publicnode.com');
  }

  /**
   * Discover Lido positions
   */
  async discoverPositions(userAddress: string, ethPrice: number): Promise<LidoPosition | null> {
    try {
      const stETHABI = ['function balanceOf(address owner) view returns (uint256)'];
      const contract = new ethers.Contract(this.stETHAddress, stETHABI, this.provider);

      const balance = await contract.balanceOf(userAddress);
      const stETHAmount = parseFloat(ethers.formatEther(balance));

      // stETH rebases daily, 1 stETH ≈ 1.005 ETH
      const underlyingETH = stETHAmount * 1.005;
      const stETHBalanceUSD = stETHAmount * ethPrice;

      // Mock APY - in production query from Lido subgraph
      const apy = 3.2;
      const accruedRewards = (stETHAmount * apy) / 100 / 365; // Daily accrual

      return {
        userAddress,
        stETHBalance: stETHAmount,
        stETHBalanceUSD,
        underlyingETH,
        apy,
        accruedRewards,
        rewardsUSD: accruedRewards * ethPrice,
      };
    } catch (error) {
      logger.error(`[LidoAdapter] Error discovering position for ${userAddress}:`, error);
      return null;
    }
  }

  /**
   * Get Lido APY
   */
  async getAPY(): Promise<number> {
    try {
      // In production, query from Lido subgraph or API
      return 3.2;
    } catch {
      return 3.2;
    }
  }
}

export const lidoAdapter = new LidoAdapter();

/**
 * CURVE Adapter - DEX & Stableswap
 */

import { GraphQLClient, gql } from 'graphql-request';

export interface CurvePosition {
  userAddress: string;
  poolAddress: string;
  lpTokenBalance: number;
  lpValueUSD: number;
  underlyingAssets: Array<{
    symbol: string;
    amount: number;
    valueUSD: number;
  }>;
  apy: number;
  feesEarned: number;
  feesEarnedUSD: number;
}

class CurveAdapter {
  private subgraphUrl = 'https://api.thegraph.com/subgraphs/name/convex-community/curve-gauges';
  private client: GraphQLClient;

  constructor() {
    this.client = new GraphQLClient(this.subgraphUrl);
  }

  /**
   * Discover Curve LP positions
   */
  async discoverPositions(userAddress: string): Promise<CurvePosition[]> {
    try {
      const query = gql`
        query {
          lpPositions(where: { user: "${userAddress.toLowerCase()}" }) {
            id
            user {
              id
            }
            pool {
              id
              symbol
              tokens {
                symbol
                decimals
              }
              totalSupply
              reserves {
                reserve
                token {
                  symbol
                }
              }
            }
            lpTokenBalance
            lpTokenBalanceInUSD
            underlyingTokens {
              token {
                symbol
              }
              balance
              balanceInUSD
            }
            claimableRewards
            claimableRewardsInUSD
          }
        }
      `;

      const data: any = await this.client.request(query);
      const positions = data.lpPositions || [];

      return positions.map((pos: any) => ({
        userAddress: pos.user.id,
        poolAddress: pos.pool.id,
        lpTokenBalance: pos.lpTokenBalance,
        lpValueUSD: pos.lpTokenBalanceInUSD,
        underlyingAssets: pos.underlyingTokens.map((t: any) => ({
          symbol: t.token.symbol,
          amount: t.balance,
          valueUSD: t.balanceInUSD,
        })),
        apy: 12.5, // Would fetch from pool gauge data
        feesEarned: pos.claimableRewards,
        feesEarnedUSD: pos.claimableRewardsInUSD,
      }));
    } catch (error) {
      logger.error(`[CurveAdapter] Error discovering positions for ${userAddress}:`, error);
      return [];
    }
  }
}

export const curveAdapter = new CurveAdapter();
