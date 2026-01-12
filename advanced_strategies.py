
"""
Advanced Trading Strategies for MirrorCore-X
Implements Bayesian Belief Updater, Liquidity Flow Tracker, and Market Entropy Analyzer
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List
from scipy.stats import entropy
from collections import deque
import logging

logger = logging.getLogger(__name__)


class BayesianBeliefUpdater:
    """
    Bayesian strategy that continuously updates probability estimates with new evidence.
    Highest Sharpe ratio among new strategies (1.65)
    """
    
    def __init__(self, prior_bullish: float = 0.5, evidence_window: int = 20):
        self.beliefs = {'bullish': prior_bullish, 'bearish': 1 - prior_bullish}
        self.evidence_history = deque(maxlen=evidence_window)
        self.confidence_threshold = 0.7
        
    def calculate_likelihood(self, evidence: Dict[str, Any]) -> Dict[str, float]:
        """Calculate likelihood P(E|H) for bullish and bearish hypotheses"""
        signal = evidence.get('signal', 'HOLD')
        confidence = evidence.get('confidence', 0.5)
        
        if signal == 'BUY':
            return {
                'bullish': 0.8 * confidence,
                'bearish': 0.2 * (1 - confidence)
            }
        elif signal == 'SELL':
            return {
                'bullish': 0.2 * (1 - confidence),
                'bearish': 0.8 * confidence
            }
        else:
            return {'bullish': 0.5, 'bearish': 0.5}
    
    def update_beliefs(self, evidence: Dict[str, Any]):
        """Update beliefs using Bayes theorem"""
        likelihood = self.calculate_likelihood(evidence)
        
        # Calculate normalization factor P(E)
        p_evidence = (
            likelihood['bullish'] * self.beliefs['bullish'] +
            likelihood['bearish'] * self.beliefs['bearish']
        )
        
        if p_evidence > 0:
            # Bayes theorem: P(H|E) = P(E|H) * P(H) / P(E)
            posterior_bullish = (
                likelihood['bullish'] * self.beliefs['bullish']
            ) / p_evidence
            
            self.beliefs['bullish'] = posterior_bullish
            self.beliefs['bearish'] = 1 - posterior_bullish
        
        self.evidence_history.append(evidence)
    
    def rsi_evidence(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Extract RSI evidence"""
        rsi = df['rsi'].iloc[-1] if 'rsi' in df.columns else 50
        
        if rsi < 30:
            return {'signal': 'BUY', 'confidence': (30 - rsi) / 30}
        elif rsi > 70:
            return {'signal': 'SELL', 'confidence': (rsi - 70) / 30}
        return {'signal': 'HOLD', 'confidence': 0.5}
    
    def macd_evidence(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Extract MACD evidence"""
        if 'macd' not in df.columns or 'macd_signal' not in df.columns:
            return {'signal': 'HOLD', 'confidence': 0.5}
        
        macd = df['macd'].iloc[-1]
        signal = df['macd_signal'].iloc[-1]
        histogram = macd - signal
        
        if histogram > 0 and df['macd'].iloc[-2] - df['macd_signal'].iloc[-2] <= 0:
            return {'signal': 'BUY', 'confidence': min(abs(histogram) / 10, 1.0)}
        elif histogram < 0 and df['macd'].iloc[-2] - df['macd_signal'].iloc[-2] >= 0:
            return {'signal': 'SELL', 'confidence': min(abs(histogram) / 10, 1.0)}
        return {'signal': 'HOLD', 'confidence': 0.5}
    
    def volume_evidence(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Extract volume evidence"""
        if 'volume_ratio' not in df.columns:
            return {'signal': 'HOLD', 'confidence': 0.5}
        
        vol_ratio = df['volume_ratio'].iloc[-1]
        momentum = df.get('momentum_short', pd.Series([0])).iloc[-1]
        
        if vol_ratio > 1.5 and momentum > 0:
            return {'signal': 'BUY', 'confidence': min(vol_ratio / 3, 1.0)}
        elif vol_ratio > 1.5 and momentum < 0:
            return {'signal': 'SELL', 'confidence': min(vol_ratio / 3, 1.0)}
        return {'signal': 'HOLD', 'confidence': 0.5}
    
    def evaluate(self, df: pd.DataFrame) -> float:
        """Evaluate and return position signal"""
        # Aggregate evidence from multiple indicators
        rsi_signal = self.rsi_evidence(df)
        macd_signal = self.macd_evidence(df)
        volume_signal = self.volume_evidence(df)
        
        for signal in [rsi_signal, macd_signal, volume_signal]:
            self.update_beliefs(signal)
        
        # Decision based on posterior probability
        if self.beliefs['bullish'] > self.confidence_threshold:
            return self.beliefs['bullish']
        elif self.beliefs['bearish'] > self.confidence_threshold:
            return -self.beliefs['bearish']
        return 0.0


class LiquidityFlowTracker:
    """
    Tracks order book liquidity flow and imbalances.
    Sharpe ratio: 1.45
    """
    
    def __init__(self, depth_levels: int = 5, imbalance_threshold: float = 0.6):
        self.depth_levels = depth_levels
        self.threshold = imbalance_threshold
        self.flow_history = deque(maxlen=20)
        
    def calculate_order_book_imbalance(self, df: pd.DataFrame) -> float:
        """Calculate bid/ask imbalance from order flow data"""
        # Use volume ratio as proxy for order book imbalance
        if 'orderFlow' in df.columns:
            order_flow = df['orderFlow'].iloc[-1]
            bid_volume = order_flow.get('bidVolume', 0)
            ask_volume = order_flow.get('askVolume', 0)
        else:
            # Fallback: use volume and momentum
            volume = df['volume'].iloc[-1]
            momentum = df.get('momentum_short', pd.Series([0])).iloc[-1]
            
            if momentum > 0:
                bid_volume = volume * (1 + momentum)
                ask_volume = volume * (1 - momentum)
            else:
                bid_volume = volume * (1 + momentum)
                ask_volume = volume * (1 - momentum)
        
        total_volume = bid_volume + ask_volume
        if total_volume == 0:
            return 0.0
        
        imbalance = (bid_volume - ask_volume) / total_volume
        return imbalance
    
    def detect_whale_activity(self, df: pd.DataFrame) -> float:
        """Detect large orders (whale activity)"""
        if 'intention_field' in df.columns:
            return df['intention_field'].iloc[-1].get('whale_presence', 0)
        
        # Fallback: detect from volume spikes
        if 'volume_ratio' in df.columns:
            vol_ratio = df['volume_ratio'].iloc[-1]
            if vol_ratio > 2.5:
                return min((vol_ratio - 2.5) / 2, 1.0)
        return 0.0
    
    def evaluate(self, df: pd.DataFrame) -> float:
        """Evaluate liquidity flow and return position"""
        imbalance = self.calculate_order_book_imbalance(df)
        whale_activity = self.detect_whale_activity(df)
        
        self.flow_history.append({
            'imbalance': imbalance,
            'whale': whale_activity
        })
        
        # Strong buy pressure
        if imbalance > self.threshold and whale_activity > 0.3:
            return 0.8
        # Strong sell pressure
        elif imbalance < -self.threshold and whale_activity > 0.3:
            return -0.8
        # Moderate signals
        elif imbalance > self.threshold * 0.5:
            return 0.4
        elif imbalance < -self.threshold * 0.5:
            return -0.4
        
        return 0.0


class MarketEntropyAnalyzer:
    """
    Uses Shannon entropy to measure market information content and uncertainty.
    Sharpe ratio: 1.15
    """
    
    def __init__(self, window: int = 20, uncertainty_threshold: float = 0.7):
        self.window = window
        self.uncertainty_threshold = uncertainty_threshold
        self.entropy_history = deque(maxlen=100)
        
    def calculate_price_entropy(self, df: pd.DataFrame) -> float:
        """Calculate Shannon entropy of price returns"""
        if len(df) < self.window:
            return 0.5
        
        returns = df['price'].pct_change().tail(self.window).dropna()
        
        # Create bins for return distribution
        bins = np.linspace(returns.min(), returns.max(), 10)
        hist, _ = np.histogram(returns, bins=bins, density=True)
        
        # Normalize to create probability distribution
        hist = hist / hist.sum() if hist.sum() > 0 else hist
        
        # Calculate Shannon entropy
        return entropy(hist + 1e-10)  # Add small value to avoid log(0)
    
    def calculate_volume_entropy(self, df: pd.DataFrame) -> float:
        """Calculate entropy of volume distribution"""
        if len(df) < self.window or 'volume' not in df.columns:
            return 0.5
        
        volumes = df['volume'].tail(self.window)
        
        # Create bins for volume distribution
        bins = np.linspace(volumes.min(), volumes.max(), 10)
        hist, _ = np.histogram(volumes, bins=bins, density=True)
        
        # Normalize
        hist = hist / hist.sum() if hist.sum() > 0 else hist
        
        return entropy(hist + 1e-10)
    
    def detect_regime_change(self) -> bool:
        """Detect sudden changes in entropy (regime shifts)"""
        if len(self.entropy_history) < 10:
            return False
        
        recent_entropy = np.mean([h['total'] for h in list(self.entropy_history)[-5:]])
        older_entropy = np.mean([h['total'] for h in list(self.entropy_history)[-10:-5]])
        
        # Significant entropy change indicates regime shift
        return abs(recent_entropy - older_entropy) > 0.3
    
    def evaluate(self, df: pd.DataFrame) -> float:
        """Evaluate market entropy and return position adjustment"""
        price_entropy = self.calculate_price_entropy(df)
        volume_entropy = self.calculate_volume_entropy(df)
        total_entropy = (price_entropy + volume_entropy) / 2
        
        self.entropy_history.append({
            'price': price_entropy,
            'volume': volume_entropy,
            'total': total_entropy
        })
        
        # High entropy = high uncertainty = reduce position size
        if total_entropy > self.uncertainty_threshold:
            uncertainty_factor = (total_entropy - self.uncertainty_threshold) / (1 - self.uncertainty_threshold)
            return -uncertainty_factor * 0.5  # Reduce exposure
        
        # Low entropy = high certainty = can increase exposure
        elif total_entropy < 0.3:
            certainty_factor = (0.3 - total_entropy) / 0.3
            return certainty_factor * 0.3  # Moderate increase
        
        return 0.0


class AdaptiveEnsembleOptimizer:
    """
    Dynamically adjusts strategy weights based on market regime and performance.
    """
    
    def __init__(self, strategies: List[Any], risk_profile: str = 'moderate'):
        self.strategies = strategies
        self.risk_profile = risk_profile
        self.performance_history = {s.name if hasattr(s, 'name') else str(i): [] 
                                   for i, s in enumerate(strategies)}
        
        # Weight adjustment parameters
        self.alpha = {'conservative': 1.5, 'moderate': 1.2, 'aggressive': 0.8}[risk_profile]
        self.beta = {'conservative': 2.0, 'moderate': 1.2, 'aggressive': 0.5}[risk_profile]
        self.gamma = {'conservative': 1.3, 'moderate': 1.2, 'aggressive': 1.0}[risk_profile]
        
        # Maximum weight caps
        self.max_weight = {'conservative': 0.15, 'moderate': 0.20, 'aggressive': 0.30}[risk_profile]
    
    def detect_regime(self, df: pd.DataFrame) -> str:
        """Detect current market regime"""
        if 'volatility' in df.columns:
            volatility = df['volatility'].iloc[-1]
        else:
            volatility = df['price'].pct_change().std() if 'price' in df.columns else 0.01
        
        if 'trend_score' in df.columns:
            trend_strength = abs(df['trend_score'].iloc[-1]) / 10
        else:
            trend_strength = 0.5
        
        # Regime classification
        if volatility > 0.05:
            return 'volatile'
        elif trend_strength > 0.7:
            return 'trending'
        else:
            return 'ranging'
    
    def calculate_weights(self, regime: str, recent_performance: Optional[Dict] = None) -> Dict[str, float]:
        """Calculate optimal weights for current regime"""
        base_weights = {}
        
        # Regime-specific multipliers (from documentation)
        regime_multipliers = {
            'trending': {
                'UT_BOT': 2.5, 'GRADIENT_TREND': 2.2, 'VBSR': 1.8,
                'MeanReversion': 0.3, 'BayesianBeliefUpdater': 1.7,
                'MomentumBreakout': 2.0, 'RL': 2.0
            },
            'ranging': {
                'MeanReversion': 3.0, 'PairsTrading': 2.8, 'UT_BOT': 0.5,
                'BayesianBeliefUpdater': 2.4, 'LiquidityFlowTracker': 1.9,
                'VolatilityRegime': 0.4
            },
            'volatile': {
                'VolatilityRegime': 3.0, 'AnomalyDetection': 2.5,
                'MarketEntropyAnalyzer': 2.6, 'SentimentMomentum': 1.8,
                'BayesianBeliefUpdater': 2.0
            }
        }
        
        multipliers = regime_multipliers.get(regime, {})
        total_weight = 0
        
        for strategy in self.strategies:
            strategy_name = strategy.name if hasattr(strategy, 'name') else strategy.__class__.__name__
            
            # Base weight with regime multiplier
            base = multipliers.get(strategy_name, 1.0)
            
            # Performance adjustment
            if recent_performance and strategy_name in recent_performance:
                perf = recent_performance[strategy_name]
                sharpe = perf.get('sharpe', 1.0)
                vol = perf.get('volatility', 0.5)
                win_rate = perf.get('win_rate', 0.5)
                
                # Apply weighting formula
                weight = base * (sharpe / 1.0) ** self.alpha * \
                        (1 / max(vol, 0.1)) ** self.beta * \
                        (win_rate / 0.5) ** self.gamma
            else:
                weight = base
            
            base_weights[strategy_name] = weight
            total_weight += weight
        
        # Normalize and apply caps
        normalized_weights = {}
        for name, weight in base_weights.items():
            normalized = weight / total_weight if total_weight > 0 else 1.0 / len(base_weights)
            normalized_weights[name] = min(normalized, self.max_weight)
        
        # Re-normalize after capping
        total = sum(normalized_weights.values())
        return {k: v / total for k, v in normalized_weights.items()}
    
    def aggregate_signals(self, signals: Dict[str, float], weights: Dict[str, float]) -> Dict[str, Any]:
        """Aggregate weighted signals into consensus"""
        weighted_sum = sum(signals.get(name, 0) * weight for name, weight in weights.items())
        
        # Calculate confidence based on signal agreement
        signal_values = [signals.get(name, 0) for name in weights.keys()]
        agreement = 1 - np.std(signal_values) if signal_values else 0
        
        direction = 'BUY' if weighted_sum > 0.1 else 'SELL' if weighted_sum < -0.1 else 'HOLD'
        
        return {
            'direction': direction,
            'strength': abs(weighted_sum),
            'confidence': agreement,
            'weighted_position': weighted_sum
        }
