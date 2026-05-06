# 📊 Market Data Organization & Quick Stats Analysis

**Date:** February 3, 2026  
**Purpose:** Design market exploration UI after opportunities section  
**Example:** BTC/USDT across CEX + DEX

---

## Part 1: Quick Stats Review (What's There Now)

### Current Quick Stats (Section 1 - Sticky Header)

```
┌─────────────────────────────────────────────┐
│ Trading Balance: $12,450.00                 │
│ Today's Gain: +$245.50 (+2.0%)              │
│ Win Rate: 65% | Active Strategies: 3        │
│ Risk Level: 🟢 LOW (12% max drawdown)       │
└─────────────────────────────────────────────┘
```

### Analysis: What to Keep / Add / Remove

**KEEP ✅**
- Trading Balance (critical)
- Today's Gain (motivational)
- Win Rate (performance metric)
- Active Strategies count (activity indicator)
- Risk Level (safety metric)

**ADD 🟢**
- Monthly Gain (trend indicator)
- Open Positions count (position awareness)
- Pending Signals count (action items)
- Account Health Score (0-100)

**REMOVE ❌**
- Risk Level indicator (too much space, can be in portfolio detail page)

**IMPROVED VERSION:**

```
┌─────────────────────────────────────────────────────────┐
│ BALANCE                                                 │
│ $12,450.00  ↑ +$245.50 (2.0%) today  ↑ +$890 (7.7%) MTD│
│                                                          │
│ Win Rate: 65% | Open: 3 | Signals: 2 | Health: 87/100  │
└─────────────────────────────────────────────────────────┘
```

---

## Part 2: Market Data Organization

### Architecture Decision

**Option: Unified with Smart Filtering**

Instead of separate CEX/DEX tabs, use:
1. **Single aggregated view** (best price across all sources)
2. **Filter buttons** (show CEX / DEX / All)
3. **Detail page per pair** (all sources with comparison)

### Data Sources Hierarchy

```
For BTC/USDT:

TIER 1 (CEX - Most Liquid):
├─ Binance    (most volume)
├─ Coinbase   (US regulated)
├─ Kraken     (liquidity)
├─ Gate.io    (altcoins)
└─ OKX        (derivatives)

TIER 2 (DEX - On-chain):
├─ Uniswap V3 (Ethereum)
├─ Sushiswap  (Ethereum)
├─ Raydium    (Solana)
├─ Curve      (stablecoins)
└─ Balancer   (Arbitrum)

AGGREGATION:
├─ Weighted avg price (by volume/liquidity)
├─ Best bid/ask
├─ 24h price change
└─ Slippage estimate for trade size
```

---

## Part 3: Real Example - BTC/USDT

### 1. Market Data Collection

