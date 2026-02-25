# backend/integrations/dexscreener_integration.py
"""
DexScreener API Integration
Handles DEX pair discovery, trending pairs, and market data
"""

from typing import Dict, List, Optional
import httpx
import asyncio
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class DexScreenerClient:
    """Client for DexScreener official REST API"""
    
    BASE_URL = "https://api.dexscreener.com"
    
    # Rate limits (as per DexScreener docs)
    RATE_LIMITS = {
        "search": 60,      # req/min
        "pairs": 300,      # req/min
        "tokens": 60,      # req/min
    }
    
    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.last_requests = {}
    
    async def search_pairs(self, query: str, chains: Optional[List[str]] = None) -> Dict:
        """
        Search for trading pairs by token name/symbol/address
        
        Args:
            query: Search query (e.g., "PUMP", "SOL", address)
            chains: Optional filter by blockchain
        
        Returns:
            List of matching pairs with metadata
        """
        
        url = f"{self.BASE_URL}/latest/dex/search"
        params = {"q": query}
        
        if chains:
            params["chains"] = ",".join(chains)
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params, timeout=self.timeout)
                response.raise_for_status()
                
                data = response.json()
                
                # Transform DexScreener format to our format
                pairs = []
                for pair in data.get("pairs", []):
                    pairs.append({
                        "pair_id": pair.get("pairAddress"),
                        "chain": pair.get("chainId"),
                        "dex": pair.get("dexId"),
                        "base_token": {
                            "address": pair.get("baseToken", {}).get("address"),
                            "name": pair.get("baseToken", {}).get("name"),
                            "symbol": pair.get("baseToken", {}).get("symbol"),
                        },
                        "quote_token": {
                            "address": pair.get("quoteToken", {}).get("address"),
                            "symbol": pair.get("quoteToken", {}).get("symbol"),
                        },
                        "price_usd": float(pair.get("priceUsd", 0)),
                        "liquidity_usd": float(pair.get("liquidity", {}).get("usd", 0)),
                        "volume_24h_usd": float(pair.get("volume", {}).get("h24", 0)),
                        "price_change_24h": float(pair.get("priceChange", {}).get("h24", 0)),
                        "transactions_24h": pair.get("txns", {}).get("h24", {}),
                        "market_cap": float(pair.get("marketCap", 0)) if pair.get("marketCap") else None,
                        "fdv": float(pair.get("fdv", 0)) if pair.get("fdv") else None,
                    })
                
                return {
                    "status": "success",
                    "total": len(pairs),
                    "pairs": pairs
                }
                
            except httpx.HTTPError as e:
                logger.error(f"DexScreener search error: {e}")
                return {
                    "status": "error",
                    "error": f"Failed to search pairs: {str(e)}"
                }
    
    async def get_pair(self, chain: str, pair_address: str) -> Dict:
        """
        Get detailed information for a specific pair
        
        Args:
            chain: Blockchain ID (solana, ethereum, base, etc.)
            pair_address: Pair contract address
        
        Returns:
            Detailed pair information
        """
        
        url = f"{self.BASE_URL}/latest/dex/pairs/{chain}/{pair_address}"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=self.timeout)
                response.raise_for_status()
                
                data = response.json()
                pair = data.get("pair")
                
                if not pair:
                    return {"status": "error", "error": "Pair not found"}
                
                return {
                    "status": "success",
                    "pair": {
                        "pair_id": pair.get("pairAddress"),
                        "chain": pair.get("chainId"),
                        "dex": pair.get("dexId"),
                        "base_token": {
                            "address": pair.get("baseToken", {}).get("address"),
                            "name": pair.get("baseToken", {}).get("name"),
                            "symbol": pair.get("baseToken", {}).get("symbol"),
                            "decimals": pair.get("baseToken", {}).get("decimals"),
                        },
                        "quote_token": {
                            "address": pair.get("quoteToken", {}).get("address"),
                            "symbol": pair.get("quoteToken", {}).get("symbol"),
                        },
                        "price_usd": float(pair.get("priceUsd", 0)),
                        "price_native": float(pair.get("priceNative", 0)),
                        "liquidity": {
                            "usd": float(pair.get("liquidity", {}).get("usd", 0)),
                            "base": float(pair.get("liquidity", {}).get("base", 0)),
                            "quote": float(pair.get("liquidity", {}).get("quote", 0)),
                        },
                        "volume": {
                            "h1": float(pair.get("volume", {}).get("h1", 0)),
                            "h6": float(pair.get("volume", {}).get("h6", 0)),
                            "h24": float(pair.get("volume", {}).get("h24", 0)),
                        },
                        "price_change": {
                            "m5": float(pair.get("priceChange", {}).get("m5", 0)),
                            "h1": float(pair.get("priceChange", {}).get("h1", 0)),
                            "h6": float(pair.get("priceChange", {}).get("h6", 0)),
                            "h24": float(pair.get("priceChange", {}).get("h24", 0)),
                        },
                        "transactions": {
                            "h1": pair.get("txns", {}).get("h1", {}),
                            "h6": pair.get("txns", {}).get("h6", {}),
                            "h24": pair.get("txns", {}).get("h24", {}),
                        },
                        "market_cap": float(pair.get("marketCap", 0)) if pair.get("marketCap") else None,
                        "fdv": float(pair.get("fdv", 0)) if pair.get("fdv") else None,
                        "website": pair.get("website"),
                        "twitter": pair.get("twitter"),
                        "telegram": pair.get("telegram"),
                        "discord": pair.get("discord"),
                    }
                }
                
            except httpx.HTTPError as e:
                logger.error(f"DexScreener pair fetch error: {e}")
                return {
                    "status": "error",
                    "error": f"Failed to fetch pair: {str(e)}"
                }
    
    async def get_token_pairs(self, chain: str, token_address: str) -> Dict:
        """
        Get all trading pairs for a specific token
        
        Args:
            chain: Blockchain ID
            token_address: Token contract address
        
        Returns:
            List of all pairs for this token
        """
        
        url = f"{self.BASE_URL}/token-pairs/v1/{chain}/{token_address}"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=self.timeout)
                response.raise_for_status()
                
                data = response.json()
                
                pairs = []
                for pair in data.get("pairs", []):
                    pairs.append({
                        "pair_id": pair.get("pairAddress"),
                        "dex": pair.get("dexId"),
                        "chain": pair.get("chainId"),
                        "quote_token": pair.get("quoteToken", {}).get("symbol"),
                        "price_usd": float(pair.get("priceUsd", 0)),
                        "liquidity_usd": float(pair.get("liquidity", {}).get("usd", 0)),
                        "volume_24h": float(pair.get("volume", {}).get("h24", 0)),
                        "transactions_24h": pair.get("txns", {}).get("h24", {}),
                    })
                
                return {
                    "status": "success",
                    "total": len(pairs),
                    "pairs": pairs
                }
                
            except httpx.HTTPError as e:
                logger.error(f"DexScreener token pairs error: {e}")
                return {
                    "status": "error",
                    "error": f"Failed to fetch token pairs: {str(e)}"
                }


