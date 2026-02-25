/**
 * Trade History Integration
 * Unifies bot trades with manual trades in History tab
 */

export interface UnifiedTradeRecord {
  id: string;
  type: 'manual' | 'bot' | 'strategy';
  source?: string; // Bot name or strategy name
  botId?: string;
  strategyId?: string;

  // Trading details
  pair: string;
  side: 'BUY' | 'SELL' | 'CLOSE';
  orderType: 'market' | 'limit' | 'grid' | 'dca';
  
  // Execution
  quantity: number;
  price: number;
  filledQuantity: number;
  filledPrice: number;
  totalValue: number;
  
  // Costs
  fee: number;
  feePercent: number;
  exchange: string;
  
  // Status
  status: 'pending' | 'partial' | 'filled' | 'cancelled';
  createdAt: Date;
  filledAt?: Date;
  
  // Results
  pnl?: number;
  pnlPercent?: number;
  executionTime?: number; // milliseconds
  
  // Metadata
  notes?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Convert bot trade to unified format
 */
export function convertBotTradeToUnified(botId: string, botName: string, botTrade: any): UnifiedTradeRecord {
  return {
    id: botTrade.id,
    type: 'bot',
    source: botName,
    botId,
    
    pair: botTrade.pair,
    side: botTrade.side,
    orderType: botTrade.type,
    
    quantity: botTrade.quantity,
    price: botTrade.price,
    filledQuantity: botTrade.filledQuantity,
    filledPrice: botTrade.filledPrice,
    totalValue: botTrade.filledQuantity * botTrade.filledPrice,
    
    fee: botTrade.fee,
    feePercent: (botTrade.fee / (botTrade.filledQuantity * botTrade.filledPrice)) * 100,
    exchange: botTrade.exchange,
    
    status: botTrade.status,
    createdAt: new Date(botTrade.timestamp),
    filledAt: botTrade.filledAt ? new Date(botTrade.filledAt) : undefined,
    
    pnl: botTrade.pnl,
    pnlPercent: botTrade.pnlPercent,
    executionTime: botTrade.executionTime,
    
    tags: ['automated', 'bot'],
    metadata: {
      rsi: botTrade.metadata?.rsi,
      macd: botTrade.metadata?.macd,
      reason: botTrade.metadata?.reason
    }
  };
}

/**
 * Get all trades for History tab (unified view)
 */
export async function getUnifiedTradeHistory(
  userId: string,
  options?: {
    status?: string[];
    types?: ('manual' | 'bot' | 'strategy')[];
    timeRange?: { from: Date; to: Date };
    pair?: string;
    exchange?: string;
    limit?: number;
  }
) {
  try {
    const limit = options?.limit || 100;
    
    // Fetch manual trades
    // const manualTrades = await prisma.trade.findMany({
    //   where: {
    //     userId,
    //     status: options?.status ? { in: options.status } : undefined,
    //     createdAt: options?.timeRange
    //       ? { gte: options.timeRange.from, lte: options.timeRange.to }
    //       : undefined,
    //     pair: options?.pair,
    //     exchange: options?.exchange
    //   },
    //   orderBy: { createdAt: 'desc' },
    //   take: limit
    // });

    // Fetch bot trades
    // const bots = await prisma.bot.findMany({
    //   where: { userId },
    //   include: {
    //     trades: {
    //       where: {
    //         status: options?.status ? { in: options.status } : undefined,
    //         timestamp: options?.timeRange
    //           ? { gte: options.timeRange.from, lte: options.timeRange.to }
    //           : undefined,
    //         pair: options?.pair,
    //         exchange: options?.exchange
    //       },
    //       orderBy: { timestamp: 'desc' },
    //       take: limit
    //     }
    //   }
    // });

    // const botTrades = bots.flatMap(bot =>
    //   bot.trades.map(trade => convertBotTradeToUnified(bot.id, bot.name, trade))
    // );

    // Combine and sort
    // const allTrades = [...manualTrades, ...botTrades].sort(
    //   (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    // );

    // return allTrades.slice(0, limit);

    return [];
  } catch (error) {
    throw new Error(`Failed to get trade history: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get summary statistics for all trades
 */
export async function getTradeHistorySummary(userId: string) {
  try {
    // const [manualTrades, botTrades] = await Promise.all([
    //   prisma.trade.findMany({ where: { userId } }),
    //   prisma.botTrade.findMany({
    //     where: { bot: { userId } }
    //   })
    // ]);

    // const allTrades = [...manualTrades, ...botTrades];

    const totalTrades = 0;
    const filledTrades = 0;
    const cancelledTrades = 0;
    const totalProfit = 0;
    const totalFees = 0;
    const avgWinSize = 0;
    const avgLossSize = 0;
    const winRate = 0;

    return {
      totalTrades,
      filledTrades,
      cancelledTrades,
      totalProfit,
      totalFees,
      avgWinSize,
      avgLossSize,
      winRate,
      manualVsBot: {
        manual: 0,
        bot: 0,
        strategy: 0
      },
      topExchanges: [] as any[],
      topPairs: [] as any[]
    };
  } catch (error) {
    throw new Error(`Failed to get summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Filter trades for display in History tab
 */
export function filterTrades(
  trades: UnifiedTradeRecord[],
  filters: {
    status?: string;
    type?: string;
    exchange?: string;
    pair?: string;
    minPnl?: number;
    maxPnl?: number;
  }
): UnifiedTradeRecord[] {
  return trades.filter(trade => {
    if (filters.status && trade.status !== filters.status) return false;
    if (filters.type && trade.type !== filters.type) return false;
    if (filters.exchange && trade.exchange !== filters.exchange) return false;
    if (filters.pair && trade.pair !== filters.pair) return false;
    
    if (filters.minPnl !== undefined && trade.pnl !== undefined && trade.pnl < filters.minPnl) {
      return false;
    }
    if (filters.maxPnl !== undefined && trade.pnl !== undefined && trade.pnl > filters.maxPnl) {
      return false;
    }
    
    return true;
  });
}
