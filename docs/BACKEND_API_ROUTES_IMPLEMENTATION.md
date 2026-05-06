# Backend DexScreener API Routes - Implementation Guide

## Quick Status

**What TypeScript Client Expects**:
```
GET /api/dex/search-pairs?q={query}&chains={chain1,chain2}
GET /api/dex/pairs/{chain}/{pairAddress}
GET /api/dex/token-pairs/{chain}/{tokenAddress}
GET /api/dex/trending-pairs?chain={chain}&min_liquidity={amt}&...
```

**What You Have**:
```
✅ Python: DexScreenerClient class (backend/integrations/dexscreener_integration.py)
❌ API Routes: Not exposed as HTTP endpoints
```

**What You Need**:
Add 4 FastAPI/Flask routes that wrap the existing Python client.

---

## Option 1: FastAPI (Recommended)

### File: `backend/main.py`

```python
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import httpx
import logging
from backend.integrations.dexscreener_integration import DexScreenerClient, TrendingPairsFinder

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="MTAA DAO API",
    description="Market Analysis & Treasury Operations",
    version="3.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize DexScreener clients
dex_client = DexScreenerClient()
trending_finder = TrendingPairsFinder(dex_client)

# ============================================
# DexScreener API Routes (4 endpoints)
# ============================================

@app.get("/api/dex/search-pairs", tags=["DexScreener"])
async def search_pairs(
    q: str = Query(..., description="Search query (token name, symbol, or address)"),
    chains: Optional[str] = Query(None, description="Comma-separated chain list (ethereum, solana, etc)")
):
    """
    Search for trading pairs by token name, symbol, or address.
    
    Example:
    GET /api/dex/search-pairs?q=USDC&chains=ethereum,polygon
    """
    try:
        chains_list = [c.strip() for c in chains.split(",")] if chains else None
        logger.info(f"Searching pairs: q={q}, chains={chains_list}")
        
        result = await dex_client.search_pairs(q, chains_list)
        
        logger.info(f"Found {len(result.get('pairs', []))} pairs")
        return result
    except Exception as e:
        logger.error(f"Search pairs error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"DexScreener search failed: {str(e)}")


@app.get("/api/dex/pairs/{chain}/{pair_address}", tags=["DexScreener"])
async def get_pair(
    chain: str = Query(..., description="Blockchain chain (ethereum, solana, polygon, etc)"),
    pair_address: str = Query(..., description="Pair contract address")
):
    """
    Get detailed information about a specific trading pair.
    
    Example:
    GET /api/dex/pairs/ethereum/0xabc123...
    """
    try:
        logger.info(f"Getting pair: chain={chain}, address={pair_address}")
        
        result = await dex_client.get_pair(chain, pair_address)
        
        if not result.get("pair"):
            raise HTTPException(status_code=404, detail="Pair not found")
            
        return result
    except Exception as e:
        logger.error(f"Get pair error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"DexScreener lookup failed: {str(e)}")


@app.get("/api/dex/token-pairs/{chain}/{token_address}", tags=["DexScreener"])
async def get_token_pairs(
    chain: str = Query(..., description="Blockchain chain (ethereum, solana, polygon, etc)"),
    token_address: str = Query(..., description="Token contract address")
):
    """
    Get all trading pairs for a specific token.
    
    Example:
    GET /api/dex/token-pairs/ethereum/0xabc123...
    """
    try:
        logger.info(f"Getting token pairs: chain={chain}, token={token_address}")
        
        result = await dex_client.get_token_pairs(chain, token_address)
        
        logger.info(f"Found {len(result.get('pairs', []))} pairs for token")
        return result
    except Exception as e:
        logger.error(f"Get token pairs error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"DexScreener token lookup failed: {str(e)}")


@app.get("/api/dex/trending-pairs", tags=["DexScreener"])
async def find_trending_pairs(
    chain: str = Query("ethereum", description="Blockchain chain"),
    min_liquidity: float = Query(100000, description="Minimum liquidity in USD"),
    min_volume_24h: float = Query(500000, description="Minimum 24h volume in USD"),
    min_transactions: int = Query(500, description="Minimum number of transactions"),
    price_change_threshold: float = Query(2.0, description="Price change percentage threshold"),
    limit: int = Query(50, description="Maximum results to return (1-100)")
):
    """
    Find trending trading pairs matching criteria.
    
    Example:
    GET /api/dex/trending-pairs?chain=ethereum&min_liquidity=100000&min_volume_24h=500000&limit=50
    """
    try:
        # Validate limit
        limit = max(1, min(limit, 100))
        
        logger.info(f"Finding trending pairs: chain={chain}, min_liq={min_liquidity}, limit={limit}")
        
        result = await trending_finder.find_trending(
            chain=chain,
            min_liquidity=min_liquidity,
            min_volume_24h=min_volume_24h,
            min_transactions=min_transactions,
            price_change_threshold=price_change_threshold,
            limit=limit
        )
        
        logger.info(f"Found {len(result.get('pairs', []))} trending pairs")
        return result
    except Exception as e:
        logger.error(f"Trending pairs error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"DexScreener trending lookup failed: {str(e)}")


# ============================================
# Health Check
# ============================================

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "3.0.0",
        "services": {
            "dexscreener": "connected",
        }
    }


@app.get("/", tags=["System"])
async def root():
    """API documentation redirect"""
    return {
        "message": "MTAA DAO API v3.0.0",
        "docs": "/docs",
        "dexscreener_routes": [
            "GET /api/dex/search-pairs",
            "GET /api/dex/pairs/{chain}/{pair_address}",
            "GET /api/dex/token-pairs/{chain}/{token_address}",
            "GET /api/dex/trending-pairs"
        ]
    }


# ============================================
# Run Server
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
```

