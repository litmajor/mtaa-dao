# backend/services/signal_dispatcher.py
"""
Signal Dispatch System
Handles Telegram broadcasting and webhook notifications
"""

from typing import Dict, List, Optional
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)


class TelegramSignalBroadcaster:
    """Broadcasts trading signals to Telegram channel"""
    
    def __init__(self, bot_token: str, channel_id: str):
        """
        Args:
            bot_token: Telegram bot token
            channel_id: Target channel ID
        """
        self.bot_token = bot_token
        self.channel_id = channel_id
    
    def format_signal_message(self, signal: Dict) -> str:
        """Format signal as Telegram message"""
        
        action = signal.get("action", "SIGNAL").upper()
        emoji_map = {
            "LONG": "🟢",
            "SHORT": "🔴",
            "CLOSE": "❌",
            "TP1": "✅",
            "TP2": "✅",
            "TP3": "✅",
        }
        
        emoji = emoji_map.get(action, "📊")
        
        market = signal.get("market", {})
        pricing = signal.get("pricing", {})
        sizing = signal.get("sizing", {})
        confidence = signal.get("confidence", {})
        metadata = signal.get("metadata", {})
        
        # Build message
        lines = [
            f"{emoji} **{action}** | {market.get('pair', 'N/A')} on {market.get('dex', 'DEX')}",
            "",
            f"🎯 **Strategy:** {signal.get('strategy', 'Unknown')}",
            f"💯 **Confidence:** {confidence.get('score', 0):.0%}",
            "",
            "📈 **Price Targets:**",
            f"  Entry: ${pricing.get('entry_price', 0):.6f}",
            f"  TP1: ${pricing.get('take_profit_targets', [0])[0] if pricing.get('take_profit_targets') else 0:.6f}",
            f"  TP2: ${pricing.get('take_profit_targets', [0, 0])[1] if len(pricing.get('take_profit_targets', [])) > 1 else 0:.6f}",
            f"  SL: ${pricing.get('stop_loss', 0):.6f}",
            "",
            "💰 **Position:**",
            f"  Size: {sizing.get('position_size_usd', 0):.2f} USDC ({sizing.get('position_size_pct', 0):.1f}%)",
            f"  R:R Ratio: {pricing.get('risk_reward', 0):.1f}x",
            "",
            "🔍 **Indicators:**",
            f"  {', '.join(confidence.get('indicators', []))}",
            "",
            "📊 **Pair Data:**",
            f"  Liquidity: ${metadata.get('liquidity_usd', 0):,.0f}",
            f"  Vol 24h: ${metadata.get('volume_24h', 0):,.0f}",
            f"  Age: {metadata.get('pair_age_hours', 0):.1f}h",
            "",
            signal.get("metadata", {}).get("reason", "See details in app"),
        ]
        
        return "\n".join(lines)
    
    async def broadcast(self, signal: Dict) -> Dict:
        """
        Broadcast signal to Telegram channel
        
        Args:
            signal: Signal payload
        
        Returns:
            Success/failure status
        """
        
        try:
            message = self.format_signal_message(signal)
            
            # In production: use actual Telegram bot API
            # For now, log the message
            logger.info(f"[TELEGRAM SIGNAL] {message}")
            
            return {
                "status": "success",
                "channel": self.channel_id,
                "message_id": f"msg_{datetime.now().timestamp()}",
                "sent_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Telegram broadcast error: {e}")
            return {
                "status": "error",
                "error": str(e)
            }


class SignalManager:
    """Manages signal lifecycle and distribution"""
    
    def __init__(self, telegram_broadcaster: Optional[TelegramSignalBroadcaster] = None):
        self.broadcaster = telegram_broadcaster
        self.signals_db = []  # In production: use real database
    
    async def receive_signal(self, signal: Dict) -> Dict:
        """
        Receive and process incoming signal
        
        Args:
            signal: Signal payload
        
        Returns:
            Processing result
        """
        
        # 1. Validate signal
        required_fields = ["signal_id", "action", "market", "pricing", "confidence"]
        missing = [f for f in required_fields if f not in signal]
        
        if missing:
            return {
                "status": "error",
                "error": f"Missing required fields: {', '.join(missing)}"
            }
        
        # 2. Store signal
        signal_doc = {
            **signal,
            "received_at": datetime.now().isoformat(),
            "status": "received"
        }
        self.signals_db.append(signal_doc)
        
        # 3. Broadcast to Telegram
        if self.broadcaster:
            broadcast_result = await self.broadcaster.broadcast(signal)
            if broadcast_result["status"] != "success":
                logger.warning(f"Telegram broadcast failed: {broadcast_result}")
        
        # 4. Update status
        signal_doc["status"] = "broadcasted"
        signal_doc["broadcasted_at"] = datetime.now().isoformat()
        
        return {
            "status": "success",
            "signal_id": signal["signal_id"],
            "received_at": signal_doc["received_at"],
            "broadcasted_at": signal_doc["broadcasted_at"]
        }
    
    async def get_signal_history(
        self,
        strategy_id: Optional[str] = None,
        limit: int = 100
    ) -> Dict:
        """Get signal history"""
        
        signals = self.signals_db.copy()
        
        if strategy_id:
            signals = [s for s in signals if s.get("strategy") == strategy_id]
        
        # Sort by received_at descending
        signals = sorted(
            signals,
            key=lambda x: x.get("received_at", ""),
            reverse=True
        )[:limit]
        
        return {
            "status": "success",
            "total": len(signals),
            "signals": signals
        }
    
    async def get_signal(self, signal_id: str) -> Dict:
        """Get specific signal details"""
        
        for signal in self.signals_db:
            if signal.get("signal_id") == signal_id:
                return {
                    "status": "success",
                    "signal": signal
                }
        
        return {
            "status": "error",
            "error": "Signal not found"
        }
    
    async def execute_signal(self, signal_id: str, execution_data: Dict) -> Dict:
        """Mark signal as executed"""
        
        for signal in self.signals_db:
            if signal.get("signal_id") == signal_id:
                signal["status"] = "executed"
                signal["executed_at"] = datetime.now().isoformat()
                signal["execution"] = execution_data
                
                return {
                    "status": "success",
                    "signal_id": signal_id,
                    "executed_at": signal["executed_at"]
                }
        
        return {
            "status": "error",
            "error": "Signal not found"
        }
