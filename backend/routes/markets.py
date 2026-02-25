# backend/routes/markets.py
"""
Market data API endpoints
Aggregates prices from CEX + DEX
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from models import get_db, OHLCV
from services.market_aggregator import MarketAggregator
from datetime import datetime, timedelta
import asyncio

router = APIRouter(prefix="/api/yuki/markets", tags=["markets"])
aggregator = MarketAggregator()

# ============================================================================
# MARKET SEARCH & AGGREGATION
# ============================================================================

@router.get("/search")
async def search_pair(q: str, db: Session = Depends(get_db)):
    """
    Search for a trading pair and get aggregated pricing
    
    GET /api/yuki/markets/search?q=BTC/USDT
    """
    try:
        market_data = await aggregator.get_pair_market_data(q)
        
        return {
            'status': 'success',
            'pair': q,
            'weighted_price': market_data['aggregate']['weighted_price'],
            'best_bid': market_data['aggregate']['best_bid'],
            'best_ask': market_data['aggregate']['best_ask'],
            'spread_pct': market_data['aggregate']['spread_pct'],
            'cex_price': market_data['aggregate']['cex_price'],
            'dex_price': market_data['aggregate']['dex_price'],
            'cex_liquidity': market_data['aggregate']['cex_liquidity'],
            'dex_liquidity': market_data['aggregate']['dex_liquidity'],
            'total_liquidity': market_data['aggregate']['total_liquidity'],
            'source_count': market_data['aggregate']['source_count'],
            'cex_count': market_data['aggregate']['cex_count'],
            'dex_count': market_data['aggregate']['dex_count']
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================================
# PAIR DETAIL VIEW (All Sources)
# ============================================================================

@router.get("/pairs/{pair}/detail")
async def get_pair_detail(pair: str, db: Session = Depends(get_db)):
    """
    Get detailed market info for a pair (all sources visible)
    
    GET /api/yuki/markets/pairs/BTC/USDT/detail
    """
    try:
        market_data = await aggregator.get_pair_market_data(pair)
        
        # Format CEX sources
        cex_formatted = [{
            'exchange': s['exchange'].upper(),
            'type': 'CEX',
            'price': s['price'],
            'bid': s['bid'],
            'ask': s['ask'],
            'spread_pct': s['spread_pct'],
            'volume_24h_usd': s['volume_24h_usd'],
            'liquidity_usd': s['liquidity_usd'],
            'timestamp': s['timestamp']
        } for s in market_data['cex_sources']]
        
        # Sort CEX by liquidity descending
        cex_formatted.sort(key=lambda x: x['liquidity_usd'], reverse=True)
        
        # Format DEX sources (placeholder)
        dex_formatted = market_data['dex_sources']
        
        return {
            'status': 'success',
            'pair': pair,
            'aggregated': {
                'weighted_price': market_data['aggregate']['weighted_price'],
                'best_bid': market_data['aggregate']['best_bid'],
                'best_ask': market_data['aggregate']['best_ask'],
                'spread_pct': market_data['aggregate']['spread_pct'],
                'cex_price': market_data['aggregate']['cex_price'],
                'dex_price': market_data['aggregate']['dex_price'],
                'total_liquidity': market_data['aggregate']['total_liquidity']
            },
            'cex_sources': cex_formatted,
            'dex_sources': dex_formatted
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================================
# OHLCV HISTORICAL DATA (For Charts & Backtesting)
# ============================================================================

@router.get("/ohlcv/{pair}")
async def get_ohlcv(
    pair: str,
    timeframe: str = Query("1h", description="1m, 5m, 15m, 1h, 4h, 1d"),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get historical OHLCV data for a pair
    
    GET /api/yuki/markets/ohlcv/BTC/USDT?timeframe=1h&limit=100
    """
    
    candles = db.query(OHLCV).filter(
        OHLCV.pair == pair,
        OHLCV.timeframe == timeframe
    ).order_by(OHLCV.timestamp.desc()).limit(limit).all()
    
    if not candles:
        raise HTTPException(status_code=404, detail=f"No OHLCV data for {pair}")
    
    # Reverse to get chronological order
    candles = list(reversed(candles))
    
    return {
        'status': 'success',
        'pair': pair,
        'timeframe': timeframe,
        'total_candles': len(candles),
        'data': [{
            'timestamp': c.timestamp.isoformat(),
            'open': float(c.open_price),
            'high': float(c.high_price),
            'low': float(c.low_price),
            'close': float(c.close_price),
            'volume': float(c.volume),
            'volume_quote': float(c.volume_quote),
            'trades': c.trades_count
        } for c in candles]
    }

# ============================================================================
# TRENDING PAIRS
# ============================================================================

