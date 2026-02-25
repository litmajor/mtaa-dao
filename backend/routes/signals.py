# backend/routes/signals.py
"""
Trading Signals API Routes
Handles signal webhook reception, Telegram broadcasting, and distribution
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional, Dict
from datetime import datetime
import logging

from ..services.signal_dispatcher import SignalManager, TelegramSignalBroadcaster

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/yuki/signals", tags=["signals"])

# Initialize signal manager (in production: inject via dependency)
broadcaster = TelegramSignalBroadcaster(bot_token="YOUR_BOT_TOKEN", channel_id="YOUR_CHANNEL_ID")
signal_manager = SignalManager(telegram_broadcaster=broadcaster)


@router.post("")
async def receive_signal(
    signal: Dict,
    x_api_key: str = Header(None)
):
    """
    Receive trading signal from strategy
    
    Broadcasts to Telegram and notifies subscribers
    
    Expected payload:
    {
        "signal_id": "unique_id",
        "timestamp": 1707000000,
        "strategy": "strategy_name",
        "action": "long|short|close|tp1|tp2|tp3",
        "market": {...},
        "pricing": {...},
        "sizing": {...},
        "confidence": {...},
        "metadata": {...}
    }
    """
    
    # 1. Validate API key
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    
    # TODO: Verify API key against database
    # if not verify_api_key(x_api_key):
    #     raise HTTPException(status_code=401, detail="Invalid API key")
    
    # 2. Process signal
    try:
        result = await signal_manager.receive_signal(signal)
        
        if result["status"] == "success":
            return result
        else:
            raise HTTPException(status_code=400, detail=result.get("error"))
            
    except Exception as e:
        logger.error(f"Signal processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_signal_history(
    strategy_id: Optional[str] = None,
    limit: int = 100
):
    """
    Get signal history
    
    Returns list of signals received
    """
    
    try:
        result = await signal_manager.get_signal_history(
            strategy_id=strategy_id,
            limit=limit
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{signal_id}")
async def get_signal(signal_id: str):
    """Get specific signal details"""
    
    try:
        result = await signal_manager.get_signal(signal_id)
        
        if result["status"] == "success":
            return result
        else:
            raise HTTPException(status_code=404, detail="Signal not found")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{signal_id}/executed")
async def mark_signal_executed(
    signal_id: str,
    execution_data: Dict
):
    """Mark signal as executed"""
    
    try:
        result = await signal_manager.execute_signal(signal_id, execution_data)
        
        if result["status"] == "success":
            return result
        else:
            raise HTTPException(status_code=404, detail="Signal not found")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/summary")
async def get_signal_stats():
    """Get signal statistics"""
    
    try:
        # Get all signals
        result = await signal_manager.get_signal_history(limit=1000)
        signals = result.get("signals", [])
        
        if not signals:
            return {
                "status": "success",
                "total_signals": 0,
                "broadcasted": 0,
                "executed": 0,
                "success_rate": 0,
                "avg_confidence": 0
            }
        
        # Calculate stats
        broadcasted = len([s for s in signals if s.get("status") == "broadcasted"])
        executed = len([s for s in signals if s.get("status") == "executed"])
        
        confidence_scores = [
            s.get("confidence", {}).get("score", 0)
            for s in signals
            if s.get("confidence", {}).get("score")
        ]
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
        
        return {
            "status": "success",
            "total_signals": len(signals),
            "broadcasted": broadcasted,
            "executed": executed,
            "execution_rate": executed / broadcasted if broadcasted > 0 else 0,
            "avg_confidence": avg_confidence
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
