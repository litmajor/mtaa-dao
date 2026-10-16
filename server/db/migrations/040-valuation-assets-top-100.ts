import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('valuation-assets-top-100-migration');
const seedNote =
  'CoinGecko top-100 market-cap snapshot (2026-10-15); explicitly approved valuation candidate';

export async function migrateTop100ValuationAssets(): Promise<void> {
  logger.info('Applying top-100 valuation asset seed');
  try {
    await pool.query(
      `
        INSERT INTO public.valuation_assets
          (symbol, coingecko_id, asset_class, max_deviation_pct, haircut_pct, is_active, notes)
        SELECT
          assets.symbol,
          assets.coingecko_id,
          CASE
            WHEN assets.symbol IN (
              'USDT', 'USDC', 'USDS', 'USDE', 'DAI', 'USD1', 'USDG', 'PYUSD',
              'RLUSD', 'USDD', 'USDGO', 'U', 'OUSD', 'GHO'
            ) THEN 'stable'
            WHEN assets.market_cap_rank <= 20 THEN 'major'
            WHEN assets.market_cap_rank <= 50 THEN 'mid'
            ELSE 'alt'
          END,
          CASE
            WHEN assets.symbol IN (
              'USDT', 'USDC', 'USDS', 'USDE', 'DAI', 'USD1', 'USDG', 'PYUSD',
              'RLUSD', 'USDD', 'USDGO', 'U', 'OUSD', 'GHO'
            ) THEN 1.0
            WHEN assets.market_cap_rank <= 20 THEN 1.5
            WHEN assets.market_cap_rank <= 50 THEN 2.5
            ELSE 4.0
          END,
          CASE
            WHEN assets.symbol IN (
              'USDT', 'USDC', 'USDS', 'USDE', 'DAI', 'USD1', 'USDG', 'PYUSD',
              'RLUSD', 'USDD', 'USDGO', 'U', 'OUSD', 'GHO'
            ) THEN 2.0
            WHEN assets.market_cap_rank <= 20 THEN 3.0
            WHEN assets.market_cap_rank <= 50 THEN 5.0
            ELSE 10.0
          END,
          true,
          $1
        FROM (VALUES
          (1, 'BTC', 'bitcoin'),
          (2, 'ETH', 'ethereum'),
          (3, 'USDT', 'tether'),
          (4, 'BNB', 'binancecoin'),
          (5, 'XRP', 'ripple'),
          (6, 'USDC', 'usd-coin'),
          (7, 'SOL', 'solana'),
          (8, 'TRX', 'tron'),
          (9, 'FIGR_HELOC', 'figure-heloc'),
          (10, 'ZEC', 'zcash'),
          (11, 'HYPE', 'hyperliquid'),
          (12, 'DOGE', 'dogecoin'),
          (13, 'USDS', 'usds'),
          (14, 'XMR', 'monero'),
          (15, 'WBT', 'whitebit'),
          (16, 'LINK', 'chainlink'),
          (17, 'ADA', 'cardano'),
          (18, 'LEO', 'leo-token'),
          (19, 'NEAR', 'near'),
          (20, 'XLM', 'stellar'),
          (21, 'RAIN', 'rain'),
          (22, 'BCH', 'bitcoin-cash'),
          (23, 'USDE', 'ethena-usde'),
          (24, 'LTC', 'litecoin'),
          (25, 'UNI', 'uniswap'),
          (26, 'DAI', 'dai'),
          (27, 'AVAX', 'avalanche-2'),
          (28, 'CC', 'canton-network'),
          (29, 'SUI', 'sui'),
          (30, 'USD1', 'usd1-wlfi'),
          (31, 'GRAM', 'the-open-network'),
          (32, 'HBAR', 'hedera-hashgraph'),
          (33, 'XAUT', 'tether-gold'),
          (34, 'TAO', 'bittensor'),
          (35, 'QNT', 'quant-network'),
          (36, 'USDG', 'global-dollar'),
          (37, 'SHIB', 'shiba-inu'),
          (38, 'CRO', 'crypto-com-chain'),
          (39, 'BTW', 'bitway'),
          (40, 'PYUSD', 'paypal-usd'),
          (41, 'ENA', 'ethena'),
          (42, 'OKB', 'okb'),
          (43, 'AAVE', 'aave'),
          (44, 'RLUSD', 'ripple-usd'),
          (45, 'USYC', 'hashnote-usyc'),
          (46, 'USDY', 'ondo-us-dollar-yield'),
          (47, 'ONDO', 'ondo-finance'),
          (48, 'BUIDL', 'blackrock-usd-institutional-digital-liquidity-fund'),
          (49, 'PUMP', 'pump-fun'),
          (50, 'ASTER', 'aster-2'),
          (51, 'WLD', 'worldcoin-wld'),
          (52, 'DOT', 'polkadot'),
          (53, 'M', 'memecore'),
          (54, 'USDF', 'falcon-finance'),
          (55, 'WLFI', 'world-liberty-financial'),
          (56, 'PAXG', 'pax-gold'),
          (57, 'USDD', 'usdd'),
          (58, 'PEPE', 'pepe'),
          (59, 'MNT', 'mantle'),
          (60, 'ICP', 'internet-computer'),
          (61, 'MORPHO', 'morpho'),
          (62, 'EURSAFO', 'spiko-amundi-overnight-swap-fund-eur'),
          (63, 'SKY', 'sky'),
          (64, 'U', 'united-stables'),
          (65, 'HTX', 'htx-dao'),
          (66, 'BGB', 'bitget-token'),
          (67, 'BFUSD', 'bfusd'),
          (68, 'ARB', 'arbitrum'),
          (69, 'ETC', 'ethereum-classic'),
          (70, 'USDGO', 'usdgo'),
          (71, 'VVV', 'venice-token'),
          (72, 'JST', 'just'),
          (73, 'GT', 'gatechain-token'),
          (74, 'ALGO', 'algorand'),
          (75, 'RENDER', 'render-token'),
          (76, 'JUP', 'jupiter-exchange-solana'),
          (77, 'KCS', 'kucoin-shares'),
          (78, 'POL', 'polygon-ecosystem-token'),
          (79, 'KAS', 'kaspa'),
          (80, 'BCAP', 'blockchain-capital'),
          (81, 'ATOM', 'cosmos'),
          (82, 'FIL', 'filecoin'),
          (83, 'PI', 'pi-network'),
          (84, 'AERO', 'aerodrome-finance'),
          (85, 'ZRO', 'layerzero'),
          (86, 'NEXO', 'nexo'),
          (87, 'INJ', 'injective-protocol'),
          (88, 'OUSD', 'open-usd'),
          (89, 'USTB', 'superstate-short-duration-us-government-securities-fund-ustb'),
          (90, 'AKE', 'akedo'),
          (91, 'LIT', 'lighter'),
          (92, 'STX', 'blockstack'),
          (93, 'PYTH', 'pyth-network'),
          (94, 'STABLE', 'stable-2'),
          (95, 'APT', 'aptos'),
          (96, 'NIGHT', 'midnight-3'),
          (97, 'CAKE', 'pancakeswap-token'),
          (98, 'GHO', 'gho'),
          (99, 'STRK', 'starknet'),
          (100, 'XDC', 'xdce-crowd-sale')
        ) AS assets(market_cap_rank, symbol, coingecko_id)
        ON CONFLICT (symbol) DO NOTHING;
      `,
      [seedNote]
    );
    logger.info('Top-100 valuation asset seed applied');
  } catch (error) {
    logger.error('Failed to apply top-100 valuation asset seed', error);
    throw error;
  }
}

export async function rollbackTop100ValuationAssets(): Promise<void> {
  logger.info('Rolling back top-100 valuation asset seed');
  try {
    await pool.query('DELETE FROM public.valuation_assets WHERE notes = $1', [seedNote]);
    logger.info('Top-100 valuation asset seed rolled back');
  } catch (error) {
    logger.error('Failed to roll back top-100 valuation asset seed', error);
    throw error;
  }
}