```json
{
  "pair": "BTC/USDT",
  "sources": [
    {
      "type": "CEX",
      "exchange": "binance",
      "price": 42500,
      "bid": 42499,
      "ask": 42501,
      "volume_24h_usd": 450000000,
      "liquidity_usd": 5000000,
      "spread_pct": 0.005,
      "timestamp": "2026-02-03T15:30:00Z"
    },
    {
      "type": "CEX",
      "exchange": "coinbase",
      "price": 42502,
      "bid": 42500,
      "ask": 42504,
      "volume_24h_usd": 180000000,
      "liquidity_usd": 2000000,
      "spread_pct": 0.010,
      "timestamp": "2026-02-03T15:30:02Z"
    },
    {
      "type": "CEX",
      "exchange": "kraken",
      "price": 42498,
      "bid": 42497,
      "ask": 42499,
      "volume_24h_usd": 95000000,
      "liquidity_usd": 1200000,
      "spread_pct": 0.005,
      "timestamp": "2026-02-03T15:30:01Z"
    },
    {
      "type": "CEX",
      "exchange": "gatedio",
      "price": 42510,
      "bid": 42508,
      "ask": 42512,
      "volume_24h_usd": 45000000,
      "liquidity_usd": 800000,
      "spread_pct": 0.009,
      "timestamp": "2026-02-03T15:30:03Z"
    },
    {
      "type": "CEX",
      "exchange": "okx",
      "price": 42505,
      "bid": 42503,
      "ask": 42507,
      "volume_24h_usd": 380000000,
      "liquidity_usd": 3000000,
      "spread_pct": 0.009,
      "timestamp": "2026-02-03T15:30:00Z"
    },
    {
      "type": "DEX",
      "chain": "ethereum",
      "dex": "uniswap_v3",
      "pool_address": "0x...",
      "price": 42520,
      "bid": 42515,
      "ask": 42525,
      "liquidity_usd": 2500000,
      "spread_pct": 0.024,
      "slippage_10btc_pct": 0.15,
      "timestamp": "2026-02-03T15:30:05Z"
    },
    {
      "type": "DEX",
      "chain": "solana",
      "dex": "raydium",
      "pool_address": "0x...",
      "price": 42480,
      "bid": 42475,
      "ask": 42485,
      "liquidity_usd": 450000,
      "spread_pct": 0.024,
      "slippage_10btc_pct": 2.5,
      "timestamp": "2026-02-03T15:30:06Z"
    }
  ]
}
```

### 2. Aggregation Calculation

```python
# backend/services/price_aggregation.py
from typing import List, Dict
import numpy as np

class PriceAggregator:
    @staticmethod
    def calculate_weighted_price(sources: List[Dict]) -> Dict:
        """
        Calculate volume-weighted average price (VWAP)
        Prioritize high-liquidity sources
        """
        
        # Filter by minimum liquidity
        valid_sources = [s for s in sources if s.get('liquidity_usd', 0) >= 100000]
        
        # Weight by liquidity (higher liquidity = more weight)
        total_liquidity = sum(s['liquidity_usd'] for s in valid_sources)
        
        weighted_price = sum(
            s['price'] * (s['liquidity_usd'] / total_liquidity)
            for s in valid_sources
        )
        
        best_bid = max(s['bid'] for s in valid_sources)
        best_ask = min(s['ask'] for s in valid_sources)
        
        # Separate CEX and DEX
        cex_sources = [s for s in valid_sources if s['type'] == 'CEX']
        dex_sources = [s for s in valid_sources if s['type'] == 'DEX']
        
        cex_weighted = sum(
            s['price'] * (s['liquidity_usd'] / sum(c['liquidity_usd'] for c in cex_sources))
            for s in cex_sources
        ) if cex_sources else None
        
        dex_weighted = sum(
            s['price'] * (s['liquidity_usd'] / sum(d['liquidity_usd'] for d in dex_sources))
            for s in dex_sources
        ) if dex_sources else None
        
        return {
            'weighted_price': round(weighted_price, 2),
            'best_bid': best_bid,
            'best_ask': best_ask,
            'spread_pct': ((best_ask - best_bid) / best_bid) * 100,
            'cex_price': cex_weighted,
            'dex_price': dex_weighted,
            'source_count': len(valid_sources),
            'cex_count': len(cex_sources),
            'dex_count': len(dex_sources),
            'total_liquidity': total_liquidity
        }
```

### 3. Result Display

