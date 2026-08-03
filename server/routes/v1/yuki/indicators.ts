/**
 * ════════════════════════════════════════════════════════════════════════════════
 * YUKI Indicators Router — Universal Technical Analysis
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Mount: /v1/yuki/indicators
 *
 * Serves EnhancedTechnicalResult (regime-aware, weighted signals, deltas)
 * for ANY symbol in the SymbolUniverse. CEX vs DEX is resolved by the
 * underlying ohlcvService; this router just passes the right exchange key.
 *
 * Routes:
 *   GET /:symbol                → Snapshot (EnhancedTechnicalResult)
 *   GET /:symbol/multi-timeframe → Macro + micro alignment
 *   GET /:symbol/chart          → Time-series arrays for chart rendering
 */

import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateToken } from '../../../middleware/auth';
import { technicalAnalysisService } from '../../../services/technicalAnalysisService';
import { ohlcvService } from '../../../services/ohlcvService';
import { ApiResponse } from '../../../utils/apiResponse';
import { logger } from '../../../utils/logger';

// Array-based indicator library (for /chart endpoint)
import {
  rsi,
  macd,
  bollingerBands,
  atr,
  stochastic,
  obv,
  mfi,
  cci,
  adx,
  ichimoku,
  fibLevels,
  volumeProfile,
} from '../../../services/technicalIndicatorLibrary.ts';

const router = Router();

router.use(authenticateToken as any);

const indicatorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many indicator requests',
});

const SYMBOL_PATTERN = /^[A-Za-z0-9.$\-_/]{2,40}$/;
function validateSymbol(input: unknown): string | null {
  const s = String(input ?? '');
  return SYMBOL_PATTERN.test(s) ? s : null;
}

