import { publishMarketObservation, buildMarketObservationStreamName } from '../server/services/marketObservationPublisher';
import { getRedisInstanceAsync } from '../server/config/redisConnectionManager';

(async () => {
  try {
    const envelope = {
      exchange: 'test-pub',
      market_symbol: 'BTC/USDT',
      base_asset: 'BTC',
      quote_asset: 'USDT',
      market_type: 'spot',
      data_type: 'ticker',
      payload: { price: 123.45, bid: 122.5, ask: 124.5 },
      exchange_timestamp: Date.now(),
      received_timestamp: Date.now(),
      ingestion_timestamp: Date.now(),
      source_channel: 'script-test',
      is_stale: false,
      is_valid: true,
      schema_version: '1.0',
      is_mock: false,
    } as any;

    console.log('[test-redis-publish] publishing observation...');
    const id = await publishMarketObservation(envelope);
    console.log('[test-redis-publish] publish returned id:', id);

    const client = await getRedisInstanceAsync();
    const stream = buildMarketObservationStreamName(envelope.exchange, envelope.data_type);

    try {
      const len = await (client as any).xLen(stream);
      console.log('[test-redis-publish] stream length:', len);
    } catch (caughtErr) {
      const msg = caughtErr instanceof Error ? caughtErr.message : String(caughtErr);
      console.warn('[test-redis-publish] xLen unavailable or failed:', msg);
    }

    try {
      const info = await (client as any).sendCommand(['XINFO', 'STREAM', stream]);
      console.log('[test-redis-publish] XINFO STREAM:', info);
    } catch (caughtErr) {
      const msg = caughtErr instanceof Error ? caughtErr.message : String(caughtErr);
      console.warn('[test-redis-publish] XINFO failed:', msg);
    }

    // Wait a moment to allow XTRIM if it ran asynchronously
    await new Promise((r) => setTimeout(r, 500));
    process.exit(0);
  } catch (caughtErr) {
    const msg = caughtErr instanceof Error ? caughtErr.message : String(caughtErr);
    console.error('[test-redis-publish] error:', msg);
    process.exit(1);
  }
})();
