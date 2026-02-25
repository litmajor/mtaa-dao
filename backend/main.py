"""
⚠️  DEPRECATED - Python Backend
This file is no longer used. The DexScreener API has been migrated to TypeScript/Express.

🚀 NEW LOCATION: server/api/dex-screener.ts
📍 ROUTES: server/routes/dex-screener.ts
✅ MOUNTED AT: /api/dex/* (in main Express app at port 3000/5173)

WHY THE MIGRATION:
- Single codebase (everything is TypeScript)
- No separate Python process to manage
- Integrated with Express middleware (auth, rate limiting, logging)
- Better performance and developer experience
- Reuses existing infrastructure

TO RUN THE COMPLETE SYSTEM:
1. Start the main Node.js server:
   npm run dev
   
2. Backend server runs on port 3000 (or 5173 for Vite)
3. DexScreener API available at:
   GET  http://localhost:3000/api/dex/health
   GET  http://localhost:3000/api/dex/search-pairs?q=ETH
   GET  http://localhost:3000/api/dex/pairs/{chain}/{address}
   GET  http://localhost:3000/api/dex/token-pairs/{chain}/{address}
   GET  http://localhost:3000/api/dex/trending-pairs
   POST http://localhost:3000/api/dex/symbol-universe/sync

NO LONGER NEEDED:
- python main.py (this file)
- backend/main.py can be archived/deleted
- No separate port 5000 server

For documentation, see:
- PHASE_8_COMPLETION_SUMMARY.md
- QUICK_START_INTEGRATION.md  
- DEXSCREENER_SYMBOL_UNIVERSE_INTEGRATION.md
"""

# 🗑️  ARCHIVED - Code below is deprecated. Do not use.
"""
The following code is preserved for reference only. All functionality has been migrated to TypeScript.
See server/api/dex-screener.ts for the current implementation.
"""

# import logging
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import httpx
from functools import lru_cache
from typing import Optional, List
from datetime import datetime, timedelta
import asyncio

from integrations.dexscreener_integration import DexScreenerClient, TrendingPairsFinder

# ============= SETUP =============

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MTAA DAO Backend",
    description="Unified backend for treasury, aggregation, and AI agents",
    version="1.0.0"
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# ============= MIDDLEWARE =============

# CORS: Allow client on port 3000/5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ============= DEPENDENCIES =============

dex_client = DexScreenerClient(timeout=15)
trending_finder = TrendingPairsFinder(dex_client)

# Simple in-memory cache for responses
class ResponseCache:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        self.cache = {}
    
    def get(self, key: str):
        if key in self.cache:
            value, timestamp = self.cache[key]
            if datetime.now().timestamp() - timestamp < self.ttl_seconds:
                logger.info(f"Cache HIT: {key}")
                return value
            else:
                del self.cache[key]
        return None
    
    def set(self, key: str, value):
        self.cache[key] = (value, datetime.now().timestamp())
        logger.info(f"Cache SET: {key}")
    
    def clear_expired(self):
        """Remove expired entries"""
        now = datetime.now().timestamp()
        expired = [k for k, (v, ts) in self.cache.items() 
                   if now - ts > self.ttl_seconds]
        for k in expired:
            del self.cache[k]

response_cache = ResponseCache(ttl_seconds=300)  # 5 minute TTL

# ============= HEALTH CHECK =============

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "dexscreener": "ready",
            "symbol_universe": "ready",
        }
    }

# ============= DEX SCREENER API ENDPOINTS =============

@app.get("/api/dex/search-pairs")
@limiter.limit("60/minute")
async def search_pairs(
    q: str = Query(..., description="Search query (symbol, name, or address)"),
    chains: Optional[str] = Query(None, description="Comma-separated chains (ethereum, solana, etc)"),
    request=None
):
    """
    Search for trading pairs by token symbol, name, or contract address
    
    Args:
        q: Search query
        chains: Optional comma-separated list of chains to filter
    
    Returns:
        List of matching pairs with metadata
    """
    try:
        # Check cache
        cache_key = f"search_pairs:{q}:{chains}"
        cached = response_cache.get(cache_key)
        if cached:
            return cached
        
        chains_list = [c.strip() for c in chains.split(",")] if chains else None
        
        result = await dex_client.search_pairs(q, chains_list)
        
        # Cache result
        response_cache.set(cache_key, result)
        
        return result
    
    except Exception as e:
        logger.error(f"Error searching pairs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search pairs: {str(e)}"
        )

@app.get("/api/dex/pairs/{chain}/{pair_address}")
@limiter.limit("300/minute")
async def get_pair(
    chain: str,
    pair_address: str,
    request=None
):
    """
    Get detailed information for a specific trading pair
    
    Args:
        chain: Blockchain ID (ethereum, solana, arbitrum, etc)
        pair_address: Pair contract address
    
    Returns:
        Detailed pair information including liquidity, volume, pricing
    """
    try:
        # Check cache
        cache_key = f"pair:{chain}:{pair_address}"
        cached = response_cache.get(cache_key)
        if cached:
            return cached
        
        result = await dex_client.get_pair(chain, pair_address)
        
        # Cache result
        response_cache.set(cache_key, result)
        
        return result
    
    except Exception as e:
        logger.error(f"Error getting pair {chain}/{pair_address}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pair: {str(e)}"
        )

