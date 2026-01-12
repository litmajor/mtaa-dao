"""
Seven Additional Strategy Modules for MirrorCore-X Trading System

These strategies complement the existing UT Bot, Gradient Trend, and Volume Support/Resistance agents
with diverse approaches covering different market conditions and timeframes.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
import logging
from collections import deque
from scipy import stats
from sklearn.ensemble import IsolationForest
import talib

logger = logging.getLogger(__name__)

# Import advanced strategies
try:
    from advanced_strategies import (
        BayesianBeliefUpdater,
        LiquidityFlowTracker,
        MarketEntropyAnalyzer,
        AdaptiveEnsembleOptimizer
    )
    ADVANCED_STRATEGIES_AVAILABLE = True
except ImportError:
    logger.warning("Advanced strategies not available")
    ADVANCED_STRATEGIES_AVAILABLE = False

# Base strategy interface (matches your existing pattern)
class BaseStrategyAgent:
    """Base class for all strategy agents"""

    def __init__(self, name: str):
        self.name = name
        self.signals = {}
        self.confidence = 0.0

    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update strategy with new data"""
        raise NotImplementedError

    def get_signal(self) -> Dict[str, Any]:
        """Get current signal"""
        return self.signals

# 1. MEAN REVERSION STRATEGY
class MeanReversionAgent(BaseStrategyAgent):
    def evaluate(self, df):
        """Compatibility: Evaluate signal for a DataFrame (single symbol or multi-row)."""
        result = self.update({'market_data_df': df})
        signals = result.get(f"{self.name}_signals", {})
        if not signals:
            return 0.0
        # Aggregate signals if multiple symbols
        values = []
        for symbol, signal_data in signals.items():
            signal = signal_data.get('signal', 'Hold')
            confidence = signal_data.get('confidence', 0.5)
            if signal == 'Strong Buy':
                values.append(1.0 * confidence)
            elif signal == 'Buy':
                values.append(0.7 * confidence)
            elif signal == 'Strong Sell':
                values.append(-1.0 * confidence)
            elif signal == 'Sell':
                values.append(-0.7 * confidence)
            else:
                values.append(0.0)
        return float(np.mean(values)) if values else 0.0
    """
    Bollinger Bands + RSI mean reversion strategy
    - Identifies overbought/oversold conditions
    - Uses Z-score for entry/exit signals
    - Best in ranging/sideways markets
    """

    def __init__(self, bb_period: int = 20, bb_std: float = 2.0, rsi_period: int = 14, 
                 zscore_threshold: float = 2.0):
        super().__init__("MEAN_REVERSION")
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.rsi_period = rsi_period
        self.zscore_threshold = zscore_threshold
        self.price_buffer = deque(maxlen=50)

    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            df = data.get('market_data_df')
            if df is None or df.empty:
                return {}

            # Calculate Bollinger Bands
            df['bb_middle'] = df['close'].rolling(self.bb_period).mean()
            df['bb_std'] = df['close'].rolling(self.bb_period).std()
            df['bb_upper'] = df['bb_middle'] + (df['bb_std'] * self.bb_std)
            df['bb_lower'] = df['bb_middle'] - (df['bb_std'] * self.bb_std)

            # Calculate RSI
            df['rsi'] = talib.RSI(df['close'].values, timeperiod=self.rsi_period)

            # Z-score calculation
            df['zscore'] = (df['close'] - df['bb_middle']) / df['bb_std']

            signals = {}
            for idx, row in df.iterrows():
                symbol = row.get('symbol', 'UNKNOWN')

                # Mean reversion signals
                if (row['zscore'] > self.zscore_threshold and row['rsi'] > 70):
                    signal = 'Strong Sell'  # Overbought
                    confidence = min(0.9, abs(row['zscore']) / self.zscore_threshold)
                elif (row['zscore'] < -self.zscore_threshold and row['rsi'] < 30):
                    signal = 'Strong Buy'   # Oversold
                    confidence = min(0.9, abs(row['zscore']) / self.zscore_threshold)
                elif abs(row['zscore']) < 0.5:
                    signal = 'Hold'         # Near mean
                    confidence = 0.3
                else:
                    signal = 'Hold'
                    confidence = 0.1

                signals[symbol] = {
                    'signal': signal,
                    'confidence': confidence,
                    'zscore': row['zscore'],
                    'rsi': row['rsi'],
                    'bb_position': (row['close'] - row['bb_lower']) / (row['bb_upper'] - row['bb_lower'])
                }

            self.signals = signals
            return {f"{self.name}_signals": signals}

        except Exception as e:
            logger.error(f"MeanReversionAgent update failed: {e}")
            return {}

# 2. MOMENTUM BREAKOUT STRATEGY
class MomentumBreakoutAgent(BaseStrategyAgent):
    def evaluate(self, df):
        result = self.update({'market_data_df': df})
        signals = result.get(f"{self.name}_signals", {})
        if not signals:
            return 0.0
        values = []
        for symbol, signal_data in signals.items():
            signal = signal_data.get('signal', 'Hold')
            confidence = signal_data.get('confidence', 0.5)
            if signal == 'Strong Buy':
                values.append(1.0 * confidence)
            elif signal == 'Buy':
                values.append(0.7 * confidence)
            elif signal == 'Strong Sell':
                values.append(-1.0 * confidence)
            elif signal == 'Sell':
                values.append(-0.7 * confidence)
            else:
                values.append(0.0)
        return float(np.mean(values)) if values else 0.0
    """
    ATR-based breakout strategy with volume confirmation
    - Identifies high-momentum breakouts
    - Uses Average True Range for volatility adjustment
    - Volume surge confirmation reduces false signals
    """

    def __init__(self, atr_period: int = 14, breakout_multiplier: float = 2.0, 
                 volume_threshold: float = 1.5, lookback_period: int = 20):
        super().__init__("MOMENTUM_BREAKOUT")
        self.atr_period = atr_period
        self.breakout_multiplier = breakout_multiplier
        self.volume_threshold = volume_threshold
        self.lookback_period = lookback_period

    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            df = data.get('market_data_df')
            if df is None or df.empty:
                return {}

            # Calculate ATR
            df['atr'] = talib.ATR(df['high'].values, df['low'].values, 
                                 df['close'].values, timeperiod=self.atr_period)

            # Calculate breakout levels
            df['high_breakout'] = df['high'].rolling(self.lookback_period).max()
            df['low_breakout'] = df['low'].rolling(self.lookback_period).min()

            # Volume analysis
            df['avg_volume'] = df['volume'].rolling(self.lookback_period).mean()
            df['volume_ratio'] = df['volume'] / df['avg_volume']

            # Price momentum
            df['price_change'] = df['close'].pct_change(5)  # 5-period momentum

            signals = {}
            for idx, row in df.iterrows():
                symbol = row.get('symbol', 'UNKNOWN')

                # Breakout conditions
                upward_breakout = (row['close'] > row['high_breakout'] and 
                                 row['volume_ratio'] > self.volume_threshold and
                                 row['price_change'] > 0.02)

                downward_breakout = (row['close'] < row['low_breakout'] and 
                                   row['volume_ratio'] > self.volume_threshold and
                                   row['price_change'] < -0.02)

                if upward_breakout:
                    signal = 'Strong Buy'
                    confidence = min(0.9, row['volume_ratio'] / self.volume_threshold * 0.7)
                elif downward_breakout:
                    signal = 'Strong Sell'
                    confidence = min(0.9, row['volume_ratio'] / self.volume_threshold * 0.7)
                else:
                    signal = 'Hold'
                    confidence = 0.2

                signals[symbol] = {
                    'signal': signal,
                    'confidence': confidence,
                    'atr': row['atr'],
                    'volume_ratio': row['volume_ratio'],
                    'momentum': row['price_change']
                }

            self.signals = signals
            return {f"{self.name}_signals": signals}

        except Exception as e:
            logger.error(f"MomentumBreakoutAgent update failed: {e}")
            return {}

