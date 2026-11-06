import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('celo-stablecoin-valuation-coverage');

export async function migrateCeloStablecoinValuationCoverage(): Promise<void> {
  logger.info('Seeding Celo stablecoins for independent valuation quotes');
  await pool.query(`
    INSERT INTO public.valuation_assets
      (symbol, coingecko_id, asset_class, max_deviation_pct, haircut_pct,
       chain, contract_address, is_active, notes)
    VALUES
      ('CKES', 'celo-kenyan-shilling', 'stable', 2.5, 0, 'celo',
       '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0', true,
       'Curated Celo stablecoin valuation source'),
      ('CREAL', 'celo-brazilian-real', 'stable', 2.5, 0, 'celo',
       '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787', true,
       'Curated Celo stablecoin valuation source'),
      ('EXOF', 'celo-xof', 'stable', 2.5, 0, 'celo',
       '0x73A210632f4F292212260dC5a4527FF0A37D83f9', true,
       'Curated Celo stablecoin valuation source'),
      ('CCOP', 'celo-colombian-peso', 'stable', 2.5, 0, 'celo',
       '0x7890C05a2e379Acf3f4C719C6dCD1a6D6aBD6f6f', true,
       'Curated Celo stablecoin valuation source')
    ON CONFLICT (symbol) DO NOTHING;

    UPDATE public.valuation_assets
    SET chain = COALESCE(chain, CASE symbol
          WHEN 'CUSD' THEN 'celo'
          WHEN 'CEUR' THEN 'celo'
          WHEN 'USDC' THEN 'ethereum'
          WHEN 'USDT' THEN 'ethereum'
          WHEN 'DAI' THEN 'ethereum'
        END),
        contract_address = COALESCE(
          contract_address,
          CASE symbol
            WHEN 'CUSD' THEN '0x765DE816845861e75A25fCA122bb6898B8B1282a'
            WHEN 'CEUR' THEN '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6CA73'
            WHEN 'USDC' THEN '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
            WHEN 'USDT' THEN '0xdac17f958d2ee523a2206206994597c13d831ec7'
            WHEN 'DAI' THEN '0x6b175474e89094c44da98b954eedeac495271d0f'
          END
        )
    WHERE symbol IN ('CUSD', 'CEUR', 'USDC', 'USDT', 'DAI')
      AND (chain IS NULL OR contract_address IS NULL);
  `);
  logger.info('Celo stablecoin valuation coverage applied');
}