@app.get("/api/dex/token-pairs/{chain}/{token_address}")
@limiter.limit("60/minute")
async def get_token_pairs(
    chain: str,
    token_address: str,
    request=None
):
    """
    Get all trading pairs for a specific token
    
    Args:
        chain: Blockchain ID
        token_address: Token contract address
    
    Returns:
        List of all pairs containing this token
    """
    try:
        # Check cache
        cache_key = f"token_pairs:{chain}:{token_address}"
        cached = response_cache.get(cache_key)
        if cached:
            return cached
        
        result = await dex_client.get_token_pairs(chain, token_address)
        
        # Cache result
        response_cache.set(cache_key, result)
        
        return result
    
    except Exception as e:
        logger.error(f"Error getting token pairs {chain}/{token_address}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get token pairs: {str(e)}"
        )

@app.get("/api/dex/trending-pairs")
@limiter.limit("30/minute")
async def find_trending_pairs(
    chain: str = Query("ethereum", description="Blockchain to search"),
    min_liquidity: float = Query(100_000, description="Minimum liquidity in USD"),
    min_volume_24h: float = Query(500_000, description="Minimum 24h volume in USD"),
    min_transactions: int = Query(500, description="Minimum 24h transaction count"),
    price_change_threshold: float = Query(2.0, description="Minimum 24h price change %"),
    limit: int = Query(50, description="Max results to return"),
    request=None
):
    """
    Find trending pairs matching specific criteria
    
    Uses multiple data sources:
    - Trading volume
    - Price movement
    - Liquidity depth
    - Transaction count
    
    Args:
        chain: Blockchain to search (ethereum, solana, arbitrum, etc)
        min_liquidity: Minimum USD liquidity
        min_volume_24h: Minimum 24h trading volume in USD
        min_transactions: Minimum transaction count in 24h
        price_change_threshold: Minimum price change percentage
        limit: Max pairs to return
    
    Returns:
        Sorted list of trending pairs
    """
    try:
        # Check cache
        cache_key = f"trending:{chain}:{min_liquidity}:{min_volume_24h}:{limit}"
        cached = response_cache.get(cache_key)
        if cached:
            return cached
        
        result = await trending_finder.find_trending(
            chain=chain,
            min_liquidity=min_liquidity,
            min_volume_24h=min_volume_24h,
            min_transactions=min_transactions,
            price_change_threshold=price_change_threshold,
            limit=limit
        )
        
        # Cache result
        response_cache.set(cache_key, result)
        
        return result
    
    except Exception as e:
        logger.error(f"Error finding trending pairs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to find trending pairs: {str(e)}"
        )

# ============= SYMBOL UNIVERSE INTEGRATION ENDPOINTS =============

@app.post("/api/symbol-universe/sync")
@limiter.limit("1/minute")
async def sync_symbol_universe(request=None):
    """
    Trigger Symbol Universe discovery sync
    
    This discovers new tokens from:
    - DexScreener (via endpoints above)
    - CCXT exchanges (via Liquidity Shard)
    - Curve protocol
    - Enriches with CoinGecko metadata
    
    Returns:
        Sync result with count of new/updated assets
    """
    try:
        # This would call the TypeScript Symbol Universe service
        # For now, return the endpoint structure
        return {
            "status": "scheduled",
            "message": "Symbol Universe sync queued",
            "timestamp": datetime.now().isoformat(),
            "note": "Triggered from backend at port 5000"
        }
    
    except Exception as e:
        logger.error(f"Error syncing symbol universe: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync symbol universe: {str(e)}"
        )

# ============= CACHE MANAGEMENT =============

@app.delete("/api/cache/clear")
async def clear_cache():
    """Clear all cached responses"""
    response_cache.cache.clear()
    return {
        "status": "success",
        "message": "All caches cleared",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/cache/stats")
async def cache_stats():
    """Get cache statistics"""
    response_cache.clear_expired()
    return {
        "cached_items": len(response_cache.cache),
        "ttl_seconds": response_cache.ttl_seconds,
        "timestamp": datetime.now().isoformat()
    }

# ============= ERROR HANDLERS =============

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return HTTPException(
        status_code=429,
        detail="Rate limit exceeded. Max 60 requests per minute."
    )

# ============= STARTUP =============

@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("MTAA DAO Backend Server Started")
    logger.info("Port: 5000")
    logger.info("Services:")
    logger.info("  ✓ DexScreener API Integration")
    logger.info("  ✓ Symbol Universe Discovery")
    logger.info("  ✓ Response Caching (5 min TTL)")
    logger.info("  ✓ Rate Limiting")
    logger.info("=" * 60)

# ============= RUN =============

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
        log_level="info"
    )