# 3. VOLATILITY REGIME STRATEGY
class VolatilityRegimeAgent(BaseStrategyAgent):
    def evaluate(self, df):
        result = self.update({'market_data_df': df})
        signals = result.get(f"{self.name}_signals", {})
        if not signals:
            return 0.0
        values = []
        for symbol, signal_data in signals.items():
            signal = signal_data.get('signal', 'Hold')
            confidence = signal_data.get('confidence', 0.5)
            if signal == 'Strong Buy':
                values.append(1.0 * confidence)
            elif signal == 'Buy':
                values.append(0.7 * confidence)
            elif signal == 'Strong Sell':
                values.append(-1.0 * confidence)
            elif signal == 'Sell':
                values.append(-0.7 * confidence)
            else:
                values.append(0.0)
        return float(np.mean(values)) if values else 0.0
    """
    Adapts strategy based on market volatility regime
    - Low vol: Mean reversion bias
    - High vol: Trend following bias
    - Uses GARCH-like volatility clustering detection
    """

    def __init__(self, vol_window: int = 20, regime_threshold: float = 1.5):
        super().__init__("VOLATILITY_REGIME")
        self.vol_window = vol_window
        self.regime_threshold = regime_threshold
        self.vol_history = deque(maxlen=100)

    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            df = data.get('market_data_df')
            if df is None or df.empty:
                return {}

            # Calculate realized volatility
            df['returns'] = df['close'].pct_change()
            df['realized_vol'] = df['returns'].rolling(self.vol_window).std() * np.sqrt(252)  # Annualized

            # Historical volatility percentile
            if len(df) > 50:
                df['vol_percentile'] = df['realized_vol'].rolling(50).rank(pct=True)
            else:
                df['vol_percentile'] = 0.5

            # Volatility regime classification
            df['vol_regime'] = np.where(df['vol_percentile'] > 0.8, 'HIGH',
                                      np.where(df['vol_percentile'] < 0.2, 'LOW', 'MEDIUM'))

            # MACD for trend
            df['macd'], df['macdsignal'], df['macdhist'] = talib.MACD(df['close'].values)

            signals = {}
            for idx, row in df.iterrows():
                symbol = row.get('symbol', 'UNKNOWN')

                vol_regime = row['vol_regime']
                macd_signal = 'bullish' if row['macd'] > row['macdsignal'] else 'bearish'

                if vol_regime == 'HIGH':
                    # High volatility: Trend following
                    if macd_signal == 'bullish' and row['macdhist'] > 0:
                        signal = 'Buy'
                        confidence = 0.7
                    elif macd_signal == 'bearish' and row['macdhist'] < 0:
                        signal = 'Sell'
                        confidence = 0.7
                    else:
                        signal = 'Hold'
                        confidence = 0.3

                elif vol_regime == 'LOW':
                    # Low volatility: Mean reversion
                    if macd_signal == 'bearish' and row['macdhist'] < 0:
                        signal = 'Buy'  # Contrarian
                        confidence = 0.6
                    elif macd_signal == 'bullish' and row['macdhist'] > 0:
                        signal = 'Sell'  # Contrarian
                        confidence = 0.6
                    else:
                        signal = 'Hold'
                        confidence = 0.3
                else:
                    # Medium volatility: Neutral
                    signal = 'Hold'
                    confidence = 0.2

                signals[symbol] = {
                    'signal': signal,
                    'confidence': confidence,
                    'vol_regime': vol_regime,
                    'vol_percentile': row['vol_percentile'],
                    'realized_vol': row['realized_vol']
                }

            self.signals = signals
            return {f"{self.name}_signals": signals}

        except Exception as e:
            logger.error(f"VolatilityRegimeAgent update failed: {e}")
            return {}