```
Market View: BTC/USDT
═══════════════════════════════════════════════════════

AGGREGATED PRICE
  Price:        $42,501.23 (weighted across 7 sources)
  Best Bid/Ask: $42,499 / $42,501
  Spread:       0.005%

CEX AVERAGE (Binance, Coinbase, Kraken, Gate.io, OKX)
  Price:        $42,502.80
  Liquidity:    $12.2M
  Volume 24h:   $1.15B
  Spread:       0.006% (best)

DEX AVERAGE (Uniswap V3, Raydium)
  Price:        $42,500.00
  Liquidity:    $2.95M
  Volume 24h:   $125M
  Spread:       0.024%
  
INDIVIDUAL SOURCES
┌─────────────┬──────────┬────────────────┬──────────┬─────────┐
│ Exchange    │ Type     │ Price          │ Spread   │ Volume  │
├─────────────┼──────────┼────────────────┼──────────┼─────────┤
│ Binance     │ CEX 🏆   │ $42,500.00     │ 0.005%   │ $450M   │
│ OKX         │ CEX      │ $42,505.00     │ 0.009%   │ $380M   │
│ Coinbase    │ CEX      │ $42,502.00     │ 0.010%   │ $180M   │
│ Gate.io     │ CEX      │ $42,510.00     │ 0.009%   │ $45M    │
│ Kraken      │ CEX      │ $42,498.00     │ 0.005%   │ $95M    │
│ Uniswap V3  │ DEX ⛓️   │ $42,520.00     │ 0.024%   │ $2.5M   │
│ Raydium     │ DEX      │ $42,480.00     │ 0.024%   │ $450K   │
└─────────────┴──────────┴────────────────┴──────────┴─────────┘

TRADE SIMULATION (Buy 1 BTC)
┌────────────────────────────────────┐
│ Amount:        1 BTC               │
│ Best Price:    $42,499 (Binance)   │
│ Slippage Est:  0.005%              │
│ Total Cost:    $42,501.23          │
│ Fee:           $127.50 (0.3%)      │
│ Final Cost:    $42,628.73          │
└────────────────────────────────────┘
```

---

## Part 4: UI/UX Layout

### Market Explorer Section (After Opportunities)

```
┌─────────────────────────────────────────────────────────────┐
│ ▶ MARKET EXPLORER (Collapsed by Default)                   │
└─────────────────────────────────────────────────────────────┘
     ↓ (When Expanded)

┌─────────────────────────────────────────────────────────────┐
│ MARKET EXPLORER                                             │
├─────────────────────────────────────────────────────────────┤
│ 📊 Search Pair: [BTC/USDT ▼]                               │
│                                                              │
│ [Filter: ALL] [CEX Only] [DEX Only]  [⭐ Watchlist]        │
│                                                              │
│ BEST PRICE: $42,501.23 (Binance, Coinbase, OKX avg)       │
│ Spread: 0.005% | Liquidity: $12.2M | Volume: $1.15B       │
│                                                              │
│ [📊 View Details] [💹 Trade]                               │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ RECENT SEARCHES:                                            │
│ • SOL/USDC (4 min ago)                                     │
│ • ETH/USDT (1 hour ago)                                    │
│ • PUMP/SOL (3 hours ago)                                   │
└─────────────────────────────────────────────────────────────┘
```

### Detail Page (Click "View Details")

