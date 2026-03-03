/**
 * MOOLA (cTok) Adapter - Celo's Money Market Protocol
 * Discovers lending/borrowing positions on Moola Protocol
 */

import { GraphQLClient, gql } from 'graphql-request';
import { logger } from '../../utils/logger';

export interface MoolaPosition {
  userAddress: string;
  supplied: Array<{
    asset: string;
    amount: number;
    cTokenBalance: number;
    apy: number;
  }>;
  borrowed: Array<{
    asset: string;
    amount: number;
    apy: number;
    collateralFactor: number;
  }>;
  totalCollateralUSD: number;
  totalBorrowedUSD: number;
  borrowLimit: number;
  healthFactor: number;
  liquidationRisk: boolean;
}

class MoolaAdapter {
  private subgraphUrl = 'https://api.studio.thegraph.com/query/48211/moola/v0.0.1';
  private client: GraphQLClient;

  constructor() {
    this.client = new GraphQLClient(this.subgraphUrl);
  }

  /**
   * Discover user positions on Moola
   */
  async discoverPositions(userAddress: string): Promise<MoolaPosition | null> {
    try {
      const query = gql`
        query {
          users(where: { id: "${userAddress.toLowerCase()}" }) {
            id
            supplies {
              reserve {
                symbol
                decimals
                price
              }
              currentATokenBalance
              totalDeposits
            }
            borrows {
              reserve {
                symbol
                decimals
                price
                borrowRate
              }
              currentVariableDebt
              currentStableDebt
            }
            totalCollateralETH
            totalBorrowsETH
            totalFeesETH
            borrowRateMode
            healthFactor
          }
        }
      `;

      const data: any = await this.client.request(query);
      const user = data.users?.[0];

      if (!user) return null;

      const supplied = user.supplies.map((s: any) => ({
        asset: s.reserve.symbol,
        amount: s.totalDeposits / Math.pow(10, s.reserve.decimals),
        cTokenBalance: s.currentATokenBalance / Math.pow(10, s.reserve.decimals),
        apy: 3.5, // Would fetch from reserve data
      }));

      const borrowed = user.borrows.map((b: any) => ({
        asset: b.reserve.symbol,
        amount: (b.currentVariableDebt + b.currentStableDebt) / Math.pow(10, b.reserve.decimals),
        apy: parseFloat(b.reserve.borrowRate),
        collateralFactor: 0.75, // Fetch from reserve
      }));

      return {
        userAddress: user.id,
        supplied,
        borrowed,
        totalCollateralUSD: user.totalCollateralETH * 2000, // Rough conversion
        totalBorrowedUSD: user.totalBorrowsETH * 2000,
        borrowLimit: user.totalCollateralETH * 2000 * 0.75,
        healthFactor: parseFloat(user.healthFactor) || 0,
        liquidationRisk: parseFloat(user.healthFactor) < 1.2,
      };
    } catch (error) {
      logger.error(`[MoolaAdapter] Error discovering positions for ${userAddress}:`, error);
      return null;
    }
  }

  /**
   * Get Moola market data (APY, TVL, etc)
   */
  async getMarketData() {
    try {
      const query = gql`
        query {
          reserves {
            symbol
            totalLiquidity
            availableLiquidity
            borrowRate
            supplyRate
            utilizationRate
            collateralFactor
          }
        }
      `;

      const data = await this.client.request(query);
      return data.reserves;
    } catch (error) {
      logger.error('[MoolaAdapter] Error fetching market data:', error);
      return [];
    }
  }
}

export const moolaAdapter = new MoolaAdapter();