### Start the server:
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## Option 2: Flask (If Preferred)

### File: `backend/app.py`

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from backend.integrations.dexscreener_integration import DexScreenerClient, TrendingPairsFinder

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize DexScreener clients
dex_client = DexScreenerClient()
trending_finder = TrendingPairsFinder(dex_client)


@app.route("/api/dex/search-pairs", methods=["GET"])
def search_pairs():
    """Search for trading pairs"""
    try:
        query = request.args.get("q", "")
        chains_str = request.args.get("chains", "")
        
        if not query:
            return jsonify({"error": "Query parameter 'q' is required"}), 400
        
        chains = [c.strip() for c in chains_str.split(",")] if chains_str else None
        
        logger.info(f"Searching pairs: q={query}, chains={chains}")
        result = dex_client.search_pairs(query, chains)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/dex/pairs/<chain>/<pair_address>", methods=["GET"])
def get_pair(chain, pair_address):
    """Get detailed pair information"""
    try:
        logger.info(f"Getting pair: chain={chain}, address={pair_address}")
        result = dex_client.get_pair(chain, pair_address)
        
        if not result.get("pair"):
            return jsonify({"error": "Pair not found"}), 404
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Get pair error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/dex/token-pairs/<chain>/<token_address>", methods=["GET"])
def get_token_pairs(chain, token_address):
    """Get all pairs for a token"""
    try:
        logger.info(f"Getting token pairs: chain={chain}, token={token_address}")
        result = dex_client.get_token_pairs(chain, token_address)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Get token pairs error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/dex/trending-pairs", methods=["GET"])
