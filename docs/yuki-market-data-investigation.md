# YUKI Market Data Investigation

## Scope note

This document is a careful, evidence-based summary of what the current codebase establishes, and it distinguishes that from a few reasonable inferences that should not be treated as proven facts without further verification.

## What is solidly established

The following points are directly supported by the code that was inspected:

### Router surface
- The YUKI router entrypoint is mounted in [server/routes/v1/yuki/index.ts](../server/routes/v1/yuki/index.ts).
- It exposes market, routing, intelligence, indicators, and exchange-related sub-routers.

### Exchange ingestion
- The main exchange integration service is [server/services/ccxtService.ts](../server/services/ccxtService.ts).
- It initializes exchange clients, loads markets, and fetches tickers, OHLCV, order books, and trades.

### Live streaming
- Live market relay exists in [server/services/marketStreamService.ts](../server/services/marketStreamService.ts).
- It broadcasts real-time price updates over WebSocket and labels updates as live or mock.

### Derived analytics
- Microstructure intelligence is computed in [server/services/advancedMicrostructureIndicators.ts](../server/services/advancedMicrostructureIndicators.ts).
- It derives order-flow imbalance, volatility-of-volatility, toxicity, and price-impact metrics from exchange feeds.

### Stablecoin semantics
- Stable-asset semantics are partially modeled in [server/services/stableAssetRegistryService.ts](../server/services/stableAssetRegistryService.ts) and [server/config/stableAssets.registry.ts](../server/config/stableAssets.registry.ts).
- These files include peg targets, risk/liquidity metadata, and stable-asset lookup support.

### Redis stream infrastructure
- Redis stream infrastructure exists in [server/infrastructure/redis/RedisStreamAdapter.ts](../server/infrastructure/redis/RedisStreamAdapter.ts).

## What is a reasonable inference, but not yet fully proven

These are plausible interpretations of the current architecture, but they are weaker than the directly verified findings above.

### Raw observations are not yet a first-class durable pipeline
- The current architecture appears to follow a path of fetch → cache/compute → derive → expose.
- A direct trace of the publish call graph shows that the Redis stream adapter is not being used by the CCXT or market-stream ingestion services.
- The verified production path is the outbox relay worker in [server/infrastructure/postgres/OutboxRelayWorker.ts](../server/infrastructure/postgres/OutboxRelayWorker.ts), which publishes domain events from the PostgreSQL outbox into Redis streams such as the trade/vault/dao domain streams and the DLQ.
- There is no verified production call path from [server/services/ccxtService.ts](../server/services/ccxtService.ts) or [server/services/marketStreamService.ts](../server/services/marketStreamService.ts) into the Redis stream adapter for raw market observations.

### Scaling to 6–10 exchanges is plausible, but not yet proven under load
- The codebase is structurally capable of supporting multiple exchanges because it already uses a multi-exchange integration layer and exchange-specific configuration.
- That does not, by itself, prove that the system will perform well under real load at 6–10 exchanges.
- A stronger claim would require checking request volume, concurrency behavior, rate-limit pressure, worker scheduling, and cache behavior under realistic market-data traffic.

## What is still missing from the original investigation brief

This document should be read as a partial first-pass assessment, not a complete end-to-end investigation.

### Metrics and signal composition
- The microstructure service in [server/services/advancedMicrostructureIndicators.ts](../server/services/advancedMicrostructureIndicators.ts) does implement a composite quality score and multiple component metrics such as order-flow imbalance, volatility-of-volatility, toxicity, and price-impact.
- That means the codebase does have a concrete signal-composition layer, even if it was not yet audited for consensus, dispersion, divergence, volume-share, and feed-quality metrics in a broader multi-source sense.

### Asset semantics beyond stablecoins
- The current asset analysis is still stablecoin-oriented, but the engine layer contains explicit logic to bypass external public exchange queries for native assets in [server/services/engineService.ts](../server/services/engineService.ts).
- That is a meaningful asset-semantics signal: native assets are treated differently from exchange-traded tokens, which matters for cases such as XAUT or other asset classes that are not ordinary exchange-quoted instruments.
- The current evidence is enough to say that the system already has some native-asset handling logic, but not enough to claim a full economic-classification model for BTC, ETH, XAUT, or similar assets.