@router.get("/trending")
async def get_trending_pairs(
    limit: int = Query(10, ge=1, le=50),
    period: str = Query("24h", description="1h, 24h, 7d"),
    db: Session = Depends(get_db)
):
    """
    Get trending pairs by volume and price change
    
    GET /api/yuki/markets/trending?limit=10&period=24h
    """
    
    # This would query from OHLCV data
    # For now, return mock trending pairs
    trending = [
        {
            'pair': 'BTC/USDT',
            'price': 42501,
            'change_24h_pct': 3.0,
            'volume_24h_usd': 1150000000,
            'volume_change_24h_pct': 15.5
        },
        {
            'pair': 'ETH/USDT',
            'price': 2350,
            'change_24h_pct': 2.8,
            'volume_24h_usd': 650000000,
            'volume_change_24h_pct': 12.0
        },
        {
            'pair': 'SOL/USDT',
            'price': 145,
            'change_24h_pct': 5.2,
            'volume_24h_usd': 320000000,
            'volume_change_24h_pct': 45.3
        },
        {
            'pair': 'PUMP/SOL',
            'price': 0.85,
            'change_24h_pct': 125.5,
            'volume_24h_usd': 85000000,
            'volume_change_24h_pct': 250.0
        },
        {
            'pair': 'USDC/USDT',
            'price': 0.9999,
            'change_24h_pct': 0.1,
            'volume_24h_usd': 450000000,
            'volume_change_24h_pct': 5.0
        }
    ]
    
    return {
        'status': 'success',
        'period': period,
        'trending': trending[:limit]
    }

# ============================================================================
# ARBITRAGE DETECTION
# ============================================================================

@router.get("/pairs/{pair}/arbitrage")
async def detect_arbitrage(
    pair: str,
    size_usd: float = Query(10000, ge=100, le=1000000),
    db: Session = Depends(get_db)
):
    """
    Detect arbitrage opportunities for a pair
    
    GET /api/yuki/markets/pairs/BTC/USDT/arbitrage?size_usd=10000
    """
    
    try:
        market_data = await aggregator.get_pair_market_data(pair)
        sources = market_data['aggregate']['sources']
        
        opportunities = []
        
        # Check all buy/sell combinations
        for buy_source in sources:
            for sell_source in sources:
                if buy_source['exchange'] == sell_source['exchange']:
                    continue
                
                profit_per_unit = sell_source['price'] - buy_source['price']
                profit_pct = (profit_per_unit / buy_source['price']) * 100
                
                if profit_pct > 0.1:  # Only show > 0.1% profit
                    opportunities.append({
                        'buy_exchange': buy_source['exchange'],
                        'buy_price': buy_source['price'],
                        'sell_exchange': sell_source['exchange'],
                        'sell_price': sell_source['price'],
                        'profit_per_unit': round(profit_per_unit, 2),
                        'profit_pct': round(profit_pct, 4),
                        'estimated_slippage_usd': size_usd * 0.005,  # Estimate 0.5% slippage
                        'net_profit_usd': (profit_per_unit / buy_source['price']) * size_usd - (size_usd * 0.005),
                        'viable': (profit_per_unit / buy_source['price']) * size_usd > (size_usd * 0.005)
                    })
        
        # Sort by profit descending
        opportunities.sort(key=lambda x: x['net_profit_usd'], reverse=True)
        
        return {
            'status': 'success',
            'pair': pair,
            'size_usd': size_usd,
            'opportunities': opportunities[:5]  # Top 5
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================================
# PAIR STATISTICS
# ============================================================================

@router.get("/pairs/{pair}/stats")
async def get_pair_stats(pair: str, period: str = "24h", db: Session = Depends(get_db)):
    """
    Get comprehensive statistics for a pair
    
    GET /api/yuki/markets/pairs/BTC/USDT/stats?period=24h
    """
    
    # Calculate period
    if period == "1h":
        days = 1/24
    elif period == "24h":
        days = 1
    elif period == "7d":
        days = 7
    else:
        days = 30
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Query OHLCV data for the period
    candles = db.query(OHLCV).filter(
        OHLCV.pair == pair,
        OHLCV.timestamp >= cutoff
    ).all()
    
    if not candles:
        raise HTTPException(status_code=404, detail=f"No data for {pair}")
    
    prices = [float(c.close_price) for c in candles]
    volumes = [float(c.volume) for c in candles]
    
    return {
        'status': 'success',
        'pair': pair,
        'period': period,
        'high': max(prices),
        'low': min(prices),
        'open': float(candles[0].open_price),
        'close': float(candles[-1].close_price),
        'change_pct': ((float(candles[-1].close_price) - float(candles[0].open_price)) / float(candles[0].open_price)) * 100,
        'avg_price': sum(prices) / len(prices),
        'total_volume': sum(volumes)
    }
