"""
🌌 Imagination Engine: Counterfactual Future Synthesis for MirrorCore-X

This engine generates synthetic future market scenarios and stress-tests strategies against them,
creating a "what-if" simulation layer that improves strategy robustness and risk awareness.

Core Components:
1. ScenarioGenerator: Creates plausible market futures with controlled randomization
2. CounterfactualSimulator: Runs strategies against generated scenarios
3. RobustnessScorer: Evaluates strategy survival rates across scenarios
4. MetaLearner: Adjusts strategy parameters based on scenario performance
5. ImaginationEngine: Orchestrates the entire counterfactual synthesis cycle
"""

import numpy as np
import pandas as pd
import asyncio
import logging
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict, deque
import json
import random
from scipy import stats
from sklearn.preprocessing import MinMaxScaler
import time

logger = logging.getLogger(__name__)

@dataclass
class MarketScenario:
    """Represents a synthetic future market scenario"""
    name: str
    description: str
    probability: float
    price_path: List[float]
    volume_path: List[float]
    volatility_regime: str  # 'LOW', 'MEDIUM', 'HIGH'
    trend_regime: str      # 'BULLISH', 'BEARISH', 'SIDEWAYS'
    duration_steps: int
    stress_events: List[Dict[str, Any]]  # Sudden moves, gaps, etc.
    
@dataclass
class StrategyPerformance:
    """Performance metrics for a strategy in a scenario"""
    strategy_name: str
    scenario_name: str
    total_pnl: float
    max_drawdown: float
    win_rate: float
    sharpe_ratio: float
    survival_rate: float  # 0-1: did strategy avoid catastrophic loss?
    stress_resistance: float  # How well it handled stress events

@dataclass
class ParameterOptimization:
    """Strategy parameter optimization suggestion"""
    strategy_name: str
    parameter_name: str
    current_value: Any
    suggested_value: Any
    improvement_score: float
    confidence: float