### Consumer-side data path
- The strategy marketplace detail route in [server/routes/v1/yuki/marketplace.ts](../server/routes/v1/yuki/marketplace.ts) was checked directly, and it reads from a Redis cache first and otherwise reads from the database.
- That is a solid, scoped finding about one consumer path.
- It does not, by itself, prove that all consumers behave the same way. A broader claim that the system as a whole separates ingestion from consumer-facing feature paths would require checking additional consumers such as the execution engine, strategy runner, or other signal consumers.
- This is therefore best treated as a narrow evidence point, not a universal property of the whole platform.

### Provenance and metadata fields
- The current codebase does not yet show a full provenance schema for market observations.
- The most visible metadata in the current path is basic timestamping and source labeling, such as the live/mock source field in [server/services/marketStreamService.ts](../server/services/marketStreamService.ts).
- A full provenance inventory would need to cover at least:
  - exchange timestamp vs. receipt timestamp
  - freshness/validity flags
  - venue identity
  - market identity
  - observation type
  - source/channel
  - normalization status
- At this stage, the document is still closer to a checklist for what should be audited than a completed audit of which fields already exist in the codebase.

## Bottom line

The strongest verified conclusion is that the codebase already has real exchange ingestion, live streaming, analytics, and stablecoin metadata support, while the durable observation pipeline remains only partially wired or at least not clearly verified in production. The broader scaling and semantics conclusions should be treated as hypotheses to be tested further rather than as settled facts.

## Remaining gaps from the original brief

The current document still does not cover all of the original investigation scope:
- no explicit check for consensus, dispersion, divergence, volume-share, or feed-quality metrics across venues
- no dedicated XAUT-specific treatment
- no A/B/C/D/E change classification
- no phased roadmap or implementation plan

## Smallest incremental next step

A sensible next step is to verify the missing link directly:
1. trace the actual call path from the existing ingestion services into Redis stream publishing,
2. inspect whether provenance fields are already present or need to be added,
3. and then evaluate scaling and semantics with concrete runtime and load evidence rather than architecture shape alone.

## Phase 1 design proposal: raw market observation envelope

This section is a design proposal only. It is not verified code, and it has not been checked against what CCXT's unified API actually returns for multiple exchanges. Field availability varies by exchange, so this should be treated as an implementation draft rather than a finalized schema.

### Status

- This is a design proposal, not a shipped implementation.
- It should not be treated as verified until the fields are checked against actual responses from [server/services/ccxtService.ts](../server/services/ccxtService.ts) for at least 2–3 exchanges.
- The reason for this caution is that exchange-specific differences are precisely the kind of issue that break a "unified" envelope in practice.

### Design decisions being made here (not facts from the codebase)

- Publish directly from [server/services/ccxtService.ts](../server/services/ccxtService.ts) and [server/services/marketStreamService.ts](../server/services/marketStreamService.ts), not through the outbox pattern. The outbox relay exists to preserve atomicity between a database write and a Redis publish for domain events such as trades or vault operations; market ticks are not paired with a database transaction and can safely be superseded by the next observation if a publish fails.
- Use one envelope shape for all data types (ticker, OHLCV, trade, order-book), with a `data_type` discriminator and a `payload` object. This makes cross-type consumers simpler, though downstream consumers will still need to branch on the payload structure.
- Use stream naming of the form `market:raw:{exchange}:{data_type}` rather than a single firehose stream. This keeps per-exchange and per-type retention and routing more granular.

### Envelope schema draft

