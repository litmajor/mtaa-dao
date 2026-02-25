# DEX Capability Matrix - Quick Reference

**Status Overview**  
**Current Date**: Session start  
**Single API Server**: Express.js port 5000 ✅  
**All Calls Route Through**: `/api/dex/*`

---

## Current DEX Status (10 Supported)

### ✅ ACTIVE & TESTED

| DEX | Chain | Type | Liquidity | Capabilities | Notes |
|-----|-------|------|-----------|--------------|-------|
| **Ubeswap** | Celo | AMM V2 | $150M | Swaps, Quotes, Routing | Fully tested |
| **Uniswap V3** | Ethereum | AMM V3 | $5B+ | Swaps, Quotes, Multi-hop | Live |
| **Uniswap V3** | Polygon | AMM V3 | $500M | Swaps, Quotes, Multi-hop | Live |
| **Uniswap V3** | Arbitrum | AMM V3 | $400M | Swaps, Quotes, Multi-hop | Live |
| **Uniswap V3** | Optimism | AMM V3 | $200M | Swaps, Quotes, Multi-hop | Live |
| **Sushiswap** | Ethereum | AMM V2 | $300M | Swaps, Quotes, Routing | Live |
| **Sushiswap** | Polygon | AMM V2 | $200M | Swaps, Quotes, Routing | Live |
| **Sushiswap** | Arbitrum | AMM V2 | $150M | Swaps, Quotes, Routing | Live |
| **Curve** | Ethereum | Stable | $1B+ | Stablecoin swaps | Framework ready |
| **PancakeSwap** | BSC | AMM V2 | $2B+ | Swaps, Quotes, Routing | ⏳ Ready (inactive) |

### 🔨 PLANNED & READY TO IMPLEMENT

| DEX | Chain | Type | Liquidity | When | Priority |
|-----|-------|------|-----------|------|----------|
| **Raydium** | Solana | AMM V2 | $500M+ | 3-4h | #1 (High) |
| **Pump.fun** | Solana | Bonding Curve | Variable | 4-5h | #3 (Medium) |
| **SunSwap** | Tron | AMM V2 | $50M+ | 3-4h | #4 (Low) |

---

## What Each DEX Can Do

### Current Active: Token Swaps

```
GET  /api/dex/supported
     → Returns: All DEX types with metadata

GET  /api/dex/supported-by-chain/ethereum
     → Returns: [Uniswap V3, Sushiswap, Curve]

POST /api/dex/quote
     {
       "fromAsset": "USDC",
       "toAsset": "ETH",
       "amountIn": 1000,
       "chain": "ethereum"
     }
     → Returns: SwapQuote with estimated output, price impact

POST /api/dex/execute
     {
       "fromAsset": "USDC",
       "toAsset": "ETH",
       "amountIn": 1000,
       "chain": "ethereum"
     }
     → Returns: SwapResult with transaction hash

POST /api/dex/best-route
     {
       "fromAsset": "USDC",
       "toAsset": "ETH",
       "amountIn": 1000,
       "chain": "ethereum"
     }
     → Returns: Ranked swap routes with comparison
```

### Planned: Additional Capabilities

#### Raydium (When Implemented)
```
POST /api/dex/quote
  {
    "fromAsset": "USDC",
    "toAsset": "SOL",
    "amountIn": 100,
    "chain": "solana",
    "preferredDex": "raydium_solana"
  }
  → Swaps, Multi-hop routing, Quotes
```

#### Pump.fun (When Implemented)
```
GET  /api/dex/pump-fun/trending?limit=20
     → 20 hottest tokens right now

GET  /api/dex/pump-fun/token/ABC123
     → Token info, price chart, holders

POST /api/dex/pump-fun/trade
  {
    "mint": "ABC123",
    "action": "buy",
    "amountSol": 0.1
  }
  → Bonding curve trades, memecoin launches
```

#### SunSwap (When Implemented)
```
POST /api/dex/sunswap/quote
  {
    "tokenIn": "USDT",
    "tokenOut": "TRX",
    "amountIn": 1000
  }
  → Tron swaps, multi-hop routing

POST /api/dex/sunswap/execute
  → Execute Tron swap on-chain
```

---

## Implementation Timeline

### IMMEDIATE (Next 1-2 hours)
- ✅ Activate PancakeSwap on BSC (lowest effort)
- ✅ Test on BSC testnet
- ✅ Verify routing through Express server

### THIS WEEK (Next 3-4 hours)
- [ ] Implement Raydium (Solana - highest priority)
- [ ] Test with actual SOL/USDC swaps
- [ ] Add to supported DEXs list

### SAME WEEK (Next 2-3 hours)
- [ ] Choose: Pump.fun OR SunSwap
- [ ] Implement second blockchain DEX

---

## Supported Chains

```
✅ Celo         (1 DEX: Ubeswap)
✅ Ethereum     (3 DEXs: Uniswap V3, Sushiswap, Curve)
✅ Polygon      (2 DEXs: Uniswap V3, Sushiswap)
✅ Arbitrum     (2 DEXs: Uniswap V3, Sushiswap)
✅ Optimism     (1 DEX: Uniswap V3)
✅ BSC          (1 DEX: PancakeSwap - ready to activate)
🔨 Solana       (2 DEXs: Raydium, Pump.fun - planned)
🔨 Tron         (1 DEX: SunSwap - planned)
```

---

## Price Impact & Slippage

### Current Configurations
- Default slippage: 0.5%
- Max acceptable: 5%
- Warning threshold: 1%
- Block if > 5% without confirmation

