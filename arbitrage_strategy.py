"""
Arbitrage Strategy Agent for MtaaDAO Trading Bot

This strategy detects and executes arbitrage opportunities across multiple exchanges.
- Monitors price discrepancies between exchanges
- Calculates profit after fees and slippage
- Manages execution risk and capacity
- Provides signals for profitable arbitrage trades

Template: Ready to use immediately
Integration: Add to strategy_trainer with register_strategy("ARBITRAGE", ArbitrageStrategyAgent())
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from pydantic import BaseModel, Field
import logging
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)


class ArbitrageOpportunity(BaseModel):
    """Represents a single arbitrage opportunity"""
    symbol: str
    buy_exchange: str
    buy_price: float
    sell_exchange: str
    sell_price: float
    profit_percentage: float
    net_profit_percentage: float
    confidence: float
    risk_level: str
    recommended_volume: float
    execution_score: float


class ArbitrageStrategyAgent:
    """
    Multi-exchange arbitrage detection and execution strategy
    
    Features:
    - Detects price discrepancies between exchanges
    - Calculates true profit after fees and slippage
    - Risk assessment and filtering
    - Capacity management
    - Signal generation for trading bots
    
    Configuration:
    - min_profit_percentage: Minimum profit threshold (default: 0.1%)
    - max_risk_level: Maximum acceptable risk (default: 'medium')
    - min_confidence: Minimum confidence score (default: 50)
    - max_slippage_percentage: Maximum acceptable slippage (default: 0.5%)
    - position_size_percentage: Percentage of capital per trade (default: 1%)
    """
    
    def __init__(self,
                 min_profit_percentage: float = 0.1,
                 max_risk_level: str = 'medium',
                 min_confidence: float = 50,
                 max_slippage_percentage: float = 0.5,
                 position_size_percentage: float = 1.0):
        
        self.name = "ARBITRAGE"
        self.signals = {}
        self.confidence = 0.0
        
        # Configuration
        self.min_profit_percentage = min_profit_percentage
        self.max_risk_level = max_risk_level
        self.min_confidence = min_confidence
        self.max_slippage_percentage = max_slippage_percentage
        self.position_size_percentage = position_size_percentage
        
        # Fee structure (configurable)
        self.maker_fee = 0.001  # 0.1%
        self.taker_fee = 0.001  # 0.1%
        
        # Internal state
        self.active_opportunities: Dict[str, List[ArbitrageOpportunity]] = defaultdict(list)
        self.execution_history: List[Dict[str, Any]] = []
        self.failed_executions: List[Dict[str, Any]] = []
        
        logger.info(f"ArbitrageStrategyAgent initialized: min_profit={min_profit_percentage}%, "
                   f"max_risk={max_risk_level}, min_confidence={min_confidence}")
    
    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update strategy with multi-exchange market data
        
        Expected data format:
        {
            'symbol_prices': {
                'AAVE': {
                    'binance': {'ask': 156.75, 'bid': 156.50, 'volume': 45000000},
                    'coinbase': {'ask': 156.80, 'bid': 156.55, 'volume': 12000000},
                    ...
                }
            },
            'account_balance': {...},
            'timestamp': datetime
        }
        """
        try:
            symbol_prices = data.get('symbol_prices', {})
            account_balance = data.get('account_balance', {})
            
            if not symbol_prices:
                logger.warning("No symbol prices provided")
                self.signals = {}
                return {}
            
            # Clear previous opportunities
            self.active_opportunities.clear()
            opportunities = []
            
            # Analyze each symbol
            for symbol, exchange_data in symbol_prices.items():
                if not exchange_data or len(exchange_data) < 2:
                    continue  # Need at least 2 exchanges for arbitrage
                
                # Get all pairwise arbitrage opportunities
                symbol_opps = self._find_symbol_opportunities(symbol, exchange_data)
                opportunities.extend(symbol_opps)
                
                if symbol_opps:
                    self.active_opportunities[symbol] = symbol_opps
            
            # Filter and rank opportunities
            best_opportunities = self._filter_and_rank(opportunities, account_balance)
            
            # Generate trading signals
            signals = self._generate_signals(best_opportunities)
            self.signals = signals
            
            # Calculate overall confidence
            if best_opportunities:
                self.confidence = np.mean([opp.confidence for opp in best_opportunities])
            else:
                self.confidence = 0.0
            
            return {
                f"{self.name}_signals": signals,
                f"{self.name}_opportunities": best_opportunities,
                f"{self.name}_count": len(best_opportunities)
            }
            
        except Exception as e:
            logger.error(f"ArbitrageStrategyAgent.update error: {str(e)}")
            self.signals = {}
            return {}
    
    def _find_symbol_opportunities(self, symbol: str, exchange_data: Dict) -> List[ArbitrageOpportunity]:
        """Find all arbitrage opportunities for a symbol across exchanges"""
        opportunities = []
        exchanges = list(exchange_data.keys())
        
        # Check all exchange pairs
        for i, buy_exch in enumerate(exchanges):
            for j, sell_exch in enumerate(exchanges):
                if buy_exch == sell_exch:
                    continue
                
                buy_data = exchange_data[buy_exch]
                sell_data = exchange_data[sell_exch]
                
                if not buy_data.get('ask') or not sell_data.get('bid'):
                    continue
                
                # Calculate opportunity
                opp = self._calculate_arbitrage(
                    symbol, buy_exch, buy_data, sell_exch, sell_data
                )
                
                if opp:
                    opportunities.append(opp)
        
        return opportunities
    
    def _calculate_arbitrage(self,
                            symbol: str,
                            buy_exchange: str,
                            buy_data: Dict,
                            sell_exchange: str,
                            sell_data: Dict) -> Optional[ArbitrageOpportunity]:
        """Calculate arbitrage opportunity between two exchanges"""
        
        buy_price = buy_data['ask']
        sell_price = sell_data['bid']
        buy_volume = buy_data.get('volume', 0)
        sell_volume = sell_data.get('volume', 0)
        
        # Check basic profitability
        price_gap = sell_price - buy_price
        if price_gap <= 0:
            return None  # Negative opportunity
        
        # Calculate fees
        buy_fee = buy_price * self.taker_fee
        sell_fee = sell_price * self.maker_fee
        total_fees = buy_fee + sell_fee
        
        # Gross profit
        gross_profit = price_gap - total_fees
        gross_profit_pct = (gross_profit / buy_price) * 100
        
        if gross_profit_pct < self.min_profit_percentage:
            return None  # Below minimum threshold
        
        # Estimate slippage
        slippage = self._estimate_slippage(buy_volume, sell_volume, buy_price)
        slippage_pct = (slippage / buy_price) * 100
        
        if slippage_pct > self.max_slippage_percentage:
            return None  # Slippage too high
        
        # Net profit
        net_profit = gross_profit - slippage
        net_profit_pct = (net_profit / buy_price) * 100
        
        if net_profit_pct <= 0:
            return None  # No profit after slippage
        
        # Risk assessment
        risk_level, risk_factors = self._assess_risk(buy_volume, sell_volume)
        
        # Confidence score
        confidence = self._calculate_confidence(
            gross_profit_pct, buy_volume, sell_volume, risk_level
        )
        
        if confidence < self.min_confidence:
            return None
        
        # Recommended volume and execution score
        recommended_volume = self._calculate_position_size(buy_volume, sell_volume)
        execution_score = self._calculate_execution_score(
            net_profit_pct, confidence, risk_level, recommended_volume
        )
        
        return ArbitrageOpportunity(
            symbol=symbol,
            buy_exchange=buy_exchange,
            buy_price=float(buy_price),
            sell_exchange=sell_exchange,
            sell_price=float(sell_price),
            profit_percentage=float(gross_profit_pct),
            net_profit_percentage=float(net_profit_pct),
            confidence=float(confidence),
            risk_level=risk_level,
            recommended_volume=float(recommended_volume),
            execution_score=float(execution_score)
        )
    
    def _estimate_slippage(self, buy_volume: float, sell_volume: float, price: float) -> float:
        """Estimate slippage based on liquidity"""
        
        if buy_volume <= 0 or sell_volume <= 0:
            return price * 0.005  # Default: 0.5%
        
        min_volume = min(buy_volume, sell_volume)
        
        # Base slippage
        slippage_pct = 0.002  # 0.2%
        
        # Increase for lower liquidity
        if min_volume < 10000:
            slippage_pct += 0.003
        if min_volume < 1000:
            slippage_pct += 0.005
        
        # Volume imbalance penalty
        volume_ratio = min_volume / max(buy_volume, sell_volume)
        if volume_ratio < 0.5:
            slippage_pct += 0.002
        
        return price * slippage_pct
    
    def _assess_risk(self, buy_volume: float, sell_volume: float) -> Tuple[str, List[str]]:
        """Assess execution risk"""
        
        risk_factors = []
        risk_score = 0
        
        # Check liquidity
        if min(buy_volume, sell_volume) < 10000:
            risk_factors.append("Low liquidity")
            risk_score += 20
        
        # Check volume imbalance
        if min(buy_volume, sell_volume) / max(buy_volume, sell_volume) < 0.3:
            risk_factors.append("Unbalanced volumes")
            risk_score += 15
        
        # Determine risk level
        if risk_score >= 40:
            risk_level = 'high'
        elif risk_score >= 20:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        return risk_level, risk_factors
    
    def _calculate_confidence(self,
                            profit_pct: float,
                            buy_volume: float,
                            sell_volume: float,
                            risk_level: str) -> float:
        """Calculate confidence score (0-100)"""
        
        score = 50.0
        
        # Profit component
        if profit_pct > 0.5:
            score += 25
        elif profit_pct > 0.2:
            score += 15
        
        # Liquidity component
        if min(buy_volume, sell_volume) > 100000:
            score += 20
        elif min(buy_volume, sell_volume) > 10000:
            score += 10
        
        # Risk adjustment
        if risk_level == 'low':
            score += 15
        elif risk_level == 'medium':
            score += 5
        else:
            score -= 10
        
        return min(100, max(0, score))
    
    def _calculate_position_size(self, buy_volume: float, sell_volume: float) -> float:
        """Calculate recommended position size"""
        min_volume = min(buy_volume, sell_volume)
        # Conservative: 5% of smaller volume, but at least $1000
        return max(1000, min_volume * 0.05)
    
    def _calculate_execution_score(self,
                                  profit_pct: float,
                                  confidence: float,
                                  risk_level: str,
                                  position_size: float) -> float:
        """Calculate overall execution score (0-100)"""
        
        score = 0.0
        
        # Profitability (0-40)
        if profit_pct > 1.0:
            score += 40
        elif profit_pct > 0.5:
            score += 30
        elif profit_pct > 0.2:
            score += 15
        
        # Confidence (0-30)
        score += (confidence / 100) * 30
        
        # Risk (0-30)
        if risk_level == 'low':
            score += 30
        elif risk_level == 'medium':
            score += 15
        
        # Position size (bonus for good capacity)
        if position_size > 10000:
            score += 5
        
        return min(100, score)
    
    def _filter_and_rank(self,
                        opportunities: List[ArbitrageOpportunity],
                        account_balance: Dict) -> List[ArbitrageOpportunity]:
        """Filter opportunities by risk/profit and rank by execution score"""
        
        risk_levels = {'low': 0, 'medium': 1, 'high': 2, 'critical': 3}
        max_risk_index = risk_levels.get(self.max_risk_level, 1)
        
        # Filter
        filtered = [
            opp for opp in opportunities
            if risk_levels.get(opp.risk_level, 3) <= max_risk_index
        ]
        
        # Sort by execution score
        filtered.sort(key=lambda x: x.execution_score, reverse=True)
        
        # Return top 20
        return filtered[:20]
    
    def _generate_signals(self, opportunities: List[ArbitrageOpportunity]) -> Dict[str, Any]:
        """Generate trading signals from opportunities"""
        
        signals = {}
        
        for opp in opportunities:
            key = f"{opp.symbol}_{opp.buy_exchange}_to_{opp.sell_exchange}"
            
            if opp.execution_score >= 75:
                signal_type = 'STRONG_ARBITRAGE'
            elif opp.execution_score >= 50:
                signal_type = 'ARBITRAGE'
            else:
                signal_type = 'WEAK_ARBITRAGE'
            
            signals[key] = {
                'symbol': opp.symbol,
                'signal': signal_type,
                'buy_exchange': opp.buy_exchange,
                'buy_price': opp.buy_price,
                'sell_exchange': opp.sell_exchange,
                'sell_price': opp.sell_price,
                'profit_percentage': opp.net_profit_percentage,
                'confidence': opp.confidence,
                'risk': opp.risk_level,
                'volume': opp.recommended_volume,
                'score': opp.execution_score
            }
        
        return signals
    
    def get_signal(self) -> Dict[str, Any]:
        """Return current signals"""
        return self.signals
    
    def evaluate(self, df: pd.DataFrame) -> float:
        """
        Evaluate strategy performance on historical data
        Returns score 0-1
        """
        if not self.signals:
            return 0.0
        
        # Calculate average confidence
        confidence_scores = []
        for signal in self.signals.values():
            if isinstance(signal, dict):
                confidence_scores.append(signal.get('confidence', 0) / 100)
        
        return float(np.mean(confidence_scores)) if confidence_scores else 0.0