```
═══════════════════════════════════════════════════════════════
BTC/USDT - Comprehensive Market Analysis
═══════════════════════════════════════════════════════════════

AGGREGATED PRICING
┌──────────────────────────────────────────────────────────┐
│ Weighted Price:    $42,501.23                            │
│ 24h Change:        +$1,250 (+3.0%)                       │
│ 24h High:          $42,800                               │
│ 24h Low:           $41,200                               │
│ Best Bid/Ask:      $42,499 / $42,501 (Spread: 0.005%)   │
└──────────────────────────────────────────────────────────┘

LIQUIDITY BREAKDOWN
┌────────────────────────────────────────────────────────┐
│ CEX Liquidity:     $12.2M (80.6%)  🥇                  │
│ DEX Liquidity:     $2.95M (19.4%) 🥈                   │
│ Total Available:   $15.15M                             │
│                                                         │
│ Best Source: Binance ($5M), Coinbase ($2M), OKX ($3M) │
└────────────────────────────────────────────────────────┘

CEX MARKET (Centralized Exchanges)
┌──────────────────┬────────────┬──────────┬──────────┐
│ Exchange         │ Price      │ Liquidity│ Volume   │
├──────────────────┼────────────┼──────────┼──────────┤
│ 🏆 Binance       │ $42,500.00 │ $5.0M    │ $450M    │
│ 🥈 OKX           │ $42,505.00 │ $3.0M    │ $380M    │
│ 🥉 Coinbase      │ $42,502.00 │ $2.0M    │ $180M    │
│    Kraken        │ $42,498.00 │ $1.2M    │ $95M     │
│    Gate.io       │ $42,510.00 │ $0.8M    │ $45M     │
└──────────────────┴────────────┴──────────┴──────────┘

DEX MARKET (Decentralized Exchanges)
┌──────────────────┬──────────┬──────────────┬──────────┐
│ DEX / Chain      │ Price    │ Liquidity    │ Slippage │
├──────────────────┼──────────┼──────────────┼──────────┤
│ Uniswap V3 (ETH) │ $42,520  │ $2.5M        │ 0.15%    │
│ Raydium (SOL)    │ $42,480  │ $450K        │ 2.5%     │
└──────────────────┴──────────┴──────────────┴──────────┘

PRICE CHART (24h)
┌────────────────────────────────────────────────────┐
│ $42,800 │                                 ▲        │
│         │        ▀▄                    ▄▀ ▲       │
│ $42,500 │  ▄▄▄▄▀   ▀▄▄▄▄▄▄▄▄▄▄▄▄▄▀▀▀  ▄▀  │       │
│         │ ▀                              ▀   ▀▄   │
│ $41,200 │                                     ▀▀ │
├────────────────────────────────────────────────────┤
│  00:00   06:00   12:00   18:00   23:59           │
└────────────────────────────────────────────────────┘

TRADE SIMULATOR
┌─────────────────────────────────────────────────┐
│ BUY             │          SELL              │
├─────────────────┼────────────────────────────┤
│ Amount: [1 BTC] │ Amount: [1 BTC]            │
│ Price:  Best    │ Price:  Best               │
│ Fee:    0.3%    │ Fee:    0.3%               │
│ ────────────────│                            │
│ Total: $42,628  │ Receive: $42,373           │
│                 │                            │
│ [💹 BUY] [SAFE] │ [💹 SELL] [SAFE]           │
└─────────────────┴────────────────────────────┘

ARBITRAGE OPPORTUNITIES
┌────────────────────────────────────────────┐
│ ⚡ Opportunity Detected:                   │
│ Buy on Raydium ($42,480)                   │
│ Sell on Uniswap ($42,520)                  │
│ Profit: $40 per BTC (0.09%)                │
│ Slippage Cost: ~$2,100 (too high)          │
│                                             │
│ Status: ❌ NOT VIABLE (slippage > profit)  │
└────────────────────────────────────────────┘
```

---

## Part 5: Database Schema for Market Data

```python
# backend/models/market_data.py

class PairPrice(Base):
    __tablename__ = "pair_prices"
    
    id = Column(Integer, primary_key=True)
    pair = Column(String(50))  # BTC/USDT
    exchange = Column(String(100))  # binance, uniswap_v3, etc.
    exchange_type = Column(String(20))  # CEX or DEX
    chain = Column(String(50))  # ethereum, solana (null for CEX)
    
    price = Column(DECIMAL(20, 8))
    bid = Column(DECIMAL(20, 8))
    ask = Column(DECIMAL(20, 8))
    spread_pct = Column(DECIMAL(10, 4))
    
    volume_24h_usd = Column(DECIMAL(20, 2))
    liquidity_usd = Column(DECIMAL(20, 2))
    
    last_updated = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

class PriceAggregate(Base):
    __tablename__ = "price_aggregates"
    
    id = Column(Integer, primary_key=True)
    pair = Column(String(50))
    
    weighted_price = Column(DECIMAL(20, 8))
    best_bid = Column(DECIMAL(20, 8))
    best_ask = Column(DECIMAL(20, 8))
    spread_pct = Column(DECIMAL(10, 4))
    
    cex_price = Column(DECIMAL(20, 8))
    dex_price = Column(DECIMAL(20, 8))
    
    cex_liquidity = Column(DECIMAL(20, 2))
    dex_liquidity = Column(DECIMAL(20, 2))
    total_liquidity = Column(DECIMAL(20, 2))
    
    source_count = Column(Integer)
    cex_count = Column(Integer)
    dex_count = Column(Integer)
    
    last_updated = Column(DateTime, default=datetime.utcnow)
```