# 4. PAIRS TRADING STRATEGY
class PairsTradingAgent(BaseStrategyAgent):
    def evaluate(self, df):
        result = self.update({'market_data_df': df})
        signals = result.get(f"{self.name}_signals", {})
        if not signals:
            return 0.0
        values = []
        for symbol, signal_data in signals.items():
            signal = signal_data.get('signal', 'Hold')
            confidence = signal_data.get('confidence', 0.5)
            if signal == 'Strong Buy':
                values.append(1.0 * confidence)
            elif signal == 'Buy':
                values.append(0.7 * confidence)
            elif signal == 'Strong Sell':
                values.append(-1.0 * confidence)
            elif signal == 'Sell':
                values.append(-0.7 * confidence)
            else:
                values.append(0.0)
        return float(np.mean(values)) if values else 0.0
    """
    Statistical arbitrage between correlated pairs
    - Identifies co-integrated pairs
    - Uses z-score of spread for entry/exit
    - Market neutral strategy
    """

    def __init__(self, lookback_period: int = 60, zscore_entry: float = 2.0, 
                 zscore_exit: float = 0.5, min_correlation: float = 0.7):
        super().__init__("PAIRS_TRADING")
        self.lookback_period = lookback_period
        self.zscore_entry = zscore_entry
        self.zscore_exit = zscore_exit
        self.min_correlation = min_correlation
        self.pairs_data = {}

    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            df = data.get('market_data_df')
            if df is None or df.empty:
                return {}

            # Get unique symbols
            symbols = df['symbol'].unique()
            if len(symbols) < 2:
                return {}

            signals = {}

            # Create price matrix
            price_matrix = df.pivot(index='timestamp', columns='symbol', values='close')

            # Find pairs with high correlation
            for i, sym1 in enumerate(symbols):
                for j, sym2 in enumerate(symbols[i+1:], i+1):
                    if sym1 == sym2:
                        continue

                    pair_key = f"{sym1}_{sym2}"

                    if len(price_matrix) >= self.lookback_period:
                        # Calculate correlation
                        corr = price_matrix[sym1].corr(price_matrix[sym2])

                        if abs(corr) > self.min_correlation:
                            # Calculate spread
                            spread = price_matrix[sym1] - price_matrix[sym2]
                            spread_mean = spread.rolling(self.lookback_period).mean()
                            spread_std = spread.rolling(self.lookback_period).std()
                            zscore = (spread - spread_mean) / spread_std

                            current_zscore = zscore.iloc[-1] if not zscore.empty else 0

                            # Generate signals
                            if current_zscore > self.zscore_entry:
                                # Spread too high: short sym1, long sym2
                                signals[sym1] = {'signal': 'Sell', 'confidence': 0.7, 'pair': sym2}
                                signals[sym2] = {'signal': 'Buy', 'confidence': 0.7, 'pair': sym1}
                            elif current_zscore < -self.zscore_entry:
                                # Spread too low: long sym1, short sym2
                                signals[sym1] = {'signal': 'Buy', 'confidence': 0.7, 'pair': sym2}
                                signals[sym2] = {'signal': 'Sell', 'confidence': 0.7, 'pair': sym1}
                            elif abs(current_zscore) < self.zscore_exit:
                                # Exit positions
                                signals[sym1] = {'signal': 'Hold', 'confidence': 0.8, 'pair': sym2}
                                signals[sym2] = {'signal': 'Hold', 'confidence': 0.8, 'pair': sym1}

                            # Store pair data
                            self.pairs_data[pair_key] = {
                                'correlation': corr,
                                'zscore': current_zscore,
                                'spread': spread.iloc[-1] if not spread.empty else 0
                            }

            self.signals = signals
            return {f"{self.name}_signals": signals}

        except Exception as e:
            logger.error(f"PairsTradingAgent update failed: {e}")
            return {}