```ts
interface MarketObservationEnvelope {
  exchange: string;
  market_symbol: string;
  base_asset: string;
  quote_asset: string;
  market_type: 'spot' | 'future' | 'swap' | 'option';

  data_type: 'ticker' | 'ohlcv' | 'trade' | 'orderbook';
  payload: TickerPayload | OHLCVPayload | TradePayload | OrderbookPayload;

  exchange_timestamp: number;
  received_timestamp: number;
  ingestion_timestamp: number;
  source_channel: 'rest' | 'websocket';

  is_stale: boolean;
  is_valid: boolean;

  schema_version: string;
}

interface TickerPayload {
  price: number | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  volume_24h: number | null;
}

interface OHLCVPayload {
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  candle_timestamp: number;
}

interface TradePayload {
  trade_id: string | null;
  price: number;
  amount: number;
  side: 'buy' | 'sell' | null;
}

interface OrderbookPayload {
  bids: [number, number][];
  asks: [number, number][];
  depth_levels: number;
}
```

### What is deliberately excluded

- No derived metrics such as VWAP, dispersion, premium/discount, or consensus price. Those belong in downstream normalization or state-building stages.
- No `reliability_score` or exchange-health field. Feed quality is a property of a stream over time, not of a single envelope.
- No asset-economic-type metadata. Static asset classification should be joined from an asset registry rather than stamped redundantly into every observation.

### Open questions to resolve before implementation

1. Retention policy per stream, especially for high-frequency ticker and order-book data. The answer is to use bounded retention with a per-stream trim policy, not an unbounded stream. A practical starting point is to apply `MAXLEN` to ticker and order-book streams and a more permissive cap to OHLCV streams, then tune the values after observing real volume.
2. What "stale" means per `data_type`, since the acceptable age of a ticker and the acceptable age of a 1h OHLCV candle are not equivalent. The answer is to define `is_stale` by `data_type` rather than with one global constant: tickers and order-books should use short thresholds, OHLCV should use roughly one or two candle intervals, and trades should be judged against the latest refresh window for the venue.
3. Whether the existing live/mock distinction from [server/services/marketStreamService.ts](../server/services/marketStreamService.ts) should be preserved as an envelope field such as `is_mock`. The answer is yes: preserve it as metadata because it is a real provenance signal and the current implementation already distinguishes live and mock updates.

### Suggested validation step before writing publish code

Pick one exchange already wired into [server/services/ccxtService.ts](../server/services/ccxtService.ts), fetch a real ticker/OHLCV/trade/order-book response, and manually map each field in this envelope to what CCXT actually returns for that call. Repeat the exercise for a second, structurally different exchange before finalizing the schema.

## Answers to the open questions

- Retention policy: use bounded retention per stream rather than an unbounded stream. Ticker and order-book streams should be trimmed aggressively; OHLCV can keep more history, but every stream still needs a hard cap. The practical answer is to set `MAXLEN` per stream and tune it after observing actual volume.
- Staleness definition: define `is_stale` per `data_type`, not once globally. A reasonable starting point is: ticker and order-book stale after a short threshold (for example a few seconds), OHLCV stale after roughly one or two candle intervals, and trades stale if they are older than the latest refresh window for that venue.
- Live/mock distinction: preserve it if the current market-stream implementation still emits a live/mock label. That is a real provenance signal and should be carried forward as a metadata field such as `is_mock` or an equivalent source flag rather than dropped.

## What should happen next

1. Validate the draft envelope against real CCXT payloads from at least two exchanges, preferably one major venue and one more quirky or less uniform venue.
2. Implement a minimal publisher path in [server/services/ccxtService.ts](../server/services/ccxtService.ts) and [server/services/marketStreamService.ts](../server/services/marketStreamService.ts) that writes the envelope to Redis streams using the proposed naming convention.
3. Add a lightweight consumer or test harness to confirm that the schema is stable and that invalid or partially missing fields are handled predictably.
4. Apply a concrete retention policy per stream: ticker and order-book streams should use a short `MAXLEN` cap, OHLCV can use a larger cap, and the chosen values should be documented in code or configuration.
5. Implement per-data-type staleness logic so `is_stale` is computed from type-specific thresholds rather than a single constant.
6. Preserve the live/mock provenance signal in the envelope as an explicit field such as `is_mock`.
7. Only after that, decide whether the raw observation pipeline should remain direct-publish or be refactored into a more formal ingestion layer.
