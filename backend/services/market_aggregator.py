# backend/services/market_aggregator.py
"""
Market data aggregation service
Combines CEX prices (CCXT) + DEX prices (DexScreener)
"""

import ccxt
from typing import List, Dict, Optional
from decimal import Decimal
from datetime import datetime
import asyncio

class MarketAggregator:
    def __init__(self):
        # Initialize CEX exchanges - 8 major global exchanges
        self.binance = ccxt.binance()
        self.coinbase = ccxt.coinbase()
        self.kraken = ccxt.kraken()
        self.gatedio = ccxt.gatedio()
        self.okx = ccxt.okx()
        self.bybit = ccxt.bybit()
        self.kucoin = ccxt.kucoin()
        self.bitget = ccxt.bitget()
        
        self.exchanges = {
            'binance': self.binance,
            'coinbase': self.coinbase,
            'kraken': self.kraken,
            'gatedio': self.gatedio,
            'okx': self.okx,
            'bybit': self.bybit,
            'kucoin': self.kucoin,
            'bitget': self.bitget
        }
    
    async def get_cex_prices(self, pair: str) -> List[Dict]:
        """
        Fetch prices from all CEX exchanges
        
        Args:
            pair: e.g., 'BTC/USDT'
        
        Returns:
            List of price data from each exchange
        """
        cex_prices = []
        
        tasks = [
            self._fetch_from_exchange(exchange_name, exchange, pair)
            for exchange_name, exchange in self.exchanges.items()
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, dict):
                cex_prices.append(result)
        
        return cex_prices
    
    async def _fetch_from_exchange(self, exchange_name: str, exchange, pair: str) -> Optional[Dict]:
        """
        Fetch from single exchange
        
        🔴 CCXT API CALL LOCATIONS #2 & #3 (Python)
        - fetch_ticker(pair): Gets last price, bid, ask, volume
        - fetch_order_book(pair, limit=5): Gets order book depth data
        See: CCXT_API_CALL_MAPPING.md for redundancy analysis & optimization
        """
        try:
            ticker = exchange.fetch_ticker(pair)
            order_book = exchange.fetch_order_book(pair, limit=5)
            
            return {
                'type': 'CEX',
                'exchange': exchange_name,
                'pair': pair,
                'price': float(ticker['last']),
                'bid': float(order_book['bids'][0][0]) if order_book['bids'] else float(ticker['bid']),
                'ask': float(order_book['asks'][0][0]) if order_book['asks'] else float(ticker['ask']),
                'volume_24h_usd': float(ticker.get('quoteVolume', 0) * ticker['last']),
                'liquidity_usd': float(sum(b[1] * b[0] for b in order_book['bids'][:5])),
                'spread_pct': ((float(order_book['asks'][0][0]) - float(order_book['bids'][0][0])) / float(order_book['bids'][0][0])) * 100 if order_book['bids'] and order_book['asks'] else 0,
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            print(f"Error fetching from {exchange_name}: {e}")
            return None
    
    async def get_dex_prices(self, pair: str) -> List[Dict]:
        """
        Fetch prices from DEX via DexScreener
        
        Note: This requires DexScreener API knowledge for the specific pair
        For now, return mock data. In production, integrate with:
        - Uniswap V3 subgraph
        - DexScreener API
        - On-chain RPC calls
        """
        # This would require proper DEX pair addresses
        # For now, returning structure
        dex_prices = [
            {
                'type': 'DEX',
                'chain': 'ethereum',
                'dex': 'uniswap_v3',
                'pair': pair,
                'price': None,  # Would be fetched from Uniswap V3 subgraph
                'liquidity_usd': None,
                'slippage_10_pct': None
            },
            {
                'type': 'DEX',
                'chain': 'solana',
                'dex': 'raydium',
                'pair': pair,
                'price': None,
                'liquidity_usd': None,
                'slippage_10_pct': None
            }
        ]
        
        return dex_prices
    
    def calculate_aggregate_price(self, sources: List[Dict]) -> Dict:
        """
        Calculate volume-weighted average price and key metrics
        """
        # Filter valid sources with minimum liquidity
        valid_sources = [
            s for s in sources 
            if s.get('liquidity_usd', 0) >= 100000 and s.get('price')
        ]
        
        if not valid_sources:
            return {'error': 'No valid price sources'}
        
        # Separate CEX and DEX
        cex_sources = [s for s in valid_sources if s['type'] == 'CEX']
        dex_sources = [s for s in valid_sources if s['type'] == 'DEX']
        
        # Calculate weighted prices
        total_liquidity = sum(s['liquidity_usd'] for s in valid_sources)
        
        weighted_price = sum(
            s['price'] * (s['liquidity_usd'] / total_liquidity)
            for s in valid_sources
        )
        
        # CEX weighted average
        if cex_sources:
            cex_liquidity = sum(s['liquidity_usd'] for s in cex_sources)
            cex_price = sum(
                s['price'] * (s['liquidity_usd'] / cex_liquidity)
                for s in cex_sources
            )
        else:
            cex_price = None
            cex_liquidity = 0
        
        # DEX weighted average
        if dex_sources:
            dex_liquidity = sum(s['liquidity_usd'] for s in dex_sources)
            dex_price = sum(
                s['price'] * (s['liquidity_usd'] / dex_liquidity)
                for s in dex_sources
            )
        else:
            dex_price = None
            dex_liquidity = 0
        
        # Best bid/ask
        best_bid = max(s['bid'] for s in cex_sources) if cex_sources else None
        best_ask = min(s['ask'] for s in cex_sources) if cex_sources else None
        
        return {
            'weighted_price': round(weighted_price, 2),
            'best_bid': best_bid,
            'best_ask': best_ask,
            'spread_pct': ((best_ask - best_bid) / best_bid * 100) if best_bid and best_ask else None,
            'cex_price': round(cex_price, 2) if cex_price else None,
            'dex_price': round(dex_price, 2) if dex_price else None,
            'cex_liquidity': cex_liquidity,
            'dex_liquidity': dex_liquidity,
            'total_liquidity': total_liquidity,
            'source_count': len(valid_sources),
            'cex_count': len(cex_sources),
            'dex_count': len(dex_sources),
            'sources': valid_sources
        }
    
    async def get_pair_market_data(self, pair: str) -> Dict:
        """
        Main method: Get aggregated market data for a pair
        """
        # Fetch from CEX and DEX in parallel
        cex_prices = await self.get_cex_prices(pair)
        dex_prices = await self.get_dex_prices(pair)
        
        all_sources = cex_prices + dex_prices
        
        # Calculate aggregates
        aggregate = self.calculate_aggregate_price(all_sources)
        
        return {
            'pair': pair,
            'timestamp': datetime.utcnow().isoformat(),
            'aggregate': aggregate,
            'cex_sources': cex_prices,
            'dex_sources': dex_prices
        }
