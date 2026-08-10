import { describe, expect, it } from 'vitest';
import { buildMarketObservationEnvelope, buildMarketObservationStreamName, toRedisFields } from '../server/services/marketObservationPublisher';

describe('marketObservationPublisher', () => {
  it('builds a stream name for exchange and data type', () => {
    expect(buildMarketObservationStreamName('binance', 'ticker')).toBe('stream:market:raw:binance:ticker');
  });

  it('computes per-data-type staleness and validity', () => {
    const envelope = buildMarketObservationEnvelope({
      exchange: 'binance',
      market_symbol: 'BTC/USDT',
      base_asset: 'BTC',
      quote_asset: 'USDT',
      market_type: 'spot',
      data_type: 'ticker',
      payload: { price: 100, bid: 99, ask: 101 },
      exchange_timestamp: 1000,
      received_timestamp: 20000,
      source_channel: 'rest',
      is_mock: false,
    });

    expect(envelope.is_stale).toBe(true);
    expect(envelope.is_valid).toBe(true);
  });

  it('serializes the envelope into Redis fields', () => {
    const fields = toRedisFields({
      exchange: 'binance',
      market_symbol: 'BTC/USDT',
      base_asset: 'BTC',
      quote_asset: 'USDT',
      market_type: 'spot',
      data_type: 'ticker',
      payload: { price: 100, bid: 99, ask: 101 },
      exchange_timestamp: 1710000000000,
      received_timestamp: 1710000001000,
      ingestion_timestamp: 1710000002000,
      source_channel: 'rest',
      is_stale: false,
      is_valid: true,
      schema_version: '1.0',
      is_mock: false,
    });

    expect(fields.data_type).toBe('ticker');
    expect(fields.payload_json).toContain('"price":100');
    expect(fields.is_mock).toBe('false');
  });
});