# 5. ANOMALY DETECTION STRATEGY
class AnomalyDetectionAgent(BaseStrategyAgent):
    def evaluate(self, df):
        result = self.update({'market_data_df': df})
        signals = result.get(f"{self.name}_signals", {})
        if not signals:
            return 0.0
        values = []
        for symbol, signal_data in signals.items():
            signal = signal_data.get('signal', 'Hold')
            confidence = signal_data.get('confidence', 0.5)
            if signal == 'Strong Buy':
                values.append(1.0 * confidence)
            elif signal == 'Buy':
                values.append(0.7 * confidence)
            elif signal == 'Strong Sell':
                values.append(-1.0 * confidence)
            elif signal == 'Sell':
                values.append(-0.7 * confidence)
            else:
                values.append(0.0)
        return float(np.mean(values)) if values else 0.0
    """
    Machine learning-based anomaly detection
    - Uses Isolation Forest to detect unusual price/volume patterns
    - Contrarian approach: trade against anomalies
    - Self-adapting to market microstructure changes
    """

    def __init__(self, contamination: float = 0.1, n_estimators: int = 100):
        super().__init__("ANOMALY_DETECTION")
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.model = IsolationForest(contamination=contamination, n_estimators=n_estimators, random_state=42)
        self.is_fitted = False
        self.feature_buffer = deque(maxlen=200)

    def _extract_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract features for anomaly detection"""
        features = pd.DataFrame()

        # Price features
        features['price_change'] = df['close'].pct_change()
        features['price_volatility'] = df['close'].rolling(5).std()
        features['price_momentum'] = df['close'].pct_change(5)

        # Volume features
        features['volume_change'] = df['volume'].pct_change()
        features['volume_ratio'] = df['volume'] / df['volume'].rolling(20).mean()

        # Technical indicators
        features['rsi'] = talib.RSI(np.asarray(df['close'], dtype=np.float64), timeperiod=14)
        features['bb_position'] = (df['close'] - df['close'].rolling(20).mean()) / df['close'].rolling(20).std()

        # Microstructure features
        features['spread_proxy'] = (df['high'] - df['low']) / df['close']
        features['price_impact'] = abs(df['close'] - df['open']) / df['volume']

        return features.fillna(0)

    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            df = data.get('market_data_df')
            if df is None or df.empty:
                return {}

            features_df = self._extract_features(df)

            # Build training buffer
            for idx, row in features_df.iterrows():
                self.feature_buffer.append(row.values)

            # Train model if enough data
            if len(self.feature_buffer) >= 50 and not self.is_fitted:
                X = np.array(list(self.feature_buffer))
                self.model.fit(X)
                self.is_fitted = True
                logger.info("AnomalyDetectionAgent: Model fitted")

            signals = {}
            if self.is_fitted:
                # Detect anomalies
                X_current = features_df.values
                anomaly_scores = self.model.decision_function(X_current)
                is_anomaly = self.model.predict(X_current) == -1

                for idx, row in df.iterrows():
                    symbol = row.get('symbol', 'UNKNOWN')

                    if idx < len(anomaly_scores):
                        anomaly_score = anomaly_scores[idx]
                        is_outlier = is_anomaly[idx]

                        if is_outlier:
                            # Contrarian signal on anomalies
                            if anomaly_score < -0.5:  # Strong negative anomaly
                                signal = 'Buy'  # Price likely oversold
                                confidence = min(0.8, float(abs(anomaly_score)))
                            elif anomaly_score > 0.5:  # Strong positive anomaly
                                signal = 'Sell'  # Price likely overbought
                                confidence = min(0.8, float(abs(anomaly_score)))
                            else:
                                signal = 'Hold'
                                confidence = 0.3
                        else:
                            signal = 'Hold'
                            confidence = 0.1

                        signals[symbol] = {
                            'signal': signal,
                            'confidence': confidence,
                            'anomaly_score': anomaly_score,
                            'is_anomaly': is_outlier
                        }

            self.signals = signals
            return {f"{self.name}_signals": signals}

        except Exception as e:
            logger.error(f"AnomalyDetectionAgent update failed: {e}")
            return {}

# 6. SENTIMENT MOMENTUM STRATEGY
class SentimentMomentumAgent(BaseStrategyAgent):
    def evaluate(self, df):
        result = self.update({'market_data_df': df})
        signals = result.get(f"{self.name}_signals", {})
        if not signals:
            return 0.0
        values = []
        for symbol, signal_data in signals.items():
            signal = signal_data.get('signal', 'Hold')
            confidence = signal_data.get('confidence', 0.5)
            if signal == 'Strong Buy':
                values.append(1.0 * confidence)
            elif signal == 'Buy':
                values.append(0.7 * confidence)
            elif signal == 'Strong Sell':
                values.append(-1.0 * confidence)
            elif signal == 'Sell':
                values.append(-0.7 * confidence)
            else:
                values.append(0.0)
        return float(np.mean(values)) if values else 0.0
    """
    Combines technical momentum with sentiment analysis
    - Uses price momentum + volume + implied sentiment
    - Momentum confirmation across multiple timeframes
    - Sentiment-weighted position sizing
    """

    def __init__(self, short_period: int = 5, long_period: int = 20, sentiment_weight: float = 0.3):
        super().__init__("SENTIMENT_MOMENTUM")
        self.short_period = short_period
        self.long_period = long_period
        self.sentiment_weight = sentiment_weight

    def _calculate_sentiment(self, df: pd.DataFrame) -> pd.Series:
        """Calculate implied sentiment from price action"""
        # Sentiment proxy from price/volume relationship
        price_change = df['close'].pct_change()
        volume_change = df['volume'].pct_change()

        # Strong moves with high volume = positive sentiment
        sentiment = price_change * np.log1p(df['volume'] / df['volume'].rolling(10).mean())
        return sentiment.rolling(5).mean().fillna(0)

    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            df = data.get('market_data_df')
            if df is None or df.empty:
                return {}

            # Calculate multiple momentum timeframes
            df['momentum_short'] = df['close'].pct_change(self.short_period)
            df['momentum_long'] = df['close'].pct_change(self.long_period)
            df['momentum_volume'] = (df['close'].pct_change() * 
                                   np.log1p(df['volume'] / df['volume'].rolling(10).mean()))

            # Calculate sentiment
            df['sentiment'] = self._calculate_sentiment(df)

            # Moving averages
            df['ema_short'] = df['close'].ewm(span=self.short_period).mean()
            df['ema_long'] = df['close'].ewm(span=self.long_period).mean()

            signals = {}
            for idx, row in df.iterrows():
                symbol = row.get('symbol', 'UNKNOWN')

                # Momentum alignment
                momentum_bullish = (row['momentum_short'] > 0 and 
                                  row['momentum_long'] > 0 and
                                  row['ema_short'] > row['ema_long'])

                momentum_bearish = (row['momentum_short'] < 0 and 
                                  row['momentum_long'] < 0 and
                                  row['ema_short'] < row['ema_long'])

                # Sentiment adjustment
                sentiment_bullish = row['sentiment'] > 0.001
                sentiment_bearish = row['sentiment'] < -0.001

                # Combined signals
                if momentum_bullish and sentiment_bullish:
                    signal = 'Strong Buy'
                    confidence = 0.8 + abs(row['sentiment']) * self.sentiment_weight
                elif momentum_bullish and not sentiment_bearish:
                    signal = 'Buy'
                    confidence = 0.6
                elif momentum_bearish and sentiment_bearish:
                    signal = 'Strong Sell'
                    confidence = 0.8 + abs(row['sentiment']) * self.sentiment_weight
                elif momentum_bearish and not sentiment_bullish:
                    signal = 'Sell'
                    confidence = 0.6
                else:
                    signal = 'Hold'
                    confidence = 0.2

                signals[symbol] = {
                    'signal': signal,
                    'confidence': min(0.9, confidence),
                    'momentum_short': row['momentum_short'],
                    'momentum_long': row['momentum_long'],
                    'sentiment': row['sentiment']
                }

            self.signals = signals
            return {f"{self.name}_signals": signals}

        except Exception as e:
            logger.error(f"SentimentMomentumAgent update failed: {e}")
            return {}

# 7. REGIME CHANGE DETECTION STRATEGY
class RegimeChangeAgent(BaseStrategyAgent):
    def evaluate(self, df):
        result = self.update({'market_data_df': df})
        signals = result.get(f"{self.name}_signals", {})
        if not signals:
            return 0.0
        values = []
        for symbol, signal_data in signals.items():
            signal = signal_data.get('signal', 'Hold')
            confidence = signal_data.get('confidence', 0.5)
            if signal == 'Strong Buy':
                values.append(1.0 * confidence)
            elif signal == 'Buy':
                values.append(0.7 * confidence)
            elif signal == 'Strong Sell':
                values.append(-1.0 * confidence)
            elif signal == 'Sell':
                values.append(-0.7 * confidence)
            else:
                values.append(0.0)
        return float(np.mean(values)) if values else 0.0
    """
    Detects structural breaks and regime changes in market behavior
    - Uses Hidden Markov Models concepts
    - Identifies trend/range regime transitions
    - Early warning system for market shifts
    """

    def __init__(self, window_size: int = 50, sensitivity: float = 2.0):
        super().__init__("REGIME_CHANGE")
        self.window_size = window_size
        self.sensitivity = sensitivity
        self.regime_history = deque(maxlen=100)
        self.current_regime = 'UNKNOWN'

    def _detect_regime_change(self, returns: pd.Series) -> Dict[str, Any]:
        """Detect regime changes using statistical methods"""
        if len(returns) < self.window_size:
            return {'regime': 'UNKNOWN', 'confidence': 0.0, 'change_detected': False}

        # Rolling statistics
        rolling_mean = returns.rolling(self.window_size // 2).mean()
        rolling_std = returns.rolling(self.window_size // 2).std()
        rolling_skew = returns.rolling(self.window_size // 2).skew()

        # Regime classification based on volatility and trend
        recent_vol = rolling_std.iloc[-5:].mean() if len(rolling_std) >= 5 else 0
        recent_trend = rolling_mean.iloc[-5:].mean() if len(rolling_mean) >= 5 else 0
        recent_skew = rolling_skew.iloc[-5:].mean() if len(rolling_skew) >= 5 else 0

        # Historical percentiles
        vol_percentile = stats.percentileofscore(rolling_std.dropna(), recent_vol) / 100
        trend_percentile = stats.percentileofscore(rolling_mean.dropna(), abs(recent_trend)) / 100

        # Regime determination
        if vol_percentile > 0.8:
            new_regime = 'HIGH_VOLATILITY'
        elif vol_percentile < 0.2:
            new_regime = 'LOW_VOLATILITY'
        elif trend_percentile > 0.7 and abs(recent_trend) > recent_vol:
            new_regime = 'TRENDING'
        else:
            new_regime = 'RANGING'

        # Detect regime change
        change_detected = (new_regime != self.current_regime and 
                         self.current_regime != 'UNKNOWN')

        confidence = max(float(vol_percentile), float(trend_percentile)) if change_detected else 0.3

        return {
            'regime': new_regime,
            'confidence': confidence,
            'change_detected': change_detected,
            'vol_percentile': vol_percentile,
            'trend_strength': trend_percentile
        }

    def update(self, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            df = data.get('market_data_df')
            if df is None or df.empty:
                return {}

            # Calculate returns
            df['returns'] = df['close'].pct_change()

            signals = {}
            for symbol in df['symbol'].unique():
                symbol_df = df[df['symbol'] == symbol].copy()

                if len(symbol_df) < 20:
                    continue

                regime_info = self._detect_regime_change(symbol_df['returns'])

                # Update current regime
                if regime_info['change_detected']:
                    self.current_regime = regime_info['regime']
                    self.regime_history.append({
                        'timestamp': symbol_df['timestamp'].iloc[-1],
                        'regime': self.current_regime,
                        'symbol': symbol
                    })

                # Generate signals based on regime
                current_regime = regime_info['regime']
                confidence = regime_info['confidence']

                if regime_info['change_detected']:
                    if current_regime == 'TRENDING':
                        # Early trend detection
                        recent_momentum = symbol_df['returns'].tail(5).mean()
                        signal = 'Buy' if recent_momentum > 0 else 'Sell'
                        signal_confidence = 0.8
                    elif current_regime == 'HIGH_VOLATILITY':
                        # Volatility breakout
                        signal = 'Hold'  # Wait for direction
                        signal_confidence = 0.4
                    elif current_regime == 'RANGING':
                        # Mean reversion opportunity
                        current_price = symbol_df['close'].iloc[-1]
                        mean_price = symbol_df['close'].tail(20).mean()
                        signal = 'Buy' if current_price < mean_price else 'Sell'
                        signal_confidence = 0.6
                    else:
                        signal = 'Hold'
                        signal_confidence = 0.3
                else:
                    signal = 'Hold'
                    signal_confidence = 0.2

                signals[symbol] = {
                    'signal': signal,
                    'confidence': signal_confidence,
                    'regime': current_regime,
                    'regime_confidence': confidence,
                    'change_detected': regime_info['change_detected']
                }

            self.signals = signals
            return {f"{self.name}_signals": signals}

        except Exception as e:
            logger.error(f"RegimeChangeAgent update failed: {e}")
            return {}

# Integration helper function
def register_additional_strategies(trainer: 'StrategyTrainerAgent') -> None:
    """Register all additional strategies with the trainer."""
    trainer.register_strategy("MEAN_REVERSION", MeanReversionAgent())
    trainer.register_strategy("MOMENTUM_BREAKOUT", MomentumBreakoutAgent())
    trainer.register_strategy("VOLATILITY_REGIME", VolatilityRegimeAgent())
    trainer.register_strategy("PAIRS_TRADING", PairsTradingAgent())
    trainer.register_strategy("ANOMALY_DETECTION", AnomalyDetectionAgent())
    trainer.register_strategy("SENTIMENT_MOMENTUM", SentimentMomentumAgent())
    trainer.register_strategy("REGIME_CHANGE", RegimeChangeAgent())

    # Register advanced strategies if available
    if ADVANCED_STRATEGIES_AVAILABLE:
        trainer.register_strategy("BAYESIAN_BELIEF", BayesianBeliefUpdater())
        trainer.register_strategy("LIQUIDITY_FLOW", LiquidityFlowTracker())
        trainer.register_strategy("MARKET_ENTROPY", MarketEntropyAnalyzer())
        logger.info("Registered 10 strategies (7 additional + 3 advanced)")
    else:
        logger.info("Registered 7 additional strategies")

# === ENSEMBLE SIGNAL FUNCTION ===
def ensemble_signal(
    agents_outputs,
    weights=None,
    meta_model=None,
    meta_features=None,
    dynamic_weights_func=None,
    majority_vote=False,
    majority_priority=None,
    dynamic_context=None,
    bayesian_averaging=False,
    bayesian_priors=None,
    regime_switching_func=None,
    regime_context=None,
    correlation_filtering=False,
    correlation_matrix=None,
    correlation_threshold=0.85,
    diversity_penalty=False,
    diversity_bonus=False,
    diversity_strength=0.2,
    time_decay_func=None,
    time_decay_context=None,
    calibrate_confidence_func=None,
    calibration_context=None,
    # --- Custom Rule-Based Aggregation ---
    min_agree_count=None,  # int, minimum number of strategies that must agree (directional)
    require_strategies=None,  # list of agent names, require confirmation from these
    require_signals=None,  # dict {agent_name: required_signal}
    # --- Ensemble Explainability ---
    explainability=False,
):
    """
    Ensemble signal with support for weighted voting, dynamic weighting, majority voting, Bayesian model averaging, regime-switching, and stacked ensemble (meta-model).
    agents_outputs: dict of {agent_name: {symbol: {'signal': 'Buy'|'Sell'|'Hold', 'confidence': float}}}
    weights: dict of {agent_name: float} (optional, static weights)
    meta_model: sklearn-like model with predict_proba or predict (optional)
    meta_features: dict of {symbol: feature_vector} (optional, for meta_model)
    dynamic_weights_func: callable(agents_outputs, symbol, context) -> dict of weights (optional)
    majority_vote: bool, if True use majority/plurality voting
    majority_priority: list of agent names (optional, for tie-breaks)
    dynamic_context: dict, extra context for dynamic weighting (e.g., recent accuracy, regime, volatility)
    bayesian_averaging: bool, if True use Bayesian model averaging
    bayesian_priors: dict of {agent_name: float} (optional, prior beliefs)
    regime_switching_func: callable(symbol, regime_context) -> dict of weights or agent set (optional)
    regime_context: dict, extra context for regime switching (e.g., detected regime)
    returns: dict {symbol: {'consensus': float, 'direction': str, ...}}
    """
    consensus = {}
    all_agents = list(agents_outputs.keys())

    for symbol in {s for out in agents_outputs.values() for s in out}:
        explain = {} if explainability else None
        # --- Correlation/Redundancy Filtering ---
        filtered_agents = list(all_agents)
        if correlation_filtering and correlation_matrix is not None:
            # Remove or downweight highly correlated agents
            keep = set(filtered_agents)
            for i, a1 in enumerate(filtered_agents):
                for j, a2 in enumerate(filtered_agents):
                    if i < j:
                        corr = correlation_matrix.get((a1, a2), correlation_matrix.get((a2, a1), 0))
                        if abs(corr) >= correlation_threshold:
                            # Remove one of the pair (arbitrary: remove a2)
                            if a2 in keep:
                                keep.remove(a2)
            filtered_agents = [a for a in filtered_agents if a in keep]
        else:
            filtered_agents = list(all_agents)

        # --- Custom Rule-Based Aggregation: Pre-checks ---
        # 1. Require confirmation from specific strategies
        if require_strategies:
            for req_agent in require_strategies:
                agent_out = agents_outputs.get(req_agent, {}).get(symbol, {})
                if not agent_out or agent_out.get('signal', 'Hold') == 'Hold':
                    if explainability:
                        consensus[symbol] = {
                            'consensus': 0.0,
                            'direction': 'Hold',
                            'explain': {'blocked_by': req_agent}
                        }
                    else:
                        consensus[symbol] = {'consensus': 0.0, 'direction': 'Hold'}
                    continue
        # 2. Require specific signals from agents
        if require_signals:
            for agent, req_signal in require_signals.items():
                agent_out = agents_outputs.get(agent, {}).get(symbol, {})
                if not agent_out or agent_out.get('signal', 'Hold') != req_signal:
                    if explainability:
                        consensus[symbol] = {
                            'consensus': 0.0,
                            'direction': 'Hold',
                            'explain': {'blocked_by': agent, 'required_signal': req_signal}
                        }
                    else:
                        consensus[symbol] = {'consensus': 0.0, 'direction': 'Hold'}
                    continue

        # --- Regime-Switching Ensemble ---
        if regime_switching_func is not None:
            regime_weights = regime_switching_func(symbol, regime_context)
            if regime_weights and isinstance(regime_weights, dict):
                w = {k: v for k, v in regime_weights.items() if k in filtered_agents}
            else:
                w = {agent: 1.0 for agent in filtered_agents}
        # --- Dynamic Weighting ---
        elif dynamic_weights_func is not None:
            w = dynamic_weights_func(agents_outputs, symbol, dynamic_context)
            if not w or not isinstance(w, dict):
                w = {agent: 1.0 for agent in filtered_agents}
            else:
                w = {k: v for k, v in w.items() if k in filtered_agents}
        elif weights is not None:
            w = {k: v for k, v in weights.items() if k in filtered_agents}
        else:
            w = {agent: 1.0 for agent in filtered_agents}
        # --- Time-Decayed Aggregation ---
        if time_decay_func is not None:
            decay_w = time_decay_func(agents_outputs, symbol, time_decay_context)
            if decay_w and isinstance(decay_w, dict):
                for k in w:
                    w[k] = w[k] * decay_w.get(k, 1.0)
        # Normalize weights
        total_weight = sum(w.values())
        if total_weight == 0:
            total_weight = 1.0
        w = {k: v / total_weight for k, v in w.items()}

        # --- Bayesian Model Averaging ---
        if bayesian_averaging:
            # Use priors if provided, else uniform
            priors = bayesian_priors if bayesian_priors else {agent: 1.0 for agent in filtered_agents}
            # Normalize priors
            total_prior = sum(priors.values())
            if total_prior == 0:
                total_prior = 1.0
            priors = {k: v / total_prior for k, v in priors.items()}
            # For each agent, treat confidence as likelihood, update posterior
            posteriors = {}
            for agent in filtered_agents:
                raw = agents_outputs.get(agent, {}).get(symbol, {})
                conf = raw.get('confidence', 0.5)
                posteriors[agent] = priors.get(agent, 1.0) * conf
            # Normalize posteriors
            total_post = sum(posteriors.values())
            if total_post == 0:
                total_post = 1.0
            posteriors = {k: v / total_post for k, v in posteriors.items()}
            # Weighted sum of signals using posteriors
            score = 0
            agent_contrib = {} if explainability else None
            for agent in filtered_agents:
                raw = agents_outputs.get(agent, {}).get(symbol, {})
                sign = {'Buy': 1, 'Sell': -1, 'Hold': 0}.get(raw.get('signal', 'Hold'), 0)
                contrib = sign * posteriors.get(agent, 0)
                score += contrib
                if agent_contrib is not None:
                    agent_contrib[agent] = contrib
            # --- Signal Diversity Penalty/Bonus ---
            if diversity_penalty or diversity_bonus:
                sigs = [agents_outputs.get(agent, {}).get(symbol, {}).get('signal', 'Hold') for agent in filtered_agents]
                unique_sigs = set(sigs)
                if len(unique_sigs) == 1 and diversity_penalty:
                    score *= (1 - diversity_strength)
                elif len(unique_sigs) > 1 and diversity_bonus:
                    score *= (1 + diversity_strength)
            result = {
                'consensus': score,
                'direction': 'Buy' if score > 0.5 else 'Sell' if score < -0.5 else 'Hold',
                'bayesian_posteriors': posteriors
            }
            if explainability:
                result['explain'] = {'agent_contributions': agent_contrib}
            consensus[symbol] = result
            continue

        # --- Majority Voting ---
        if majority_vote:
            votes = []
            confs = []
            agent_vote_map = {} if explainability else None
            for agent in filtered_agents:
                raw = agents_outputs.get(agent, {}).get(symbol, {})
                signal = raw.get('signal', 'Hold')
                votes.append(signal)
                confs.append(raw.get('confidence', 0))
                if agent_vote_map is not None:
                    agent_vote_map[agent] = signal
            # Count votes
            from collections import Counter
            vote_counts = Counter(votes)
            top_vote, top_count = vote_counts.most_common(1)[0]
            # Check for tie
            tied = [k for k, v in vote_counts.items() if v == top_count]
            if len(tied) > 1:
                # Tie-break: use confidence sum, then priority
                conf_sums = {sig: sum([c for v, c in zip(votes, confs) if v == sig]) for sig in tied}
                max_conf = max(conf_sums.values())
                conf_tied = [sig for sig, s in conf_sums.items() if s == max_conf]
                if len(conf_tied) == 1:
                    final = conf_tied[0]
                elif majority_priority:
                    for agent in majority_priority:
                        idxs = [i for i, v in enumerate(votes) if v == conf_tied[0]]
                        if idxs:
                            final = votes[idxs[0]]
                            break
                    else:
                        final = conf_tied[0]
                else:
                    final = conf_tied[0]
            else:
                final = top_vote
            # --- Custom Rule-Based Aggregation: min_agree_count ---
            if min_agree_count is not None:
                if vote_counts[final] < min_agree_count:
                    result = {
                        'consensus': 0.0,
                        'direction': 'Hold',
                        'majority_counts': dict(vote_counts)
                    }
                    if explainability:
                        result['explain'] = {'min_agree_count': min_agree_count, 'actual_agree': vote_counts[final], 'agent_votes': agent_vote_map}
                    consensus[symbol] = result
                    continue
            # --- Signal Diversity Penalty/Bonus ---
            if diversity_penalty or diversity_bonus:
                unique_sigs = set(votes)
                if len(unique_sigs) == 1 and diversity_penalty:
                    consensus_score = 0.0 * (1 - diversity_strength)
                elif len(unique_sigs) > 1 and diversity_bonus:
                    consensus_score = 0.0 * (1 + diversity_strength)
                else:
                    consensus_score = 0.0
            else:
                consensus_score = 0.0
            result = {
                'consensus': consensus_score,
                'direction': final,
                'majority_counts': dict(vote_counts)
            }
            if explainability:
                result['explain'] = {'agent_votes': agent_vote_map}
            consensus[symbol] = result
        else:
            # --- Weighted Voting (static, dynamic, regime, or filtered) ---
            score = 0
            feature_vec = []
            agent_contrib = {} if explainability else None
            for agent in filtered_agents:
                raw = agents_outputs.get(agent, {}).get(symbol, {})
                sign = {'Buy': 1, 'Sell': -1, 'Hold': 0}.get(raw.get('signal', 'Hold'), 0)
                conf = raw.get('confidence', 0)
                contrib = sign * conf * w.get(agent, 1.0)
                score += contrib
                feature_vec.extend([sign, conf])
                if agent_contrib is not None:
                    agent_contrib[agent] = contrib
            # --- Custom Rule-Based Aggregation: min_agree_count ---
            if min_agree_count is not None:
                # Count number of agents with same direction as consensus
                dir_map = {1: 'Buy', -1: 'Sell', 0: 'Hold'}
                agent_dirs = [dir_map.get({'Buy': 1, 'Sell': -1, 'Hold': 0}.get(agents_outputs.get(agent, {}).get(symbol, {}).get('signal', 'Hold'), 0)) for agent in filtered_agents]
                # Find most common direction
                from collections import Counter
                dir_counts = Counter(agent_dirs)
                top_dir, top_count = dir_counts.most_common(1)[0]
                if top_count < min_agree_count:
                    result = {
                        'consensus': 0.0,
                        'direction': 'Hold',
                        'dir_counts': dict(dir_counts)
                    }
                    if explainability:
                        result['explain'] = {'min_agree_count': min_agree_count, 'actual_agree': top_count, 'agent_contributions': agent_contrib}
                    consensus[symbol] = result
                    continue
            # --- Signal Diversity Penalty/Bonus ---
            if diversity_penalty or diversity_bonus:
                sigs = [agents_outputs.get(agent, {}).get(symbol, {}).get('signal', 'Hold') for agent in filtered_agents]
                unique_sigs = set(sigs)
                if len(unique_sigs) == 1 and diversity_penalty:
                    score *= (1 - diversity_strength)
                elif len(unique_sigs) > 1 and diversity_bonus:
                    score *= (1 + diversity_strength)
            # Meta-model prediction (stacked ensemble)
            meta_pred = None
            if meta_model is not None:
                X = [meta_features[symbol]] if (meta_features and symbol in meta_features) else [feature_vec]
                try:
                    if hasattr(meta_model, 'predict_proba'):
                        proba = meta_model.predict_proba(X)[0]
                        pred_idx = int(np.argmax(proba))
                        pred_map = {0: 'Sell', 1: 'Hold', 2: 'Buy'}
                        meta_pred = {'proba': proba.tolist(), 'direction': pred_map.get(pred_idx, 'Hold')}
                    else:
                        pred = meta_model.predict(X)[0]
                        pred_map = {0: 'Sell', 1: 'Hold', 2: 'Buy'}
                        meta_pred = {'direction': pred_map.get(pred, 'Hold')}
                except Exception as e:
                    logger.error(f"Meta-model prediction failed for {symbol}: {e}")
                    meta_pred = None
            # --- Ensemble Confidence Calibration ---
            calibrated_score = score
            if calibrate_confidence_func is not None:
                calibrated_score = calibrate_confidence_func(score, agents_outputs, symbol, calibration_context)
            result = {
                'consensus': calibrated_score,
                'direction': 'Buy' if calibrated_score > 0.5 else 'Sell' if calibrated_score < -0.5 else 'Hold',
            }
            if meta_pred is not None:
                result['meta_pred'] = meta_pred
            if explainability:
                result['explain'] = {'agent_contributions': agent_contrib}
            consensus[symbol] = result
    return consensus

# === STRATEGY ENSEMBLE RUNNER ===
def run_all_strategies_and_ensemble(market_data_df, weights=None, meta_model=None, meta_features=None):
    """
    Runs all strategy agents, collects their signals, and returns the ensemble consensus.
    Supports weighted voting and stacked ensemble (meta-model).
    Args:
        market_data_df: pd.DataFrame with market data (must include 'symbol', 'close', etc.)
        weights: dict of {agent_name: float} (optional)
        meta_model: sklearn-like model (optional)
        meta_features: dict of {symbol: feature_vector} (optional)
    Returns:
        dict: {symbol: {'consensus': float, 'direction': str, 'meta_pred': optional}}
    """
    # If only one row per symbol (scanner summary), use a fallback ensemble logic
    if market_data_df.groupby('symbol').size().max() == 1:
        # Use the scanner's own signal and confidence columns if available
        agents_outputs = {}
        for _, row in market_data_df.iterrows():
            symbol = row['symbol']
            # Map scanner's signal to ensemble format
            signal = row['signal'] if 'signal' in row else 'Hold'
            confidence = float(row['confidence_score']) if 'confidence_score' in row else 0.5
            agents_outputs.setdefault('SCANNER', {})[symbol] = {
                'signal': signal,
                'confidence': confidence
            }
        return ensemble_signal(agents_outputs, weights=weights, meta_model=meta_model, meta_features=meta_features)
    # Otherwise, use the full time series strategies
    agents = [
        MeanReversionAgent(),
        MomentumBreakoutAgent(),
        VolatilityRegimeAgent(),
        PairsTradingAgent(),
        AnomalyDetectionAgent(),
        SentimentMomentumAgent(),
        RegimeChangeAgent(),
    ]
    agents_outputs = {}
    for agent in agents:
        result = agent.update({'market_data_df': market_data_df})
        for k, v in result.items():
            agents_outputs[k] = v
    return ensemble_signal(agents_outputs, weights=weights, meta_model=meta_model, meta_features=meta_features)


# === USAGE EXAMPLE ===
if __name__ == "__main__":
    import glob
    import os
    import glob
    import os
    import pandas as pd
    # Try to find the latest scan results CSV from the scanner
    scan_files = sorted(glob.glob("scan_results_daily_*.csv"), reverse=True)
    if scan_files:
        latest_scan = scan_files[0]
        print(f"Loading scan results from: {latest_scan}")
        market_data_df = pd.read_csv(latest_scan)
        # --- Patch: Map price->close and fill missing OHLCV columns ---
        if 'close' not in market_data_df.columns and 'price' in market_data_df.columns:
            market_data_df['close'] = market_data_df['price']
        for col in ['high', 'low', 'open', 'volume']:
            if col not in market_data_df.columns:
                market_data_df[col] = market_data_df['close']
        if 'timestamp' not in market_data_df.columns:
            market_data_df['timestamp'] = pd.Timestamp.now()

        # --- Diagnostic: Print DataFrame shape and columns ---
        print("\n[Diagnostic] Input DataFrame shape:", market_data_df.shape)
        print("[Diagnostic] Input DataFrame columns:", list(market_data_df.columns))
        print("[Diagnostic] First 2 rows:\n", market_data_df.head(2))

        print("\n=== Running Strategy Ensemble on Scanner Results ===")
        # --- Standard ensemble ---
        consensus = run_all_strategies_and_ensemble(market_data_df)
        print("\n[Standard Ensemble]")
        for symbol, result in consensus.items():
            meta_str = ''
            if 'meta_pred' in result:
                meta_str = f", Meta-Model: {result['meta_pred']}"
            print(f"{symbol}: Consensus Score = {result['consensus']:.2f}, Direction = {result['direction']}{meta_str}")

        # --- Custom Rule-Based Aggregation: Only act if at least 3 strategies agree ---
        print("\n[Custom Rule-Based Aggregation: min_agree_count=3]")
        # Rebuild agents_outputs for direct call
        agents = [
            MeanReversionAgent(),
            MomentumBreakoutAgent(),
            VolatilityRegimeAgent(),
            PairsTradingAgent(),
            AnomalyDetectionAgent(),
            SentimentMomentumAgent(),
            RegimeChangeAgent(),
        ]
        agents_outputs = {}
        for agent in agents:
            result = agent.update({'market_data_df': market_data_df})
            for k, v in result.items():
                agents_outputs[k] = v
        consensus_custom = ensemble_signal(
            agents_outputs,
            min_agree_count=3,
            explainability=True
        )
        for symbol, result in consensus_custom.items():
            explain = result.get('explain', {})
            print(f"{symbol}: Consensus = {result['consensus']:.2f}, Direction = {result['direction']}, Explain: {explain}")

        # --- Require confirmation from a specific strategy (e.g., MEAN_REVERSION must be 'Buy') ---
        print("\n[Custom Rule-Based Aggregation: require_signals={{'MEAN_REVERSION_signals': 'Buy'}}]")
        consensus_req = ensemble_signal(
            agents_outputs,
            require_signals={'MEAN_REVERSION_signals': 'Buy'},
            explainability=True
        )
        for symbol, result in consensus_req.items():
            explain = result.get('explain', {})
            print(f"{symbol}: Consensus = {result['consensus']:.2f}, Direction = {result['direction']}, Explain: {explain}")

        # --- Ensemble Explainability: Show agent contributions ---
        print("\n[Ensemble Explainability: agent_contributions]")
        consensus_explain = ensemble_signal(
            agents_outputs,
            explainability=True
        )
        for symbol, result in consensus_explain.items():
            explain = result.get('explain', {})
            print(f"{symbol}: Consensus = {result['consensus']:.2f}, Direction = {result['direction']}, Agent Contributions: {explain.get('agent_contributions', {})}")

    else:
        print("No scan_results_multitf_*.csv file found. Please run the scanner first.")

    print("\nUsage:\n"
        "1. After running the scanner, use the resulting DataFrame (scanner.scan_results) or the saved CSV (scan_results_multitf_*.csv or scan_results_daily_*.csv).\n"
        "2. Call run_all_strategies_and_ensemble(market_data_df, weights=..., meta_model=..., meta_features=..., min_agree_count=..., require_signals=..., explainability=...) to get the ensemble consensus.\n"
        "   - 'weights' is an optional dict of agent weights for weighted voting.\n"
        "   - 'meta_model' is an optional sklearn-like model for stacked ensemble.\n"
        "   - 'meta_features' is an optional dict of {symbol: feature_vector} for meta_model.\n"
        "   - 'min_agree_count', 'require_signals', 'explainability' are new advanced options.\n"
        "3. The result is a dict: {symbol: {'consensus': float, 'direction': str, ...}} where direction is 'Buy', 'Sell', or 'Hold'.\n"
        "4. You can integrate this with your trading logic, reporting, or further analysis.\n"
        "\n--- Programmatic Example ---\n"
        "from scanner import MomentumScanner\n"
        "from additional_strategies import run_all_strategies_and_ensemble, ensemble_signal\n"
        "scanner = MomentumScanner(...)  # configure as needed and run scan_market\n"
        "market_data_df = scanner.scan_results  # after scan_market()\n"
        "# Example: Weighted voting\n"
        "weights = {'MEAN_REVERSION': 1.5, 'MOMENTUM_BREAKOUT': 1.0, ...}\n"
        "consensus = run_all_strategies_and_ensemble(market_data_df, weights=weights)\n"
        "# Example: Custom rule-based aggregation\n"
        "consensus = ensemble_signal(agents_outputs, min_agree_count=3, explainability=True)\n"
        "# Example: Require confirmation from a specific strategy\n"
        "consensus = ensemble_signal(agents_outputs, require_signals={'MEAN_REVERSION_signals': 'Buy'}, explainability=True)\n"
        "# Example: Stacked ensemble (meta-model)\n"
        "from sklearn.linear_model import LogisticRegression\n"
        "meta_model = LogisticRegression()  # Train on historical agent outputs\n"
        "meta_features = {...}  # Dict of {symbol: feature_vector}\n"
        "consensus = run_all_strategies_and_ensemble(market_data_df, meta_model=meta_model, meta_features=meta_features)\n"
        "print(consensus)\n"
    )