class ScenarioGenerator:
    """
    Generates diverse market scenarios based on current state and Oracle beliefs
    """
    
    def __init__(self, oracle_engine, current_market_data: List[Dict]):
        self.oracle_engine = oracle_engine
        self.current_data = current_market_data
        self.price_history = deque(maxlen=100)
        self.volume_history = deque(maxlen=100)
        self.scenario_templates = self._initialize_templates()
        
        # Extract current market state
        if current_market_data:
            self.current_price = current_market_data[-1].get('price', 100.0)
            self.current_volume = current_market_data[-1].get('volume', 1000.0)
            self.current_volatility = self._calculate_current_volatility()
        else:
            self.current_price = 100.0
            self.current_volume = 1000.0
            self.current_volatility = 0.02
            
    def _initialize_templates(self) -> Dict[str, Dict]:
        """Initialize scenario templates based on common market patterns"""
        return {
            'breakout_continuation': {
                'description': 'Strong breakout with momentum continuation',
                'base_probability': 0.15,
                'price_drift': 0.003,  # Daily drift
                'volatility_factor': 1.5,
                'trend_strength': 0.8
            },
            'false_breakout_reversal': {
                'description': 'Breakout fails, sharp reversal follows',
                'base_probability': 0.12,
                'price_drift': -0.002,
                'volatility_factor': 2.0,
                'trend_strength': -0.9
            },
            'consolidation_range': {
                'description': 'Sideways movement in tight range',
                'base_probability': 0.25,
                'price_drift': 0.0001,
                'volatility_factor': 0.6,
                'trend_strength': 0.1
            },
            'volatility_spike': {
                'description': 'Sudden volatility expansion',
                'base_probability': 0.08,
                'price_drift': 0.001,
                'volatility_factor': 3.0,
                'trend_strength': 0.3
            },
            'gradual_trend': {
                'description': 'Slow, steady directional movement',
                'base_probability': 0.20,
                'price_drift': 0.002,
                'volatility_factor': 0.8,
                'trend_strength': 0.6
            },
            'gap_and_go': {
                'description': 'Price gap followed by continuation',
                'base_probability': 0.05,
                'price_drift': 0.004,
                'volatility_factor': 1.8,
                'trend_strength': 0.9
            },
            'whipsaw_chop': {
                'description': 'Rapid direction changes, choppy action',
                'base_probability': 0.10,
                'price_drift': 0.0,
                'volatility_factor': 1.4,
                'trend_strength': 0.0
            },
            'news_shock': {
                'description': 'Sudden fundamental news impact',
                'base_probability': 0.05,
                'price_drift': 0.006,
                'volatility_factor': 2.5,
                'trend_strength': 0.8
            }
        }
        
    def _calculate_current_volatility(self) -> float:
        """Calculate current market volatility from recent data"""
        if len(self.current_data) < 10:
            return 0.02
            
        prices = [d['price'] for d in self.current_data[-20:]]
        returns = [np.log(prices[i]/prices[i-1]) for i in range(1, len(prices))]
        return float(np.std(returns)) if returns else 0.02
        
    def generate_scenarios(self, num_scenarios: int = 50, 
                         scenario_length: int = 50,
                         oracle_bias: bool = True) -> List[MarketScenario]:
        """
        Generate diverse market scenarios
        
        Args:
            num_scenarios: Number of scenarios to generate
            scenario_length: Steps per scenario
            oracle_bias: Whether to bias scenarios toward Oracle predictions
        """
        scenarios = []
        
        # Get Oracle beliefs if available
        oracle_beliefs = self._get_oracle_beliefs() if oracle_bias else {}
        
        for i in range(num_scenarios):
            # Select scenario template
            template_name = self._select_template(oracle_beliefs)
            template = self.scenario_templates[template_name]
            
            # Generate scenario
            scenario = self._generate_single_scenario(
                template_name, template, scenario_length, i
            )
            scenarios.append(scenario)
            
        # Ensure we have diverse scenario types
        scenarios = self._ensure_diversity(scenarios, num_scenarios)
        
        logger.info(f"Generated {len(scenarios)} market scenarios")
        return scenarios
        
    def _get_oracle_beliefs(self) -> Dict[str, float]:
        """Extract Oracle's current market beliefs"""
        try:
            # This would integrate with your Oracle's current state
            # For now, we'll simulate Oracle beliefs
            beliefs = {
                'bullish_probability': 0.6,
                'breakout_probability': 0.3,
                'volatility_expansion': 0.4,
                'trend_continuation': 0.5
            }
            return beliefs
        except Exception as e:
            logger.warning(f"Could not get Oracle beliefs: {e}")
            return {}
            
    def _select_template(self, oracle_beliefs: Dict[str, float]) -> str:
        """Select scenario template, biased by Oracle beliefs"""
        templates = self.scenario_templates.copy()
        
        # Adjust probabilities based on Oracle beliefs
        if oracle_beliefs:
            if oracle_beliefs.get('breakout_probability', 0) > 0.7:
                templates['breakout_continuation']['base_probability'] *= 2
                templates['false_breakout_reversal']['base_probability'] *= 0.5
                
            if oracle_beliefs.get('volatility_expansion', 0) > 0.6:
                templates['volatility_spike']['base_probability'] *= 1.8
                templates['consolidation_range']['base_probability'] *= 0.6
                
        # Weighted random selection
        names = list(templates.keys())
        weights = [templates[name]['base_probability'] for name in names]
        return np.random.choice(names, p=np.array(weights)/sum(weights))
        
    def _generate_single_scenario(self, template_name: str, template: Dict,
                                 length: int, scenario_id: int) -> MarketScenario:
        """Generate a single market scenario from template"""
        
        # Base parameters
        drift = template['price_drift']
        vol_factor = template['volatility_factor']
        base_vol = self.current_volatility * vol_factor
        
        # Generate price path using geometric Brownian motion with modifications
        dt = 1.0  # Daily steps
        price_path = [self.current_price]
        volume_path = [self.current_volume]
        
        # Add trend and volatility regime changes
        trend_changes = self._generate_regime_changes(length)
        stress_events = self._generate_stress_events(template_name, length)
        
        for step in range(length):
            # Get current regime
            current_trend = self._get_regime_at_step(trend_changes, step)
            
            # Adjust drift based on regime
            step_drift = drift * current_trend
            
            # Check for stress events
            stress_multiplier = 1.0
            for event in stress_events:
                if event['step'] == step:
                    stress_multiplier = event['intensity']
                    step_drift += event['direction'] * 0.02
                    
            # Generate price step
            random_shock = np.random.normal(0, base_vol * stress_multiplier)
            price_change = step_drift + random_shock
            new_price = price_path[-1] * (1 + price_change)
            price_path.append(max(new_price, 0.01))  # Prevent negative prices
            
            # Generate volume (correlated with volatility)
            vol_impact = abs(price_change) * 500
            base_volume_change = np.random.normal(0, 0.1)
            new_volume = volume_path[-1] * (1 + base_volume_change) + vol_impact
            volume_path.append(max(new_volume, 100))
            
        # Classify regimes
        volatility_regime = self._classify_volatility_regime(price_path)
        trend_regime = self._classify_trend_regime(price_path)
        
        return MarketScenario(
            name=f"{template_name}_{scenario_id}",
            description=template['description'],
            probability=template['base_probability'],
            price_path=price_path,
            volume_path=volume_path,
            volatility_regime=volatility_regime,
            trend_regime=trend_regime,
            duration_steps=length,
            stress_events=stress_events
        )
        
    def _generate_regime_changes(self, length: int) -> List[Tuple[int, float]]:
        """Generate trend regime changes throughout scenario"""
        changes = [(0, 1.0)]  # Start with positive trend
        
        # Add 1-3 regime changes
        num_changes = np.random.randint(1, 4)
        change_points = sorted(np.random.choice(range(10, length-10), num_changes, replace=False))
        
        for point in change_points:
            # Random trend strength: -1 (bearish) to 1 (bullish)
            trend_strength = np.random.uniform(-1, 1)
            changes.append((point, trend_strength))
            
        return changes
        
    def _generate_stress_events(self, template_name: str, length: int) -> List[Dict[str, Any]]:
        """Generate stress events for scenario"""
        events = []
        
        # Template-specific stress events
        if template_name == 'news_shock':
            # Major shock in middle
            shock_step = length // 2
            events.append({
                'step': shock_step,
                'type': 'news_shock',
                'intensity': 3.0,
                'direction': np.random.choice([-1, 1])
            })
            
        elif template_name == 'gap_and_go':
            # Gap at beginning
            events.append({
                'step': 2,
                'type': 'gap',
                'intensity': 2.0,
                'direction': 1
            })
            
        elif template_name == 'volatility_spike':
            # Multiple smaller volatility spikes
            for _ in range(3):
                step = np.random.randint(5, length-5)
                events.append({
                    'step': step,
                    'type': 'vol_spike',
                    'intensity': 2.5,
                    'direction': np.random.choice([-1, 1])
                })
                
        # Add random smaller events
        num_random = np.random.randint(0, 3)
        for _ in range(num_random):
            step = np.random.randint(10, length-10)
            events.append({
                'step': step,
                'type': 'random_shock',
                'intensity': np.random.uniform(1.2, 2.0),
                'direction': np.random.choice([-1, 1])
            })
            
        return events
        
    def _get_regime_at_step(self, changes: List[Tuple[int, float]], step: int) -> float:
        """Get trend regime strength at given step"""
        current_regime = 1.0
        for change_step, regime in changes:
            if step >= change_step:
                current_regime = regime
        return current_regime
        
    def _classify_volatility_regime(self, price_path: List[float]) -> str:
        """Classify volatility regime from price path"""
        returns = [np.log(price_path[i]/price_path[i-1]) for i in range(1, len(price_path))]
        vol = np.std(returns)
        
        if vol < 0.015:
            return 'LOW'
        elif vol > 0.04:
            return 'HIGH'
        else:
            return 'MEDIUM'
            
    def _classify_trend_regime(self, price_path: List[float]) -> str:
        """Classify trend regime from price path"""
        total_return = (price_path[-1] / price_path[0]) - 1
        
        if total_return > 0.05:
            return 'BULLISH'
        elif total_return < -0.05:
            return 'BEARISH'
        else:
            return 'SIDEWAYS'
            
    def _ensure_diversity(self, scenarios: List[MarketScenario], target_count: int) -> List[MarketScenario]:
        """Ensure we have diverse scenario types"""
        # Count scenario types
        type_counts = defaultdict(int)
        for scenario in scenarios:
            scenario_type = scenario.name.split('_')[0]
            type_counts[scenario_type] += 1
            
        # Add missing types if needed
        min_per_type = max(1, target_count // len(self.scenario_templates))
        
        for template_name in self.scenario_templates:
            if type_counts[template_name] < min_per_type:
                needed = min_per_type - type_counts[template_name]
                for i in range(needed):
                    scenario = self._generate_single_scenario(
                        template_name, 
                        self.scenario_templates[template_name],
                        50, 
                        len(scenarios) + i
                    )
                    scenarios.append(scenario)
                    
        return scenarios[:target_count]

class CounterfactualSimulator:
    """
    Runs strategies against synthetic scenarios and measures performance
    """
    
    def __init__(self, strategy_trainer, execution_daemon):
        self.strategy_trainer = strategy_trainer
        self.execution_daemon = execution_daemon
        self.simulation_results = defaultdict(list)
        
    async def simulate_strategy_in_scenario(self, strategy_name: str, 
                                          scenario: MarketScenario) -> StrategyPerformance:
        """
        Run a single strategy through a scenario and measure performance
        """
        try:
            # Reset strategy state for clean simulation
            strategy = self.strategy_trainer.strategies.get(strategy_name)
            if not strategy:
                logger.warning(f"Strategy {strategy_name} not found")
                return self._default_performance(strategy_name, scenario.name)
                
            # Convert scenario to market data format
            market_data = self._scenario_to_market_data(scenario)
            
            # Simulate trading through the scenario
            trades = []
            portfolio_value = 10000.0  # Starting value
            positions = {}
            drawdowns = []
            equity_curve = [portfolio_value]
            
            for step, data_point in enumerate(market_data):
                try:
                    # Get strategy signal
                    df = pd.DataFrame([data_point])
                    if hasattr(strategy, 'evaluate'):
                        signal = strategy.evaluate(df)
                    else:
                        # Use adapter
                        signal_data = strategy.update({'market_data_df': df})
                        signal = self._extract_signal_value(signal_data)
                        
                    # Generate trading directive
                    directive = self._signal_to_directive(signal, data_point, portfolio_value)
                    
                    # Execute trade (simulated)
                    if directive and directive.get('action') != 'hold':
                        trade = await self._simulate_execution(directive, data_point)
                        if trade:
                            trades.append(trade)
                            portfolio_value += trade['pnl']
                            equity_curve.append(portfolio_value)
                            
                            # Update positions
                            symbol = trade['symbol']
                            if trade['pnl'] > 0:  # Closed position
                                positions[symbol] = 0
                            else:  # Opened position
                                positions[symbol] = directive['amount']
                                
                    # Calculate drawdown
                    peak = max(equity_curve)
                    current_dd = (portfolio_value - peak) / peak
                    drawdowns.append(current_dd)
                    
                    # Check for stress events
                    stress_resistance = self._calculate_stress_resistance(
                        step, scenario.stress_events, trades, portfolio_value
                    )
                    
                except Exception as e:
                    logger.error(f"Simulation step {step} failed: {e}")
                    continue
                    
            # Calculate performance metrics
            return self._calculate_performance_metrics(
                strategy_name, scenario, trades, drawdowns, equity_curve
            )
            
        except Exception as e:
            logger.error(f"Scenario simulation failed: {e}")
            return self._default_performance(strategy_name, scenario.name)
            
    def _scenario_to_market_data(self, scenario: MarketScenario) -> List[Dict]:
        """Convert scenario to market data format"""
        market_data = []
        
        for i, (price, volume) in enumerate(zip(scenario.price_path, scenario.volume_path)):
            data_point = {
                'symbol': 'BTC/USDT',
                'price': price,
                'close': price,
                'high': price * 1.002,
                'low': price * 0.998,
                'open': scenario.price_path[i-1] if i > 0 else price,
                'volume': volume,
                'timestamp': time.time() + i * 60,  # 1-minute intervals
            }
            market_data.append(data_point)
            
        return market_data
        
    def _extract_signal_value(self, signal_data: Dict) -> float:
        """Extract numerical signal from strategy output"""
        if not signal_data:
            return 0.0
            
        # Look for signals in the data
        for key, value in signal_data.items():
            if 'signal' in key.lower():
                if isinstance(value, dict):
                    # Extract from first symbol
                    first_signal = list(value.values())[0] if value else {}
                    if isinstance(first_signal, dict):
                        signal_str = first_signal.get('signal', 'Hold')
                        confidence = first_signal.get('confidence', 0.5)
                        return self._convert_signal_to_value(signal_str, confidence)
                elif isinstance(value, (int, float)):
                    return float(value)
                elif isinstance(value, str):
                    return self._convert_signal_to_value(value, 0.5)
                    
        return 0.0
        
    def _convert_signal_to_value(self, signal_str: str, confidence: float) -> float:
        """Convert string signal to numerical value"""
        signal_map = {
            'Strong Buy': 1.0,
            'Buy': 0.7,
            'Hold': 0.0,
            'Sell': -0.7,
            'Strong Sell': -1.0
        }
        base_value = signal_map.get(signal_str, 0.0)
        return base_value * confidence
        
    def _signal_to_directive(self, signal: float, data_point: Dict, portfolio_value: float) -> Dict:
        """Convert signal to trading directive"""
        if abs(signal) < 0.3:  # Hold threshold
            return {'action': 'hold'}
            
        action = 'buy' if signal > 0 else 'sell'
        amount = min(abs(signal) * portfolio_value * 0.1 / data_point['price'], 100.0)
        
        return {
            'symbol': data_point['symbol'],
            'action': action,
            'amount': amount,
            'price': data_point['price'],
            'strategy': 'simulation'
        }
        
    async def _simulate_execution(self, directive: Dict, data_point: Dict) -> Dict:
        """Simulate trade execution"""
        # Simple simulation - assume fills at market price
        entry_price = directive['price']
        amount = directive['amount']
        
        # Simulate exit after 5 steps with some randomness
        exit_multiplier = 1.01 if directive['action'] == 'buy' else 0.99
        exit_price = entry_price * exit_multiplier * (1 + np.random.normal(0, 0.005))
        
        pnl = (exit_price - entry_price) * amount if directive['action'] == 'buy' else (entry_price - exit_price) * amount
        
        return {
            'symbol': directive['symbol'],
            'entry': entry_price,
            'exit': exit_price,
            'pnl': pnl,
            'strategy': directive.get('strategy', 'simulation'),
            'timestamp': data_point['timestamp']
        }
        
    def _calculate_stress_resistance(self, step: int, stress_events: List[Dict], 
                                   trades: List[Dict], portfolio_value: float) -> float:
        """Calculate how well strategy handled stress events"""
        stress_resistance = 1.0
        
        # Check if any stress events occurred recently
        for event in stress_events:
            if abs(step - event['step']) <= 3:  # Within 3 steps of stress event
                # Check recent trade performance
                recent_trades = [t for t in trades[-5:] if t['timestamp'] > time.time() - 300]
                if recent_trades:
                    avg_pnl = np.mean([t['pnl'] for t in recent_trades])
                    stress_resistance = max(0.0, 1.0 + float(avg_pnl) / 1000.0)  # Normalize
                    
        return stress_resistance
        
    def _calculate_performance_metrics(self, strategy_name: str, scenario: MarketScenario,
                                     trades: List[Dict], drawdowns: List[float],
                                     equity_curve: List[float]) -> StrategyPerformance:
        """Calculate comprehensive performance metrics"""
        
        if not trades:
            return self._default_performance(strategy_name, scenario.name)
            
        # Basic metrics
        total_pnl = sum(t['pnl'] for t in trades)
        wins = [t for t in trades if t['pnl'] > 0]
        win_rate = len(wins) / len(trades) if trades else 0.0
        max_drawdown = min(drawdowns) if drawdowns else 0.0
        
        # Sharpe ratio
        returns = [equity_curve[i] / equity_curve[i-1] - 1 for i in range(1, len(equity_curve))]
        if returns and np.std(returns) > 0:
            sharpe_ratio = np.mean(returns) / np.std(returns) * np.sqrt(252)  # Annualized
        else:
            sharpe_ratio = 0.0
            
        # Survival rate (did we avoid catastrophic loss?)
        survival_rate = 1.0 if max_drawdown > -0.2 else 0.0  # 20% max loss threshold
        
        # Stress resistance (average performance during stress events)
        stress_resistance = np.mean([
            self._calculate_stress_resistance(i, scenario.stress_events, trades, equity_curve[i])
            for i in range(len(equity_curve))
        ])
        
        return StrategyPerformance(
            strategy_name=strategy_name,
            scenario_name=scenario.name,
            total_pnl=float(total_pnl),
            max_drawdown=float(max_drawdown),
            win_rate=float(win_rate),
            sharpe_ratio=float(sharpe_ratio),
            survival_rate=float(survival_rate),
            stress_resistance=float(stress_resistance)
        )
        
    def _default_performance(self, strategy_name: str, scenario_name: str) -> StrategyPerformance:
        """Return default performance metrics for failed simulations"""
        return StrategyPerformance(
            strategy_name=strategy_name,
            scenario_name=scenario_name,
            total_pnl=0.0,
            max_drawdown=0.0,
            win_rate=0.0,
            sharpe_ratio=0.0,
            survival_rate=1.0,
            stress_resistance=0.5
        )

class RobustnessScorer:
    """
    Evaluates strategy robustness across multiple scenarios
    """
    
    def __init__(self):
        self.scenario_results = defaultdict(list)
        self.strategy_scores = {}
        
    def add_performance(self, performance: StrategyPerformance):
        """Add performance result from a scenario"""
        self.scenario_results[performance.strategy_name].append(performance)
        
    def calculate_robustness_scores(self) -> Dict[str, Dict[str, float]]:
        """Calculate comprehensive robustness scores for all strategies"""
        scores = {}
        
        for strategy_name, performances in self.scenario_results.items():
            if not performances:
                continue
                
            # Aggregate metrics
            total_pnls = [p.total_pnl for p in performances]
            survival_rates = [p.survival_rate for p in performances]
            stress_resistances = [p.stress_resistance for p in performances]
            max_drawdowns = [p.max_drawdown for p in performances]
            sharpe_ratios = [p.sharpe_ratio for p in performances]
            
            # Calculate robustness metrics
            scores[strategy_name] = {
                # Core performance
                'avg_pnl': np.mean(total_pnls),
                'pnl_consistency': 1.0 - (np.std(total_pnls) / (abs(np.mean(total_pnls)) + 1e-8)),
                
                # Risk metrics
                'survival_rate': np.mean(survival_rates),
                'worst_case_drawdown': min(max_drawdowns),
                'avg_drawdown': np.mean(max_drawdowns),
                
                # Stress testing
                'stress_resistance': np.mean(stress_resistances),
                'stress_consistency': 1.0 - np.std(stress_resistances),
                
                # Overall robustness
                'scenario_success_rate': len([p for p in performances if p.total_pnl > 0]) / len(performances),
                'sharpe_consistency': 1.0 - (np.std(sharpe_ratios) / (abs(np.mean(sharpe_ratios)) + 1e-8)),
                
                # Final composite score
                'robustness_score': self._calculate_composite_score(performances)
            }
            
        self.strategy_scores = scores
        return scores
        
    def _calculate_composite_score(self, performances: List[StrategyPerformance]) -> float:
        """Calculate a single composite robustness score"""
        if not performances:
            return 0.0

        # Weighted combination of key metrics
        weights = {
            'avg_pnl': 0.25,
            'survival_rate': 0.30,
            'stress_resistance': 0.20,
            'consistency': 0.25
        }

        avg_pnl = float(np.mean([p.total_pnl for p in performances]))
        survival_rate = float(np.mean([p.survival_rate for p in performances]))
        stress_resistance = float(np.mean([p.stress_resistance for p in performances]))

        # Consistency (lower std is better)
        pnl_std = float(np.std([p.total_pnl for p in performances]))
        consistency = max(0.0, 1.0 - pnl_std / (abs(avg_pnl) + 1e-8))

        # Normalize PnL component
        pnl_normalized = max(0.0, min(1.0, (avg_pnl + 1000) / 2000))  # Scale -1000 to +1000 -> 0 to 1

        composite = (
            pnl_normalized * weights['avg_pnl'] +
            survival_rate * weights['survival_rate'] +
            stress_resistance * weights['stress_resistance'] +
            consistency * weights['consistency']
        )
        return float(composite)
        
    def get_strategy_ranking(self) -> List[Tuple[str, float]]:
        """Get strategies ranked by robustness score"""
        if not self.strategy_scores:
            return []
            
        rankings = [(name, scores['robustness_score']) 
                   for name, scores in self.strategy_scores.items()]
        return sorted(rankings, key=lambda x: x[1], reverse=True)
        
    def get_vulnerability_report(self) -> Dict[str, List[str]]:
        """Identify strategy vulnerabilities"""
        vulnerabilities = defaultdict(list)
        
        for strategy_name, performances in self.scenario_results.items():
            # Identify problematic scenarios
            poor_performances = [p for p in performances if p.total_pnl < -100]
            
            if poor_performances:
                # Analyze common failure patterns
                scenario_types = [p.scenario_name.split('_')[0] for p in poor_performances]
                failure_scenarios = defaultdict(int)
                
                for scenario_type in scenario_types:
                    failure_scenarios[scenario_type] += 1
                
                # Report vulnerabilities
                for scenario_type, count in failure_scenarios.items():
                    if count >= 2:  # Consistent failure
                        vulnerabilities[strategy_name].append(
                            f"Vulnerable to {scenario_type} scenarios ({count} failures)"
                        )
                        
            # Check for specific vulnerability patterns
            high_drawdown_scenarios = [p for p in performances if p.max_drawdown < -0.15]
            if len(high_drawdown_scenarios) > len(performances) * 0.3:
                vulnerabilities[strategy_name].append("High drawdown risk in 30%+ scenarios")
                
            low_stress_resistance = [p for p in performances if p.stress_resistance < 0.3]
            if len(low_stress_resistance) > len(performances) * 0.4:
                vulnerabilities[strategy_name].append("Poor stress event handling")
                
            low_survival_rate = [p for p in performances if p.survival_rate < 0.5]
            if len(low_survival_rate) > len(performances) * 0.2:
                vulnerabilities[strategy_name].append("High catastrophic failure risk")
        
        return dict(vulnerabilities)

class MetaLearner:
    """
    Learns from scenario performance to suggest strategy parameter improvements
    """
    
    def __init__(self):
        self.parameter_history = defaultdict(list)
        self.performance_history = defaultdict(list)
        self.optimization_suggestions = defaultdict(list)
        
    def analyze_parameter_sensitivity(self, strategy_name: str, 
                                    performances: List[StrategyPerformance],
                                    strategy_parameters: Dict[str, Any]) -> List[ParameterOptimization]:
        """
        Analyze which parameters correlate with better performance
        """
        suggestions = []
        
        if not performances:
            return suggestions
            
        # Group performances by scenario characteristics
        regime_performance = self._group_by_regime(performances)
        
        # Analyze parameter effectiveness across different regimes
        for param_name, param_value in strategy_parameters.items():
            optimization = self._analyze_single_parameter(
                strategy_name, param_name, param_value, regime_performance
            )
            if optimization:
                suggestions.append(optimization)
                
        return suggestions
        
    def _group_by_regime(self, performances: List[StrategyPerformance]) -> Dict[str, List[StrategyPerformance]]:
        """Group performances by market regime characteristics"""
        regime_groups = {
            'high_volatility': [],
            'low_volatility': [],
            'bullish_trend': [],
            'bearish_trend': [],
            'sideways_trend': [],
            'stress_events': []
        }
        
        for perf in performances:
            scenario_name = perf.scenario_name.lower()
            
            # Categorize by scenario type
            if 'volatility' in scenario_name or 'spike' in scenario_name:
                regime_groups['high_volatility'].append(perf)
            elif 'consolidation' in scenario_name or 'range' in scenario_name:
                regime_groups['low_volatility'].append(perf)
            elif 'breakout' in scenario_name or 'trend' in scenario_name:
                if 'reversal' in scenario_name:
                    regime_groups['bearish_trend'].append(perf)
                else:
                    regime_groups['bullish_trend'].append(perf)
            elif 'whipsaw' in scenario_name or 'chop' in scenario_name:
                regime_groups['sideways_trend'].append(perf)
            elif 'shock' in scenario_name or 'gap' in scenario_name:
                regime_groups['stress_events'].append(perf)
                
        return regime_groups
        
    def _analyze_single_parameter(self, strategy_name: str, param_name: str, 
                                current_value: Any, regime_performance: Dict) -> Optional[ParameterOptimization]:
        """Analyze a single parameter for optimization opportunities"""
        
        # Skip non-numeric parameters for now
        if not isinstance(current_value, (int, float)):
            return None
            
        # Calculate performance across regimes
        regime_scores = {}
        for regime, perfs in regime_performance.items():
            if perfs:
                avg_score = np.mean([p.total_pnl for p in perfs])
                regime_scores[regime] = avg_score
                
        # Determine parameter adjustment based on poor-performing regimes
        worst_regime = min(regime_scores.items(), key=lambda x: x[1]) if regime_scores else None
        
        if not worst_regime or worst_regime[1] > -50:  # Not significantly poor
            return None
            
        # Suggest parameter adjustments based on regime
        suggested_value = self._suggest_parameter_adjustment(
            param_name, current_value, worst_regime[0]
        )
        
        if suggested_value == current_value:
            return None
            
        # Calculate improvement confidence
        confidence = self._calculate_improvement_confidence(
            regime_scores, worst_regime[0]
        )
        
        improvement_score = abs(worst_regime[1]) / 100.0  # Normalize improvement potential
        
        return ParameterOptimization(
            strategy_name=strategy_name,
            parameter_name=param_name,
            current_value=current_value,
            suggested_value=suggested_value,
            improvement_score=improvement_score,
            confidence=confidence
        )
        
    def _suggest_parameter_adjustment(self, param_name: str, current_value: float, 
                                    worst_regime: str) -> float:
        """Suggest parameter adjustments based on poor-performing regime"""
        
        param_adjustments = {
            'high_volatility': {
                'stop_loss': lambda x: x * 0.8,  # Tighter stops in high vol
                'take_profit': lambda x: x * 1.2,  # Wider targets
                'position_size': lambda x: x * 0.7,  # Smaller positions
                'rsi_threshold': lambda x: max(20, x - 5),  # More conservative
                'ma_period': lambda x: max(5, x - 2),  # Faster response
            },
            'low_volatility': {
                'stop_loss': lambda x: x * 1.2,  # Wider stops
                'take_profit': lambda x: x * 0.8,  # Tighter targets
                'position_size': lambda x: x * 1.3,  # Larger positions
                'rsi_threshold': lambda x: min(80, x + 5),  # More aggressive
                'ma_period': lambda x: x + 3,  # Slower response
            },
            'stress_events': {
                'stop_loss': lambda x: x * 0.6,  # Very tight stops
                'position_size': lambda x: x * 0.5,  # Much smaller positions
                'rsi_threshold': lambda x: max(15, x - 10),  # Very conservative
                'volatility_filter': lambda x: x * 1.5,  # Stronger filter
            },
            'sideways_trend': {
                'ma_period': lambda x: max(3, x - 5),  # Much faster
                'bollinger_period': lambda x: max(10, x - 5),  # Faster bands
                'rsi_threshold': lambda x: 50,  # Neutral threshold
            }
        }
        
        regime_adjustments = param_adjustments.get(worst_regime, {})
        
        # Find matching parameter adjustment
        for param_pattern, adjustment_func in regime_adjustments.items():
            if param_pattern.lower() in param_name.lower():
                try:
                    return adjustment_func(current_value)
                except:
                    continue
                    
        # Default adjustments based on parameter name patterns
        if 'stop' in param_name.lower() or 'loss' in param_name.lower():
            return current_value * 0.9  # Tighter stops generally
        elif 'size' in param_name.lower() or 'amount' in param_name.lower():
            return current_value * 0.8  # Smaller positions generally
        elif 'period' in param_name.lower() or 'window' in param_name.lower():
            return max(3, current_value - 2)  # Faster response generally
            
        return current_value
        
    def _calculate_improvement_confidence(self, regime_scores: Dict, worst_regime: str) -> float:
        """Calculate confidence in parameter improvement suggestion"""
        if not regime_scores:
            return 0.5
            
        worst_score = regime_scores[worst_regime]
        other_scores = [score for regime, score in regime_scores.items() if regime != worst_regime]
        
        if not other_scores:
            return 0.5
            
        avg_other = np.mean(other_scores)
        
        # Higher confidence if the worst regime is significantly worse
        score_gap = abs(worst_score - avg_other)
        confidence = min(1.0, score_gap / 200.0)  # Normalize to 0-1
        
        return confidence
        
    def update_parameter_history(self, strategy_name: str, parameters: Dict[str, Any], 
                               performance_score: float):
        """Track parameter changes and their impact"""
        self.parameter_history[strategy_name].append({
            'parameters': parameters.copy(),
            'performance': performance_score,
            'timestamp': time.time()
        })
        
        # Keep only recent history
        if len(self.parameter_history[strategy_name]) > 50:
            self.parameter_history[strategy_name] = self.parameter_history[strategy_name][-30:]

class ImaginationEngine:
    """
    Main orchestrator for counterfactual future synthesis and strategy optimization
    """
    
    def __init__(self, oracle_engine, strategy_trainer, execution_daemon):
        self.oracle_engine = oracle_engine
        self.strategy_trainer = strategy_trainer
        self.execution_daemon = execution_daemon
        
        # Core components
        self.scenario_generator = None
        self.simulator = CounterfactualSimulator(strategy_trainer, execution_daemon)
        self.robustness_scorer = RobustnessScorer()
        self.meta_learner = MetaLearner()
        
        # State tracking
        self.last_analysis_time = 0
        self.analysis_interval = 3600  # 1 hour
        self.scenario_cache = []
        self.is_running = False
        
        # Configuration
        self.config = {
            'num_scenarios': 100,
            'scenario_length': 50,
            'min_strategies_for_analysis': 2,
            'robustness_threshold': 0.6,
            'reanalysis_trigger_threshold': 0.3  # Trigger reanalysis if robustness drops
        }
        
    async def initialize(self, current_market_data: List[Dict]):
        """Initialize the imagination engine with current market state"""
        try:
            self.scenario_generator = ScenarioGenerator(self.oracle_engine, current_market_data)
            logger.info("🌌 Imagination Engine initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Imagination Engine: {e}")
            return False
            
    async def run_counterfactual_analysis(self, force_update: bool = False) -> Dict[str, Any]:
        """
        Main analysis cycle: generate scenarios, test strategies, optimize
        """
        if not self.scenario_generator:
            logger.warning("Imagination Engine not initialized")
            return {}
            
        current_time = time.time()
        
        # Check if analysis is needed
        if not force_update and (current_time - self.last_analysis_time) < self.analysis_interval:
            logger.debug("Skipping analysis - too recent")
            return self._get_cached_results()
            
        # Check if we have enough strategies to analyze
        available_strategies = list(self.strategy_trainer.strategies.keys())
        if len(available_strategies) < self.config['min_strategies_for_analysis']:
            logger.info(f"Only {len(available_strategies)} strategies available, skipping analysis")
            return {}
            
        self.is_running = True
        logger.info("🎭 Starting counterfactual analysis cycle...")
        
        try:
            # Step 1: Generate diverse market scenarios
            scenarios = await self._generate_scenarios()
            
            # Step 2: Test all strategies against all scenarios
            await self._run_scenario_testing(scenarios, available_strategies)
            
            # Step 3: Calculate robustness scores
            robustness_scores = self.robustness_scorer.calculate_robustness_scores()
            
            # Step 4: Identify vulnerabilities
            vulnerabilities = self.robustness_scorer.get_vulnerability_report()
            
            # Step 5: Generate optimization suggestions
            optimizations = await self._generate_optimizations(available_strategies)
            
            # Step 6: Update strategy parameters if needed
            await self._apply_optimizations(optimizations)
            
            # Step 7: Compile results
            results = {
                'analysis_timestamp': current_time,
                'scenarios_tested': len(scenarios),
                'strategies_analyzed': len(available_strategies),
                'robustness_scores': robustness_scores,
                'strategy_rankings': self.robustness_scorer.get_strategy_ranking(),
                'vulnerabilities': vulnerabilities,
                'optimizations': optimizations,
                'summary': self._generate_analysis_summary(robustness_scores, vulnerabilities)
            }
            
            self.last_analysis_time = current_time
            logger.info("✨ Counterfactual analysis completed")
            
            return results
            
        except Exception as e:
            logger.error(f"Counterfactual analysis failed: {e}")
            return {}
        finally:
            self.is_running = False
            
    async def _generate_scenarios(self) -> List[MarketScenario]:
        """Generate diverse market scenarios for testing"""
        try:
            if self.scenario_generator is None:
                logger.error("Scenario generator is not initialized.")
                return []
            scenarios = self.scenario_generator.generate_scenarios(
                num_scenarios=self.config['num_scenarios'],
                scenario_length=self.config['scenario_length'],
                oracle_bias=True
            )
            self.scenario_cache = scenarios
            logger.info(f"Generated {len(scenarios)} scenarios")
            # Log scenario distribution
            scenario_types = defaultdict(int)
            for scenario in scenarios:
                scenario_type = scenario.name.split('_')[0]
                scenario_types[scenario_type] += 1
            logger.info(f"Scenario distribution: {dict(scenario_types)}")
            return scenarios
        except Exception as e:
            logger.error(f"Scenario generation failed: {e}")
            return []
            
    async def _run_scenario_testing(self, scenarios: List[MarketScenario], 
                                  strategy_names: List[str]):
        """Test all strategies against all scenarios"""
        total_tests = len(scenarios) * len(strategy_names)
        completed_tests = 0
        
        logger.info(f"Running {total_tests} strategy-scenario combinations...")
        
        # Reset robustness scorer
        self.robustness_scorer = RobustnessScorer()
        
        # Test strategies in parallel batches
        batch_size = min(10, len(scenarios))
        
        for i in range(0, len(scenarios), batch_size):
            batch_scenarios = scenarios[i:i+batch_size]
            batch_tasks = []
            
            for scenario in batch_scenarios:
                for strategy_name in strategy_names:
                    task = self.simulator.simulate_strategy_in_scenario(strategy_name, scenario)
                    batch_tasks.append(task)
                    
            # Execute batch
            try:
                performances = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                for performance in performances:
                    if isinstance(performance, StrategyPerformance):
                        self.robustness_scorer.add_performance(performance)
                        completed_tests += 1
                    elif isinstance(performance, Exception):
                        logger.warning(f"Simulation failed: {performance}")
                        
            except Exception as e:
                logger.error(f"Batch simulation failed: {e}")
                
        logger.info(f"Completed {completed_tests}/{total_tests} simulations")
        
    async def _generate_optimizations(self, strategy_names: List[str]) -> List[ParameterOptimization]:
        """Generate parameter optimization suggestions"""
        all_optimizations = []
        
        for strategy_name in strategy_names:
            try:
                # Get strategy performances
                performances = self.robustness_scorer.scenario_results.get(strategy_name, [])
                if not performances:
                    continue
                    
                # Get current strategy parameters
                strategy = self.strategy_trainer.strategies.get(strategy_name)
                if not strategy or not hasattr(strategy, 'get_parameters'):
                    continue
                    
                parameters = strategy.get_parameters() if hasattr(strategy, 'get_parameters') else {}
                
                # Generate optimization suggestions
                optimizations = self.meta_learner.analyze_parameter_sensitivity(
                    strategy_name, performances, parameters
                )
                
                all_optimizations.extend(optimizations)
                
            except Exception as e:
                logger.error(f"Optimization generation failed for {strategy_name}: {e}")
                
        return all_optimizations
        
    async def _apply_optimizations(self, optimizations: List[ParameterOptimization]):
        """Apply high-confidence optimizations to strategies"""
        high_confidence_threshold = 0.7
        
        applied_count = 0
        
        for opt in optimizations:
            if opt.confidence >= high_confidence_threshold and opt.improvement_score > 0.3:
                try:
                    strategy = self.strategy_trainer.strategies.get(opt.strategy_name)
                    if strategy and hasattr(strategy, 'update_parameter'):
                        strategy.update_parameter(opt.parameter_name, opt.suggested_value)
                        applied_count += 1
                        
                        logger.info(f"Applied optimization: {opt.strategy_name}.{opt.parameter_name} "
                                  f"{opt.current_value} -> {opt.suggested_value}")
                        
                except Exception as e:
                    logger.error(f"Failed to apply optimization: {e}")
                    
        if applied_count > 0:
            logger.info(f"Applied {applied_count} parameter optimizations")
            
    def _generate_analysis_summary(self, robustness_scores: Dict, 
                                 vulnerabilities: Dict) -> Dict[str, Any]:
        """Generate human-readable analysis summary"""
        if not robustness_scores:
            return {"status": "No strategies analyzed"}
            
        # Find best and worst strategies
        rankings = self.robustness_scorer.get_strategy_ranking()
        best_strategy = rankings[0] if rankings else None
        worst_strategy = rankings[-1] if rankings else None
        
        # Count total vulnerabilities
        total_vulnerabilities = sum(len(vulns) for vulns in vulnerabilities.values())
        
        # Calculate average robustness
        avg_robustness = np.mean([scores['robustness_score'] for scores in robustness_scores.values()])
        
        summary = {
            "status": "Analysis completed",
            "strategies_analyzed": len(robustness_scores),
            "average_robustness": round(avg_robustness, 3),
            "best_strategy": {
                "name": best_strategy[0] if best_strategy else None,
                "score": round(best_strategy[1], 3) if best_strategy else 0
            },
            "worst_strategy": {
                "name": worst_strategy[0] if worst_strategy else None,
                "score": round(worst_strategy[1], 3) if worst_strategy else 0
            },
            "total_vulnerabilities": total_vulnerabilities,
            "high_risk_strategies": len([s for s, scores in robustness_scores.items() 
                                       if scores['robustness_score'] < self.config['robustness_threshold']]),
            "recommendations": self._generate_recommendations(robustness_scores, vulnerabilities)
        }
        
        return summary
        
    def _generate_recommendations(self, robustness_scores: Dict, 
                                vulnerabilities: Dict) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Low robustness strategies
        low_robustness = [name for name, scores in robustness_scores.items() 
                         if scores['robustness_score'] < self.config['robustness_threshold']]
        
        if low_robustness:
            recommendations.append(f"Review {len(low_robustness)} strategies with low robustness scores")
            
        # High vulnerability strategies
        high_vuln = [name for name, vulns in vulnerabilities.items() if len(vulns) >= 3]
        if high_vuln:
            recommendations.append(f"Address vulnerabilities in {len(high_vuln)} strategies")
            
        # Stress resistance issues
        poor_stress = [name for name, scores in robustness_scores.items() 
                      if scores.get('stress_resistance', 1.0) < 0.4]
        if poor_stress:
            recommendations.append(f"Improve stress resistance for {len(poor_stress)} strategies")
            
        # Survival rate issues
        poor_survival = [name for name, scores in robustness_scores.items() 
                        if scores.get('survival_rate', 1.0) < 0.8]
        if len(poor_survival) > 0:
            recommendations.append(f"Reduce catastrophic risk for {len(poor_survival)} strategies")
            
        if not recommendations:
            recommendations.append("All strategies show good robustness across scenarios")
            
        return recommendations
        
    def _get_cached_results(self) -> Dict[str, Any]:
        """Return cached analysis results"""
        return {
            "status": "Using cached results",
            "last_analysis": self.last_analysis_time,
            "cache_age_minutes": (time.time() - self.last_analysis_time) / 60
        }
        
    def get_status(self) -> Dict[str, Any]:
        """Get current imagination engine status"""
        return {
            "initialized": self.scenario_generator is not None,
            "running": self.is_running,
            "last_analysis": self.last_analysis_time,
            "cached_scenarios": len(self.scenario_cache),
            "config": self.config.copy()
        }
        
    async def force_reanalysis(self) -> Dict[str, Any]:
        """Force immediate reanalysis regardless of timing"""
        logger.info("🔄 Forcing immediate counterfactual reanalysis")
        return await self.run_counterfactual_analysis(force_update=True)

# Example usage and integration
async def main():
    """Example usage of the Imagination Engine"""
    
    # Mock dependencies (replace with actual instances)
    class MockOracle:
        pass
        
    class MockStrategyTrainer:
        def __init__(self):
            class Strategy:
                def get_parameters(self):
                    return {'rsi_threshold': 70, 'stop_loss': 0.02}
                def update_parameter(self, name, value):
                    pass
                def update(self, data):
                    # Simulate a signal output for testing
                    return {'signal': 'Buy', 'confidence': 0.7}

            class MAStrategy:
                def get_parameters(self):
                    return {'ma_period': 20, 'position_size': 0.1}
                def update_parameter(self, name, value):
                    pass
                def update(self, data):
                    return {'signal': 'Hold', 'confidence': 0.5}

            self.strategies = {
                'rsi_strategy': Strategy(),
                'ma_strategy': MAStrategy()
            }
            
    class MockExecutionDaemon:
        pass
        
    # Sample market data
    sample_data = [
        {'price': 100.0 + i, 'volume': 1000 + i*10, 'timestamp': time.time() - i * 60}
        for i in range(100, 0, -1)
    ]
    
    # Initialize components
    oracle = MockOracle()
    trainer = MockStrategyTrainer()
    daemon = MockExecutionDaemon()
    
    # Create and run imagination engine
    engine = ImaginationEngine(oracle, trainer, daemon)
    
    if await engine.initialize(sample_data):
        results = await engine.run_counterfactual_analysis()
        
        print("🌌 Imagination Engine Results:")
        print(f"Strategies analyzed: {results.get('strategies_analyzed', 0)}")
        print(f"Scenarios tested: {results.get('scenarios_tested', 0)}")
        print(f"Summary: {results.get('summary', {})}")
        
        # Pretty print robustness scores
        print("\nRobustness Scores:")
        for strategy, scores in results.get('robustness_scores', {}).items():
            print(f"{strategy}:")
            for key, value in scores.items():
                print(f"  - {key}: {value:.3f}")
        
        # Vulnerabilities
        print("\nVulnerabilities:")
        for strategy, vulns in results.get('vulnerabilities', {}).items():
            if vulns:
                print(f"{strategy}:")
                for vuln in vulns:
                    print(f"  - {vuln}")
        
        # Optimizations
        print("\nOptimizations:")
        for opt in results.get('optimizations', []):
            print(f"{opt.strategy_name}.{opt.parameter_name}: {opt.current_value} -> {opt.suggested_value} (confidence: {opt.confidence:.2f})")
        
        return results
    else:
        print("❌ Failed to initialize Imagination Engine")
        return None

if __name__ == "__main__":
    asyncio.run(main())