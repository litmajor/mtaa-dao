import { getRedisInstanceAsync } from '../config/redisConnectionManager';
import { RedisStreamProducer, type StreamName } from '../infrastructure/redis/RedisStreamAdapter';
import { logger } from '../utils/logger';

export interface MarketObservationEnvelope {
  exchange: string;
  market_symbol: string;
  base_asset: string;
  quote_asset: string;
  market_type: string;
  data_type: string;
  payload: Record<string, unknown>;
  exchange_timestamp: number;
  received_timestamp: number;
  ingestion_timestamp: number;
  source_channel: string;
  is_stale: boolean;
  is_valid: boolean;
  schema_version: string;
  is_mock?: boolean;
}

export interface MarketObservationEnvelopeInput {
  exchange: string;
  market_symbol: string;
  base_asset: string;
  quote_asset: string;
  market_type: string;
  data_type: string;
  payload: Record<string, unknown>;
  exchange_timestamp?: number;
  received_timestamp?: number;
  ingestion_timestamp?: number;
  source_channel: string;
  schema_version?: string;
  is_mock?: boolean;
}

const RETENTION_LIMITS: Record<string, number> = {
  ticker: 10000,
  orderbook: 10000,
  trade: 10000,
  ohlcv: 50000,
};

const STALENESS_THRESHOLDS: Record<string, number> = {
  ticker: 10000,
  orderbook: 15000,
  trade: 10000,
  ohlcv: 3600000,
};

export function buildMarketObservationStreamName(exchange: string, dataType: string): StreamName {
  return `stream:market:raw:${exchange}:${dataType}` as unknown as StreamName;
}

function parseTimeframeToMs(timeframe: string | undefined): number | null {
  if (!timeframe) return null;
  const match = timeframe.trim().match(/^([0-9]+)([smhdw])$/i);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function getStalenessThreshold(dataType: string, payload: Record<string, unknown>): number {
  if (dataType === 'ohlcv') {
    const timeframe = typeof payload.timeframe === 'string' ? payload.timeframe : undefined;
    return parseTimeframeToMs(timeframe) ?? STALENESS_THRESHOLDS.ohlcv;
  }

  return STALENESS_THRESHOLDS[dataType] ?? STALENESS_THRESHOLDS.ticker;
}

function getRetentionLimit(dataType: string): number {
  return RETENTION_LIMITS[dataType] ?? RETENTION_LIMITS.ticker;
}

function computeValidity(envelope: MarketObservationEnvelope): boolean {
  const { data_type, payload } = envelope;

  switch (data_type) {
    case 'ticker':
      return typeof payload.price === 'number' || typeof payload.bid === 'number' || typeof payload.ask === 'number';
    case 'ohlcv':
      return typeof payload.open === 'number' && typeof payload.high === 'number' && typeof payload.low === 'number' && typeof payload.close === 'number' && typeof payload.volume === 'number';
    case 'trade':
      return typeof payload.price === 'number' && typeof payload.amount === 'number';
    case 'orderbook':
      return Array.isArray(payload.bids) || Array.isArray(payload.asks);
    default:
      return true;
  }
}

export function buildMarketObservationEnvelope(input: MarketObservationEnvelopeInput): MarketObservationEnvelope {
  const now = Date.now();
  const exchangeTimestamp = input.exchange_timestamp ?? now;
  const receivedTimestamp = input.received_timestamp ?? now;
  const ingestionTimestamp = input.ingestion_timestamp ?? now;
  const envelope: MarketObservationEnvelope = {
    exchange: input.exchange,
    market_symbol: input.market_symbol,
    base_asset: input.base_asset,
    quote_asset: input.quote_asset,
    market_type: input.market_type,
    data_type: input.data_type,
    payload: input.payload,
    exchange_timestamp: exchangeTimestamp,
    received_timestamp: receivedTimestamp,
    ingestion_timestamp: ingestionTimestamp,
    source_channel: input.source_channel,
    is_stale: false,
    is_valid: true,
    schema_version: input.schema_version ?? '1.0',
    is_mock: input.is_mock,
  };

  const threshold = getStalenessThreshold(input.data_type, input.payload);
  envelope.is_stale = receivedTimestamp - exchangeTimestamp > threshold;
  envelope.is_valid = computeValidity(envelope);

  return envelope;
}

export function toRedisFields(envelope: MarketObservationEnvelope): Record<string, string> {
  const fields: Record<string, string> = {
    exchange: envelope.exchange,
    market_symbol: envelope.market_symbol,
    base_asset: envelope.base_asset,
    quote_asset: envelope.quote_asset,
    market_type: envelope.market_type,
    data_type: envelope.data_type,
    exchange_timestamp: String(envelope.exchange_timestamp),
    received_timestamp: String(envelope.received_timestamp),
    ingestion_timestamp: String(envelope.ingestion_timestamp),
    source_channel: envelope.source_channel,
    is_stale: String(envelope.is_stale),
    is_valid: String(envelope.is_valid),
    schema_version: envelope.schema_version,
    payload_json: JSON.stringify(envelope.payload),
  };

  if (typeof envelope.is_mock === 'boolean') {
    fields.is_mock = String(envelope.is_mock);
  }

  return fields;
}

async function applyRetentionPolicy(client: Awaited<ReturnType<typeof getRedisInstanceAsync>>, stream: StreamName, dataType: string): Promise<void> {
  const limit = getRetentionLimit(dataType);
  if (limit <= 0) return;

  try {
    await (client as any).sendCommand(['XTRIM', stream, 'MAXLEN', '~', String(limit)]);
  } catch (error) {
    logger.debug(`[MarketObservationPublisher] Retention trim skipped for ${stream}:`, { error });
  }
}

export async function publishMarketObservation(envelope: MarketObservationEnvelope): Promise<string | null> {
  try {
    const client = await getRedisInstanceAsync();
    const producer = new RedisStreamProducer(client);
    const stream = buildMarketObservationStreamName(envelope.exchange, envelope.data_type);
    const fields = toRedisFields(envelope);
    const messageId = await producer.publish(stream, fields);
    await applyRetentionPolicy(client, stream, envelope.data_type);
    return messageId;
  } catch (error) {
    logger.warn(`[MarketObservationPublisher] Failed to publish ${envelope.data_type} for ${envelope.exchange}:`, { error });
    return null;
  }
}
