import { Logger } from '../utils/logger';
import { productionDexRouting, type SwapOrder, type RoutingResult } from './dexRoutingExecution.production';

const logger = Logger.getLogger();

const TREASURY_ALLOWED_VENUES: Array<'mento' | 'ubeswap'> = ['mento', 'ubeswap'];

const MAX_TREASURY_SWAP_USD = Number(process.env.TREASURY_MAX_SWAP_USD) || 25_000;
const MAX_TREASURY_SLIPPAGE_PERCENT = Number(process.env.TREASURY_MAX_SLIPPAGE_PERCENT) || 1.0;

export class TreasuryDexRoutingError extends Error {}

function assertWithinCap(order: SwapOrder): void {
  if (!Number.isFinite(order.amountUsd) || order.amountUsd <= 0) {
    throw new TreasuryDexRoutingError(`Invalid treasury swap amount: ${order.amountUsd}`);
  }

  if (order.amountUsd > MAX_TREASURY_SWAP_USD) {
    throw new TreasuryDexRoutingError(
      `Treasury swap of $${order.amountUsd.toLocaleString()} exceeds hard cap of ` +
        `$${MAX_TREASURY_SWAP_USD.toLocaleString()}. Split into multiple approved swaps, ` +
        `or raise TREASURY_MAX_SWAP_USD deliberately (not as a one-off workaround).`
    );
  }
}

function clampSlippage(order: SwapOrder): SwapOrder {
  if (order.maxSlippagePercent > MAX_TREASURY_SLIPPAGE_PERCENT) {
    logger.warn(
      `[TreasuryDex] Requested slippage ${order.maxSlippagePercent}% exceeds treasury cap ` +
        `${MAX_TREASURY_SLIPPAGE_PERCENT}% for ${order.asset} — clamping to cap.`
    );
    return { ...order, maxSlippagePercent: MAX_TREASURY_SLIPPAGE_PERCENT };
  }
  return order;
}

export async function routeTreasuryOrder(order: SwapOrder): Promise<RoutingResult> {
  assertWithinCap(order);
  const safeOrder = clampSlippage(order);

  logger.info(
    `[TreasuryDex] Routing treasury order: ${safeOrder.asset} ${safeOrder.action} ` +
      `($${safeOrder.amountUsd.toLocaleString()}, venues=${TREASURY_ALLOWED_VENUES.join('/')})`
  );

  const route = await productionDexRouting.routeOrderOnCelo(safeOrder, {
    allowedVenues: TREASURY_ALLOWED_VENUES,
  });

  logger.info(
    `[TreasuryDex] Treasury route selected: ${route.venue} @ ${route.expectedPrice.toFixed(6)} ` +
      `(expected slippage ${route.expectedSlippage.toFixed(3)}%)`
  );

  return route;
}

export async function executeTreasurySwap(
  order: SwapOrder,
  recipientAddress: string
): Promise<{ txHash: string; slippageActual: number; gasCostActual: number }> {
  const route = await routeTreasuryOrder(order);

  assertWithinCap(order);

  logger.info(
    `[TreasuryDex] Executing treasury swap via ${route.venue}: ${order.asset} ${order.action} ` +
      `($${order.amountUsd.toLocaleString()}) -> ${recipientAddress}`
  );

  return productionDexRouting.executeSwap(order, route, 'celo', recipientAddress);
}