const VALID_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/indicators/:symbol
// Enhanced snapshot with regime, weighted signals, confidence, delta
// ════════════════════════════════════════════════════════════════════════════════
router.get(
  '/:symbol',
  indicatorLimiter,
  async (req: Request, res: Response) => {
    try {
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) {
        return res.status(400).json(ApiResponse.error('Invalid symbol format'));
      }

      const {
        timeframe = '1d',
        exchange = 'binance',
        source = 'auto', // 'cex' | 'dex' | 'auto'
      } = req.query;

      if (!VALID_TIMEFRAMES.includes(timeframe as string)) {
        return res.status(400).json(
          ApiResponse.error('Invalid timeframe').addMeta({ valid: VALID_TIMEFRAMES })
        );
      }

      // Map source to exchange parameter for ohlcvService
      let targetExchange = source === 'dex' ? 'dex' : (exchange as string);

      // Primary call
      let result = await technicalAnalysisService.analyzeSymbol(
        symbol,
        timeframe as string,
        targetExchange
      );

      // Auto-fallback: if CEX returned empty, try DEX
      if (result.candleCount === 0 && source === 'auto') {
        logger.info(`CEX empty for ${symbol}, trying DEX fallback`);
        result = await technicalAnalysisService.analyzeSymbol(
          symbol,
          timeframe as string,
          'dex'
        );
        if (result.candleCount > 0) {
          return res.json(
            ApiResponse.success(result).addMeta({ source: 'dex', fallback: true })
          );
        }
      }

      if (result.candleCount === 0) {
        return res.status(404).json(
          ApiResponse.error(`No OHLCV data available for ${symbol}`).addMeta({
            timeframe,
            requestedSource: source || 'cex',
          })
        );
      }

      res.json(
        ApiResponse.success(result).addMeta({
          source: source === 'dex' ? 'dex' : result.ohlcvDataSource,
          symbol,
          timeframe,
        })
      );
    } catch (error) {
      logger.error('Indicators snapshot failed', { error });
      res.status(500).json(ApiResponse.error('Failed to compute indicators'));
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/indicators/:symbol/multi-timeframe
// Uses TechnicalAnalysisService.analyzeMultiTimeframe directly
// ════════════════════════════════════════════════════════════════════════════════
router.get(
  '/:symbol/multi-timeframe',
  indicatorLimiter,
  async (req: Request, res: Response) => {
    try {
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) {
        return res.status(400).json(ApiResponse.error('Invalid symbol format'));
      }

      const {
        macro = '1h',
        micro = '5m',
        exchange = 'binance',
        source = 'auto',
      } = req.query;

      const targetExchange = source === 'dex' ? 'dex' : (exchange as string);

      const result = await technicalAnalysisService.analyzeMultiTimeframe(
        symbol,
        macro as string,
        micro as string,
        targetExchange
      );

      res.json(
        ApiResponse.success(result).addMeta({
          symbol,
          macro,
          micro,
          source: source || 'cex',
        })
      );
    } catch (error: any) {
      logger.error('Multi-timeframe analysis failed', { error });
      res.status(500).json(
        ApiResponse.error(error.message || 'Multi-timeframe analysis failed')
      );
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/indicators/:symbol/chart
// Time-series arrays for rendering charts (RSI line, MACD histogram, etc.)
// ════════════════════════════════════════════════════════════════════════════════
router.get(
  '/:symbol/chart',
  indicatorLimiter,
  async (req: Request, res: Response) => {
    try {
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) {
        return res.status(400).json(ApiResponse.error('Invalid symbol format'));
      }

      const {
        timeframe = '1d',
        exchange = 'binance',
        source = 'auto',
        limit = '200',
      } = req.query;

      const limitNum = Math.min(parseInt(limit as string) || 200, 500);
      let targetExchange = source === 'dex' ? 'dex' : (exchange as string);

      let ohlcvResponse = await ohlcvService.getCandles(
        symbol,
        timeframe as string,
        limitNum,
        targetExchange
      );

      // Auto-fallback to DEX
      if (
        (!ohlcvResponse?.data || ohlcvResponse.data.length < 14) &&
        source === 'auto'
      ) {
        ohlcvResponse = await ohlcvService.getCandles(
          symbol,
          timeframe as string,
          limitNum,
          'dex'
        );
      }

      if (!ohlcvResponse?.data || ohlcvResponse.data.length < 14) {
        return res.status(404).json(
          ApiResponse.error('Insufficient candle data for chart indicators')
        );
      }

      const candles = ohlcvResponse.data;
      const close = candles.map((c) => c.close);
      const high = candles.map((c) => c.high);
      const low = candles.map((c) => c.low);
      const volume = candles.map((c) => c.volume);

      // Array-based indicators from the Complete Technical Indicator Library
      const rsiArr = rsi(close, 14);
      const macdArr = macd(close, 12, 26, 9);
      const bbArr = bollingerBands(close, 20, 2);
      const atrArr = atr(high, low, close, 14);
      const stochArr = stochastic(high, low, close, 14, 3);
      const obvArr = obv(close, volume);
      const mfiArr = mfi(high, low, close, volume, 14);
      const cciArr = cci(high, low, close, 20);
      const adxArr = adx(high, low, close, 14);
      const ichiArr = ichimoku(high, low, close, 9, 26, 52);
      const fib = fibLevels(high, low, close, 55, 'swing');
      const vp = volumeProfile(close, volume, 50, 200);

      const enrichedCandles = candles.map((c, i) => ({
        t: c.timestamp,
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close,
        v: c.volume,
        rsi: rsiArr[i] ?? null,
        macd: macdArr.macd[i] ?? null,
        macdSignal: macdArr.signal[i] ?? null,
        macdHistogram: macdArr.histogram[i] ?? null,
        bbUpper: bbArr.upper[i] ?? null,
        bbMiddle: bbArr.middle[i] ?? null,
        bbLower: bbArr.lower[i] ?? null,
        atr: atrArr[i] ?? null,
        stochK: stochArr.k[i] ?? null,
        stochD: stochArr.d[i] ?? null,
        obv: obvArr[i] ?? null,
        mfi: mfiArr[i] ?? null,
        cci: cciArr[i] ?? null,
        adx: adxArr[i] ?? null,
        tenkan: ichiArr.tenkan[i] ?? null,
        kijun: ichiArr.kijun[i] ?? null,
        senkouA: ichiArr.senkouA[i] ?? null,
        senkouB: ichiArr.senkouB[i] ?? null,
        chikou: ichiArr.chikou[i] ?? null,
      }));

      res.json(
        ApiResponse.success({
          symbol,
          timeframe,
          count: candles.length,
          source: ohlcvResponse.dataSource || (source === 'dex' ? 'dex' : 'cex'),
          timestamp: Date.now(),
          candles: enrichedCandles,
          fibonacci: fib,
          volumeProfile: vp,
        }).addMeta({
          source: ohlcvResponse.dataSource || 'unknown',
        })
      );
    } catch (error) {
      logger.error('Chart indicators failed', { error });
      res.status(500).json(ApiResponse.error('Failed to compute chart indicators'));
    }
  }
);

export default router;