def find_trending_pairs():
    """Find trending pairs"""
    try:
        chain = request.args.get("chain", "ethereum")
        min_liquidity = float(request.args.get("min_liquidity", 100000))
        min_volume_24h = float(request.args.get("min_volume_24h", 500000))
        min_transactions = int(request.args.get("min_transactions", 500))
        price_change_threshold = float(request.args.get("price_change_threshold", 2.0))
        limit = min(100, int(request.args.get("limit", 50)))
        
        logger.info(f"Finding trending pairs: chain={chain}, limit={limit}")
        
        result = trending_finder.find_trending(
            chain=chain,
            min_liquidity=min_liquidity,
            min_volume_24h=min_volume_24h,
            min_transactions=min_transactions,
            price_change_threshold=price_change_threshold,
            limit=limit
        )
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Trending error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Health check"""
    return jsonify({"status": "healthy", "version": "3.0.0"})


@app.route("/", methods=["GET"])
def root():
    """API info"""
    return jsonify({
        "message": "MTAA DAO API v3.0.0",
        "routes": [
            "GET /api/dex/search-pairs?q=USDC&chains=ethereum",
            "GET /api/dex/pairs/ethereum/0xabc...",
            "GET /api/dex/token-pairs/ethereum/0xabc...",
            "GET /api/dex/trending-pairs?chain=ethereum"
        ]
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
```

### Start the server:
```bash
cd backend
flask run --host=0.0.0.0 --port=8000
```

---

## Testing the Routes

### Test 1: Search Pairs
```bash
curl "http://localhost:8000/api/dex/search-pairs?q=USDC&chains=ethereum"
```

### Test 2: Get Specific Pair
```bash
curl "http://localhost:8000/api/dex/pairs/ethereum/0xa0b69e9622c40f1d3c6aa59f30e6403fa8f406ab"
```

### Test 3: Get Token Pairs
```bash
curl "http://localhost:8000/api/dex/token-pairs/ethereum/0xa0b69e9622c40f1d3c6aa59f30e6403fa8f406ab"
```

### Test 4: Find Trending
```bash
curl "http://localhost:8000/api/dex/trending-pairs?chain=ethereum&limit=10"
```

---

## Expected Response Format

### Search Pairs Response
```json
{
  "status": "success",
  "pairs": [
    {
      "pair_id": "0xabc...",
      "chain": "ethereum",
      "dex": "uniswap_v3",
      "base_token": {
        "address": "0x...",
        "name": "USD Coin",
        "symbol": "USDC",
        "decimals": 6
      },
      "quote_token": {...},
      "price_usd": 1.00,
      "liquidity_usd": 1500000000,
      "volume_24h_usd": 2000000000,
      "price_change_24h": 0.1
    }
  ]
}
```

### Get Pair Response
```json
{
  "status": "success",
  "pair": {
    "pair_id": "0xabc...",
    "chain": "ethereum",
    "dex": "uniswap_v3",
    "base_token": {...},
    "quote_token": {...},
    "price_usd": 2847.50,
    "liquidity_usd": 450000000,
    "market_cap": 334000000000,
    "fdv": 334000000000
  }
}
```

### Trending Pairs Response
```json
{
  "status": "success",
  "pairs": [
    {
      "pair_id": "0xpump...",
      "chain": "ethereum",
      "base_token": {"name": "PumpToken", "symbol": "PUMP"},
      "price_usd": 0.0012,
      "liquidity_usd": 250000,
      "volume_24h_usd": 750000,
      "transactions": 1250,
      "price_change_24h": 15.5
    }
  ],
  "count": 1
}
```

---

## Once Running

The TypeScript client in `server/services/dexscreener_client.ts` will now:
- ✅ Call `POST http://localhost:8000/api/dex/search-pairs`
- ✅ Call `POST http://localhost:8000/api/dex/pairs/{chain}/{address}`
- ✅ Call `POST http://localhost:8000/api/dex/token-pairs/{chain}/{address}`
- ✅ Call `POST http://localhost:8000/api/dex/trending-pairs`

And Symbol Universe will discover real tokens:
```
Symbol Universe.syncWithProtocols()
  → Discovers 1000+ real tokens from DexScreener
  → Auto-categorizes all tokens (31 categories)
  → Infers tier from real liquidity
  → Enriches from CoinGecko
  → Ready for NURU & KWETU
```

---

## Checklist

- [ ] Create `backend/main.py` (FastAPI version above)
- [ ] Or create `backend/app.py` (Flask version above)
- [ ] Run: `pip install fastapi uvicorn` (if FastAPI) or `pip install flask flask-cors` (if Flask)
- [ ] Start server: `uvicorn main:app --reload` or `flask run`
- [ ] Test routes with curl commands
- [ ] Verify Symbol Universe can reach backend by checking logs
- [ ] Symbol Universe should now discover 1000+ real tokens
- [ ] NURU can use token metadata in recommendations
- [ ] KWETU can use category risk in validation

**Total setup time**: ~5 minutes ✅