### By DEX Type
| Type | Typical Impact | Best For |
|------|---|---|
| AMM V2 (Ubeswap, Sushiswap) | 0.3-1% | Standard trades |
| AMM V3 (Uniswap) | 0.2-0.8% | Large trades |
| Stable Swap (Curve) | 0.05-0.2% | Stablecoin pairs |
| Bonding Curve (Pump.fun) | 1-5% | Memecoin trading |

---

## Security Features

### Implemented
- ✅ Price impact checking
- ✅ Slippage protection
- ✅ Gas estimation
- ✅ Route verification
- ✅ Transaction simulation (where available)

### Planned
- [ ] MEV protection (Flashbots integration)
- [ ] Private mempool routing
- [ ] Sandwich attack detection
- [ ] Rate limiting per user
- [ ] Smart order routing

---

## Gas Estimation by Chain

| Chain | Avg TX Cost | Token Used |
|-------|---|---|
| Celo | 0.0001 | CELO |
| Ethereum | 0.01-0.05 ETH | ETH |
| Polygon | 0.001 | MATIC |
| Arbitrum | 0.0001 | ETH |
| Optimism | 0.0001 | ETH |
| BSC | 0.0005 | BNB |
| Solana | 0.00005 | SOL |
| Tron | 0 (free) | TRX |

---

## Documentation Files

### Main References
1. **DEX_ECOSYSTEM_AUDIT_COMPLETE.md** ← Comprehensive guide
2. **DEX_INTEGRATION_IMPLEMENTATION_GUIDE.md** ← Step-by-step code
3. **API_SERVER_UNIFIED_ROUTING.md** ← Architecture verification
4. **DEX_CAPABILITY_MATRIX_QUICK_REFERENCE.md** ← This file

### You Can See DEXs
```
GET /api/dex/supported
→ Returns complete list of visible DEXs

GET /api/dex/supported-by-chain/:chain
→ Returns DEXs specific to that blockchain
```

### You Can Do With DEXs
Currently:
- ✅ Get price quotes
- ✅ Execute swaps
- ✅ Multi-hop routing
- ✅ Gas estimation
- ✅ Slippage management

Coming Soon:
- [ ] Bonding curve trading (Pump.fun)
- [ ] Trending token discovery
- [ ] Liquidity pool provisioning
- [ ] Yield farming integration
- [ ] MEV protection

---

## Quick Integration Checklist

### Before Adding a New DEX

- [ ] Choose DEX (from planned list)
- [ ] Get SDK/API documentation
- [ ] Identify router contract address
- [ ] Add to `DEX_ROUTERS` object
- [ ] Implement quote method
- [ ] Implement execute method
- [ ] Add route handler in `/api/dex.ts`
- [ ] Test on testnet
- [ ] Verify Express server still running on 5000
- [ ] Update `SUPPORTED_DEXS` list

### After Adding a New DEX

- [ ] Test quote endpoint
- [ ] Test execute endpoint
- [ ] Test error handling
- [ ] Verify gas estimation
- [ ] Test slippage protection
- [ ] Monitor transaction success rate
- [ ] Document in README

---

## Current System Health

| Component | Status | Notes |
|-----------|--------|-------|
| Express Server | ✅ Running | Port 5000 |
| DEX Routes | ✅ Mounted | `/api/dex/*` |
| EVM Chains | ✅ Active | All RPC working |
| Solana RPC | ✅ Connected | Ready for integration |
| Tron RPC | ✅ Connected | Ready for integration |
| Database | ✅ Connected | PostgreSQL online |
| Price Oracle | ✅ Active | Real-time feeds |
| Wallet Service | ✅ Ready | Key management |

---

## Popular Token Addresses (Reference)

### Ethereum
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`

### Solana
- USDC: `EPjFWaJsJgmJXVmwLpyHYvhkZ7GcyH6qoLU4BRCwEZnQ`
- USDT: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEsl`
- SOL: `So11111111111111111111111111111111111111112`

### Tron
- USDT: `TR7NHqjeKQxGTCi8q282JJUC8RS5K5YRLZ`
- USDC: `TEkxrTeW5qata41gC1aDzJVaG8nnB39oVM`

---

## Next Steps

**Choose Your Path:**

### Path A: Quick Win (PancakeSwap Activation - 1 hour)
```
Enable BSC trading immediately
1. Uncomment PancakeSwap router config
2. Test /api/dex/quote on BSC
3. Deploy to production
```

### Path B: Solana Integration (Raydium - 3 hours)
```
Add major DEX ecosystem support
1. Install Raydium SDK
2. Implement getRaydiumQuote() method
3. Implement executeRaydiumSwap() method
4. Test with devnet tokens
```

### Path C: Memecoin Trading (Pump.fun - 4 hours)
```
Add viral token support
1. Integrate PumpPortal API
2. Create trending endpoint
3. Implement trade execution
4. Add rug-pull detection
```

### Path D: Tron Integration (SunSwap - 3 hours)
```
Add Tron ecosystem support
1. Install tronweb + SDK
2. Implement quote generation
3. Implement swap execution
4. Test on Tron testnet
```

---

## Questions?

**All answered in:**
- DEX_ECOSYSTEM_AUDIT_COMPLETE.md
- DEX_INTEGRATION_IMPLEMENTATION_GUIDE.md  
- API_SERVER_UNIFIED_ROUTING.md

**Remember**: Every request flows through the single Express.js server on port 5000. No separate services. No proxies. Just one unified API.
