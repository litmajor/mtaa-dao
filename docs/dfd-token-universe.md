# Data-Flow Diagram — Token Universe & Multi‑Chain DEX Discovery

This document describes the unified token discovery data flow that merges CEX market listings and multi‑chain DEX pair discovery (via DexScreener) into a single authoritative `tokenDiscoveryService` used across collector, opportunity engine, and execution subsystems.

## Mermaid DFD

```mermaid
flowchart LR
  subgraph Discovery["Discovery & Registry"]
    TR[Token Registry<br/>(tokenRegistry)]
    MUB[Market Universe Builder<br/>(marketUniverseBuilder)]
    DSC[DexScreener Client<br/>(dexscreenerClient)]
    TDS[Token Discovery Service<br/>(tokenDiscoveryService)]
    MUB -->|CEX listings / metadata| TDS
    DSC -->|DEX pair feeds| TDS
    TR -->|token metadata| MUB
    TR -->|token metadata| TDS
    TDS -->|registerSymbolMappings| PO[Price Oracle<br/>(priceOracle)]
  end

  subgraph Oracles["Oracles & Cache"]
    PO -->|redis dedup/cache| REDIS[Redis]
    PO -->|gateway request| GATEWAY[Gateway Agent]
    PO -->|fallback| COINGECKO[CoinGecko API]
  end

  subgraph Collection["Market Data Collection"]
    COL[Collector / CEX Price Job<br/>(collectorService)]
    COL -->|use CEX scan list| TDS
    COL -->|ccxt queries| CCXT[ccxtService]
    CCXT -->|exchange APIs| CEXES((CEXes))
    COL -->|dex live prices| DSC
    DSC -.->|DexScreener API| DEXSVC[DexScreener API]
  end

  subgraph Execution["Routing & Execution"]
    OR[Order Router<br/>(orderRouter)]
    DEXI[DEX Integration<br/>(dexIntegrationService)]
    GA[Gateway Aggregator<br/>(gatewayAggregator)]
    ADP[(Adapters: UniswapV3, Ubeswap, Pancake...)]
    DB[(Postgres: strategy_rebalances)]
    OR -->|route & split| DEXI
    OR -->|persist perf memory| REDIS
    DEXI -->|use adapters / chain quotes| GA
    GA -->|adapter calls| ADP
    DEXI -->|on-chain txs| CHAIN[Blockchains / RPC]
    DEXI -->|persist execution| DB
    DEXI -->|emit events| STATS[unifiedStatsUpdater]
  end

  subgraph Opportunity["Opportunity Detection"]
    OP[Opportunity Engine<br/>(opportunityEngine)]
    OP -->|scan unified universe| TDS
    OP -->|query prices| PO
    OP -->|signal| OR
  end

  %% cross-links
  TDS -->|CEX scan list| COL
  TDS -->|DEX lists / chainPresence| OP
  COINGECKO -.-> PO
  CEXES -.-> COL
  REDIS -.-> PO

```

## Components (summary)

- **tokenRegistry** — Canonical token metadata (addresses, coingeckoId, chain, categories). Source of truth for registry-driven discovery and name mapping.
- **marketUniverseBuilder** — Builds dynamic CEX universe from `ccxtService` market lists and enriches with `tokenRegistry` metadata.
- **dexscreenerClient** — Rate‑limited client to DexScreener; fetches pair lists, token pairs, and liquidity/volume per chain.
- **tokenDiscoveryService** — New unified service that merges CEX universe + DexScreener multi‑chain DEX discovery into `UnifiedToken` entries and registers coingecko mappings with `priceOracle`.
- **priceOracle** — Gateway Agent + CoinGecko fallback with Redis dedup/cache; receives bulk registrations from discovery for robust fallback pricing.
- **collectorService** — Uses `tokenDiscoveryService.getCEXScanList()` and `dexscreenerClient` to collect live prices for CEX and DEX.
- **opportunityEngine** — Uses unified universe + oracle/DexScreener prices to find CEX‑DEX and cross‑chain DEX arbitrage and signals `orderRouter`.
- **orderRouter / dexIntegrationService / gatewayAggregator / adapters** — Routing, quoting, and execution stack (on‑chain or via adapters). Execution writes to Postgres (`strategy_rebalances`) and updates performance memory in Redis.

## Key Data Flows

- Discovery → Oracle: `tokenDiscoveryService` registers discovered symbol→coingecko IDs with `priceOracle.registerSymbolMappings()` so the oracle can resolve token names and use CoinGecko fallback.
- Collector → Discovery: `collectorService` consumes dynamic CEX scan lists from `tokenDiscoveryService` to avoid hardcoded pair lists.
- DexScreener → Discovery: `dexscreenerClient` supplies multi‑chain pair data (liquidity, volume, priceUsd) that populates `chainPresence` for each `UnifiedToken`.
- Opportunity → Execution: `opportunityEngine` sends candidate opportunities to `orderRouter`, which routes/splits via `dexIntegrationService` and the `gatewayAggregator` adapters.

## Startup integration (suggested snippet)

Add to `server/index.ts` early in startup (before background jobs):

```typescript
// server/index.ts
import { tokenDiscoveryService } from './services/tokenDiscoveryService';
import { logger } from './utils/logger';

logger.info('[STARTUP] Building unified token universe (CEX + multi-chain DEX)...');
await tokenDiscoveryService.buildUnifiedUniverse();
const stats = tokenDiscoveryService.getStats();
logger.info(`[STARTUP] Token universe ready: Total=${stats.total} | CEX-only=${stats.cexOnly} | DEX-only=${stats.dexOnly} | Both=${stats.both}`);

// Then start price collection and opportunity scans which will use tokenDiscoveryService
```

## How to prime the oracle now

- Ensure Redis is available and server environment has network access to DexScreener + CoinGecko.
- Start the server (or run the snippet above) so `tokenDiscoveryService` builds the universe and calls `priceOracle.registerSymbolMappings()`.

## Next steps / Recommendations

- Add `tokenDiscoveryService` call to startup (see snippet).  
- Optionally run a one‑off priming script that calls `buildUnifiedUniverse()` during deployment.  
- Tune `CHAIN_CONFIGS.minLiquidityUsd` per chain to control coverage and API usage.  
- Add adapter implementations for `arbitrum`, `optimism`, and `polygon` to enable executable cross‑chain opportunities.  
- Export this diagram to PNG/SVG for product docs (I can generate and add it to `docs/` if you want).

---

File created: `docs/dfd-token-universe.md`