---

## Part 6: API Endpoints for Market Data

```python
# backend/routes/markets.py

@router.get("/api/yuki/markets/search")
async def search_pair(q: str, db: Session = Depends(get_db)):
    """
    Search for a trading pair
    GET /api/yuki/markets/search?q=BTC/USDT
    """
    return {
        'pair': 'BTC/USDT',
        'weighted_price': 42501.23,
        'best_bid': 42499,
        'best_ask': 42501,
        'cex_price': 42502.80,
        'dex_price': 42500.00,
        'cex_liquidity': 12200000,
        'dex_liquidity': 2950000,
        'sources_count': 7,
        'cex_count': 5,
        'dex_count': 2
    }

@router.get("/api/yuki/markets/{pair}/detail")
async def get_pair_detail(pair: str, db: Session = Depends(get_db)):
    """
    Get detailed market info for a pair
    GET /api/yuki/markets/BTC/USDT/detail
    """
    return {
        'pair': pair,
        'cex_sources': [
            {'exchange': 'binance', 'price': 42500, 'liquidity': 5000000, 'volume': 450000000},
            {'exchange': 'coinbase', 'price': 42502, 'liquidity': 2000000, 'volume': 180000000},
            # ... rest of sources
        ],
        'dex_sources': [
            {'dex': 'uniswap_v3', 'chain': 'ethereum', 'price': 42520, 'liquidity': 2500000},
            {'dex': 'raydium', 'chain': 'solana', 'price': 42480, 'liquidity': 450000},
        ],
        'chart_data': [...]
    }

@router.get("/api/yuki/markets/{pair}/arbitrage")
async def detect_arbitrage(pair: str, size_usd: float = 10000, db: Session = Depends(get_db)):
    """
    Find arbitrage opportunities for a pair
    """
    return {
        'opportunities': [
            {
                'buy_exchange': 'raydium',
                'buy_price': 42480,
                'sell_exchange': 'uniswap_v3',
                'sell_price': 42520,
                'profit_pct': 0.094,
                'slippage_cost': 2100,
                'net_profit': -2060,
                'viable': False
            }
        ]
    }

@router.get("/api/yuki/markets/trending")
async def get_trending_pairs(limit: int = 10, db: Session = Depends(get_db)):
    """
    Get trending pairs by volume + price change
    """
    return {
        'trending': [
            {'pair': 'BTC/USDT', 'volume_24h': '1.15B', 'change_24h': '+3.0%'},
            {'pair': 'ETH/USDT', 'volume_24h': '650M', 'change_24h': '+2.8%'},
            # ... more pairs
        ]
    }
```

---

## Summary: Market Data Organization

| Aspect | Strategy |
|--------|----------|
| **Aggregation** | Volume-weighted average price |
| **CEX Priority** | Higher liquidity, more reliable |
| **DEX Access** | Show as alternative source |
| **Detail Page** | Compare all 7+ sources side-by-side |
| **Trading** | Show slippage estimate |
| **Arbitrage** | Calculate but warn if slippage exceeds profit |
| **Search** | Type-ahead with trending suggestions |
| **Filter** | CEX / DEX / All toggle |

This gives users:
✅ Best price across all sources  
✅ Transparency (see all sources)  
✅ Safety (slippage warnings)  
✅ Opportunity detection (arbitrage)  
✅ Informed trading decisions