class TrendingPairsFinder:
    """Find trending pairs based on configurable criteria"""
    
    def __init__(self, client: DexScreenerClient):
        self.client = client
    
    async def find_trending(
        self,
        chain: str = "solana",
        min_liquidity: float = 10000,
        min_volume_24h: float = 50000,
        min_transactions: int = 100,
        price_change_threshold: float = 5.0,
        limit: int = 50
    ) -> Dict:
        """
        Find trending pairs matching criteria
        
        Args:
            chain: Blockchain to search
            min_liquidity: Minimum liquidity in USD
            min_volume_24h: Minimum 24h volume in USD
            min_transactions: Minimum 24h transaction count
            price_change_threshold: Minimum 24h price change %
            limit: Max results to return
        
        Returns:
            Sorted list of trending pairs
        """
        
        # Search for pairs (using wildcard to get popular ones)
        search_result = await self.client.search_pairs("*", [chain])
        
        if search_result["status"] != "success":
            return search_result
        
        trending = []
        
        for pair in search_result["pairs"]:
            # Apply filters
            if pair["liquidity_usd"] < min_liquidity:
                continue
            if pair["volume_24h_usd"] < min_volume_24h:
                continue
            
            txns_24h = pair["transactions_24h"]
            if (txns_24h.get("buys", 0) + txns_24h.get("sells", 0)) < min_transactions:
                continue
            
            if abs(pair["price_change_24h"]) < price_change_threshold:
                continue
            
            trending.append(pair)
        
        # Sort by volume descending
        trending = sorted(trending, key=lambda x: x["volume_24h_usd"], reverse=True)
        
        return {
            "status": "success",
            "total": len(trending),
            "trending": trending[:limit],
            "filters": {
                "chain": chain,
                "min_liquidity": min_liquidity,
                "min_volume_24h": min_volume_24h,
                "min_transactions": min_transactions,
                "price_change_threshold": price_change_threshold,
            }
        }
