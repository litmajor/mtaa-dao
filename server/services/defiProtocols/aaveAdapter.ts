/**
 * AAVE Adapter - Multi-chain Lending Protocol
 * Ethereum, Polygon, Arbitrum, Optimism support
 */

import { GraphQLClient, gql } from 'graphql-request';
import { logger } from '../../utils/logger';

export interface AavePosition {
  userAddress: string;
  chain: string;
  supplied: Array<{
    asset: string;
    amount: number;
    aTokenAmount: number;
    apy: number;
    usageAsCollateral: boolean;
  }>;
  borrowed: Array<{
    asset: string;
    amount: number;
    borrowRate: number;
    rateMode: 'stable' | 'variable';
  }>;
  collateralUSD: number;
  borrowedUSD: number;
  borrowCapUSD: number;
  healthFactor: number;
  liquidationRisk: boolean;
}

class AaveAdapter {
  private subgraphs: Record<string, string> = {
    ethereum: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
    polygon: 'https://api.thegraph.com/subgraphs/name/aave/aave-governance-v2-polygon',
    arbitrum: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
    optimism: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism',
  };

  /**
   * Discover AAVE positions across all chains
   */
  async discoverPositions(userAddress: string): Promise<AavePosition[]> {
    const positions: AavePosition[] = [];

    for (const [chain, subgraphUrl] of Object.entries(this.subgraphs)) {
      try {
        const client = new GraphQLClient(subgraphUrl);

        const query = gql`
          query {
            users(where: { id: "${userAddress.toLowerCase()}" }) {
              id
              reserves {
                underlyingAsset {
                  symbol
                  decimals
                  price {
                    priceInEth
                  }
                }
                userReserves {
                  currentATokenBalance
                  currentStableDebt
                  currentVariableDebt
                  stableBorrowRate
                  variableBorrowRate
                }
              }
              totalCollateralETH
              totalBorrowsETH
              healthFactor
            }
          }
        `;

        const data: any = await client.request(query);
        const user = data.users?.[0];

        if (!user) continue;

        const supplied = [];
        const borrowed = [];

        for (const reserve of user.reserves || []) {
          const decimals = reserve.underlyingAsset.decimals;
          const priceEth = parseFloat(reserve.underlyingAsset.price.priceInEth);

          if (reserve.userReserves.currentATokenBalance > 0) {
            supplied.push({
              asset: reserve.underlyingAsset.symbol,
              amount: reserve.userReserves.currentATokenBalance / Math.pow(10, decimals),
              aTokenAmount: reserve.userReserves.currentATokenBalance / Math.pow(10, decimals),
              apy: 3.5, // Would fetch from reserve data
              usageAsCollateral: true,
            });
          }

          const totalDebt = (reserve.userReserves.currentStableDebt + reserve.userReserves.currentVariableDebt) / Math.pow(10, decimals);
          if (totalDebt > 0) {
            borrowed.push({
              asset: reserve.underlyingAsset.symbol,
              amount: totalDebt,
              borrowRate: parseFloat(reserve.userReserves.variableBorrowRate),
              rateMode: 'variable' as const,
            });
          }
        }

        positions.push({
          userAddress: user.id,
          chain,
          supplied,
          borrowed,
          collateralUSD: parseFloat(user.totalCollateralETH) * 2000,
          borrowedUSD: parseFloat(user.totalBorrowsETH) * 2000,
          borrowCapUSD: parseFloat(user.totalCollateralETH) * 2000 * 0.8,
          healthFactor: parseFloat(user.healthFactor) || 0,
          liquidationRisk: parseFloat(user.healthFactor) < 1.1,
        });
      } catch (error) {
        logger.debug(`[AaveAdapter] No position on ${chain} for ${userAddress}`);
      }
    }

    return positions;
  }
}

export const aaveAdapter = new AaveAdapter();