# Registration function for StrategyTrainerAgent
def register_arbitrage_strategy(trainer: 'StrategyTrainerAgent') -> None:
    """Register arbitrage strategy with the strategy trainer"""
    trainer.register_strategy("ARBITRAGE", ArbitrageStrategyAgent())
    logger.info("✅ Arbitrage strategy registered")


# Example usage
if __name__ == "__main__":
    """
    Demo: How to use ArbitrageStrategyAgent
    """
    
    # Create strategy
    strategy = ArbitrageStrategyAgent(
        min_profit_percentage=0.1,
        max_risk_level='medium',
        min_confidence=60
    )
    
    # Mock multi-exchange data
    mock_data = {
        'symbol_prices': {
            'AAVE': {
                'binance': {
                    'ask': 156.75,
                    'bid': 156.50,
                    'volume': 45000000
                },
                'coinbase': {
                    'ask': 156.80,
                    'bid': 156.55,
                    'volume': 12000000
                },
                'kraken': {
                    'ask': 156.70,
                    'bid': 156.60,
                    'volume': 3000000
                }
            },
            'BTC': {
                'binance': {
                    'ask': 45325.50,
                    'bid': 45320.00,
                    'volume': 500000000
                },
                'coinbase': {
                    'ask': 45335.00,
                    'bid': 45330.00,
                    'volume': 100000000
                }
            }
        },
        'account_balance': {
            'USDT': 100000,
            'BTC': 0.5
        },
        'timestamp': datetime.now()
    }
    
    # Update strategy
    result = strategy.update(mock_data)
    
    print("Strategy Update Result:")
    print(f"  Signals generated: {len(strategy.signals)}")
    print(f"  Overall confidence: {strategy.confidence:.1f}%")
    print(f"  Active opportunities by symbol: {dict(strategy.active_opportunities)}")
    
    # Print detailed signals
    for signal_key, signal_data in strategy.signals.items():
        print(f"\n{signal_key}:")
        for k, v in signal_data.items():
            print(f"    {k}: {v}")
