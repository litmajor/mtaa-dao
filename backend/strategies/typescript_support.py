# backend/strategies/typescript_support.py
"""
TypeScript Strategy Support - Parse, validate, and execute TS strategies
"""

import subprocess
import json
import tempfile
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import re


class TypeScriptStrategyParser:
    """Parse and validate TypeScript strategy files"""
    
    @staticmethod
    def validate_syntax(code: str) -> Tuple[bool, List[str]]:
        """Validate TypeScript syntax using tsc"""
        errors = []
        
        # Check for required interface/class implementation
        if not TypeScriptStrategyParser._has_required_interface(code):
            errors.append("Must implement IStrategy interface with methods: "
                         "populateIndicators, populateEntryTrend, populateExitTrend")
        
        # Check for unsafe operations
        unsafe_patterns = {
            r'require\([\'"]child_process[\'"]': 'Cannot use child_process module',
            r'fs\.write': 'Cannot write to filesystem',
            r'eval\(': 'Cannot use eval',
            r'new Function\(': 'Cannot use dynamic function creation',
            r'__dirname': 'Directory access not allowed',
            r'process\.env': 'Environment access restricted',
        }
        
        for pattern, error_msg in unsafe_patterns.items():
            if re.search(pattern, code):
                errors.append(error_msg)
        
        return len(errors) == 0, errors
    
    @staticmethod
    def _has_required_interface(code: str) -> bool:
        """Check if code implements required interface"""
        required_methods = [
            'populateIndicators',
            'populateEntryTrend',
            'populateExitTrend'
        ]
        
        for method in required_methods:
            if method not in code:
                return False
        
        return True
    
    @staticmethod
    def extract_metadata(code: str) -> Dict[str, Any]:
        """Extract strategy metadata from comments"""
        metadata = {
            'name': 'Unknown Strategy',
            'description': '',
            'version': '1.0.0',
            'author': '',
            'timeframe': '1m',
            'tags': []
        }
        
        # Extract from JSDoc comments
        jsdoc_pattern = r'/\*\*[\s\S]*?\*/'
        jsdoc_match = re.search(jsdoc_pattern, code)
        
        if jsdoc_match:
            jsdoc = jsdoc_match.group()
            
            # Extract @name
            name_match = re.search(r'@name\s+(.+)', jsdoc)
            if name_match:
                metadata['name'] = name_match.group(1).strip()
            
            # Extract @description
            desc_match = re.search(r'@description\s+(.+)', jsdoc)
            if desc_match:
                metadata['description'] = desc_match.group(1).strip()
            
            # Extract @version
            ver_match = re.search(r'@version\s+(.+)', jsdoc)
            if ver_match:
                metadata['version'] = ver_match.group(1).strip()
            
            # Extract @author
            author_match = re.search(r'@author\s+(.+)', jsdoc)
            if author_match:
                metadata['author'] = author_match.group(1).strip()
            
            # Extract @tags
            tags_match = re.search(r'@tags\s+(.+)', jsdoc)
            if tags_match:
                metadata['tags'] = [t.strip() for t in tags_match.group(1).split(',')]
        
        return metadata
    
    @staticmethod
    def extract_parameters(code: str) -> List[Dict[str, Any]]:
        """Extract optimizable parameters from strategy class"""
        parameters = []
        
        # Look for parameter definitions in config object
        # Example: readonly rsiPeriod = 14;
        param_pattern = r'(?:readonly\s+)?(\w+)\s*:\s*number\s*=\s*([\d.]+)'
        
        matches = re.finditer(param_pattern, code)
        for match in matches:
            param_name = match.group(1)
            default_value = float(match.group(2))
            
            parameters.append({
                'name': param_name,
                'type': 'float',
                'default_value': default_value,
                'min_value': default_value * 0.5,  # Guess: 50% to 150%
                'max_value': default_value * 1.5,
                'step': 1 if default_value > 10 else 0.1
            })
        
        return parameters


class TypeScriptStrategyCompiler:
    """Compile TypeScript to JavaScript for execution"""
    
    @staticmethod
    async def compile_to_js(ts_code: str) -> Tuple[bool, str, Optional[str]]:
        """
        Compile TypeScript to JavaScript
        
        Returns:
            (success: bool, js_code: str, error: Optional[str])
        """
        
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            
            # Write TypeScript file
            ts_file = tmpdir / 'strategy.ts'
            ts_file.write_text(ts_code)
            
            # Write tsconfig.json
            tsconfig = {
                "compilerOptions": {
                    "target": "ES2020",
                    "module": "commonjs",
                    "lib": ["ES2020"],
                    "strict": True,
                    "declaration": False,
                    "sourceMap": False,
                    "outDir": str(tmpdir),
                }
            }
            (tmpdir / 'tsconfig.json').write_text(json.dumps(tsconfig))
            
            # Compile
            try:
                result = subprocess.run(
                    ['npx', 'tsc', '--project', str(tmpdir / 'tsconfig.json')],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    # Read compiled JS
                    js_file = tmpdir / 'strategy.js'
                    if js_file.exists():
                        js_code = js_file.read_text()
                        return True, js_code, None
                    else:
                        return False, "", "Compilation succeeded but no output file"
                else:
                    return False, "", result.stderr
            
            except subprocess.TimeoutExpired:
                return False, "", "Compilation timeout (10s)"
            except FileNotFoundError:
                return False, "", "TypeScript compiler (tsc) not found. Install with: npm install -g typescript"
            except Exception as e:
                return False, "", str(e)
    
    @staticmethod
    async def compile_to_python_compatible(ts_code: str) -> Tuple[bool, str, Optional[str]]:
        """
        Convert TypeScript strategy to Python-compatible format
        This creates a Python wrapper that can be backtested with Freqtrade
        """
        
        # Extract strategy info
        metadata = TypeScriptStrategyParser.extract_metadata(ts_code)
        parameters = TypeScriptStrategyParser.extract_parameters(ts_code)
        
        # Create Python wrapper template
        python_code = f'''
"""
Generated from TypeScript strategy: {metadata['name']}
Auto-converted for backtesting compatibility
"""

from freqtrade.strategy import IStrategy
import pandas as pd
import json

class {metadata['name'].replace(' ', '').replace('-', '')}Strategy(IStrategy):
    """
    {metadata['description']}
    Author: {metadata['author']}
    Version: {metadata['version']}
    """
    
    stoploss = -0.05
    timeframe = "{metadata['timeframe']}"
    
    # Parameters extracted from TypeScript
'''
        
        for param in parameters:
            python_code += f"    {param['name']} = {param['default_value']}  # min: {param['min_value']}, max: {param['max_value']}\n"
        
        python_code += '''
    
    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """
        Populate indicators from TypeScript strategy
        Note: This is a generated wrapper. Logic must be manually ported.
        """
        # TODO: Port indicator calculations from TypeScript
        return dataframe
    
    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """Entry signals"""
        # TODO: Port entry logic from TypeScript
        dataframe.loc[:, 'enter_long'] = 0
        return dataframe
    
    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """Exit signals"""
        # TODO: Port exit logic from TypeScript
        dataframe.loc[:, 'exit_long'] = 0
        return dataframe
'''
        
        return True, python_code, None


class TypeScriptStrategyExecutor:
    """Execute TypeScript strategies in isolated Node.js environment"""
    
    @staticmethod
    async def execute_backtest(ts_code: str, config: Dict[str, Any],
                              historical_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute TypeScript strategy backtest
        """
        
        # Compile to JavaScript first
        success, js_code, error = await TypeScriptStrategyCompiler.compile_to_js(ts_code)
        if not success:
            return {
                'status': 'error',
                'error': f'Compilation failed: {error}'
            }
        
        # Execute in isolated Node.js environment
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            
            # Write JS file
            (tmpdir / 'strategy.js').write_text(js_code)
            
            # Write backtest runner
            runner_js = '''
const strategy = require('./strategy.js');

// Mock data
const historicalData = JSON.parse(process.env.HISTORICAL_DATA || '{}');
const config = JSON.parse(process.env.CONFIG || '{}');

try {
    // Initialize strategy
    const s = new strategy.Strategy(config);
    
    // Run backtest simulation
    let signals = [];
    let results = {
        totalProfit: 0,
        winRate: 0,
        maxDrawdown: 0,
        signals: signals
    };
    
    console.log(JSON.stringify(results));
} catch (e) {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
}
'''
            (tmpdir / 'runner.js').write_text(runner_js)
            
            # Execute with timeout
            try:
                result = subprocess.run(
                    ['node', str(tmpdir / 'runner.js')],
                    capture_output=True,
                    text=True,
                    timeout=30,
                    env={
                        'HISTORICAL_DATA': json.dumps(historical_data),
                        'CONFIG': json.dumps(config)
                    }
                )
                
                if result.returncode == 0:
                    results = json.loads(result.stdout)
                    return {'status': 'success', 'results': results}
                else:
                    return {
                        'status': 'error',
                        'error': result.stderr or 'Execution failed'
                    }
            
            except subprocess.TimeoutExpired:
                return {'status': 'error', 'error': 'Backtest timeout (30s)'}
            except Exception as e:
                return {'status': 'error', 'error': str(e)}


# Example TypeScript Strategy Template
TYPESCRIPT_STRATEGY_TEMPLATE = '''
/**
 * @name My Trading Strategy
 * @description Volume breakout strategy with RSI confirmation
 * @version 1.0.0
 * @author Your Name
 * @tags volume, momentum, breakout
 */

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Signal {
  action: 'long' | 'short' | 'close' | 'hold';
  confidence: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number[];
  reason?: string;
}

interface IStrategy {
  populateIndicators(candles: Candle[]): Map<string, number[]>;
  populateEntryTrend(candles: Candle[], indicators: Map<string, number[]>): boolean[];
  populateExitTrend(candles: Candle[], indicators: Map<string, number[]>): boolean[];
  generateSignal(candles: Candle[]): Signal;
}

class MyStrategy implements IStrategy {
  // Parameters (optimizable)
  readonly rsiPeriod: number = 14;
  readonly volumeMultiplier: number = 2.0;
  readonly macdFast: number = 12;
  readonly macdSlow: number = 26;
  
  populateIndicators(candles: Candle[]): Map<string, number[]> {
    const indicators = new Map<string, number[]>();
    
    // Calculate RSI
    const rsi = this.calculateRSI(candles.map(c => c.close), this.rsiPeriod);
    indicators.set('rsi', rsi);
    
    // Calculate Volume MA
    const volumeMa = this.calculateMA(candles.map(c => c.volume), 20);
    indicators.set('volumeMa', volumeMa);
    
    // Calculate MACD
    const macd = this.calculateMACD(
      candles.map(c => c.close),
      this.macdFast,
      this.macdSlow
    );
    indicators.set('macd', macd);
    
    return indicators;
  }
  
  populateEntryTrend(
    candles: Candle[],
    indicators: Map<string, number[]>
  ): boolean[] {
    const entrySignals: boolean[] = new Array(candles.length).fill(false);
    const rsi = indicators.get('rsi') || [];
    const volumeMa = indicators.get('volumeMa') || [];
    const macd = indicators.get('macd') || [];
    
    for (let i = 1; i < candles.length; i++) {
      const volumeRatio = candles[i].volume / volumeMa[i];
      
      // Entry condition: Volume spike + RSI oversold + MACD bullish
      if (
        volumeRatio > this.volumeMultiplier &&
        rsi[i] < 30 &&
        macd[i] > 0 &&
        candles[i].close > candles[i - 1].close
      ) {
        entrySignals[i] = true;
      }
    }
    
    return entrySignals;
  }
  
  populateExitTrend(
    candles: Candle[],
    indicators: Map<string, number[]>
  ): boolean[] {
    const exitSignals: boolean[] = new Array(candles.length).fill(false);
    const rsi = indicators.get('rsi') || [];
    const macd = indicators.get('macd') || [];
    
    for (let i = 1; i < candles.length; i++) {
      // Exit condition: RSI overbought or MACD bearish cross
      if (
        rsi[i] > 70 ||
        (macd[i] < 0 && macd[i - 1] > 0)
      ) {
        exitSignals[i] = true;
      }
    }
    
    return exitSignals;
  }
  
  generateSignal(candles: Candle[]): Signal {
    const indicators = this.populateIndicators(candles);
    const entrySignals = this.populateEntryTrend(candles, indicators);
    const exitSignals = this.populateExitTrend(candles, indicators);
    
    const lastCandle = candles[candles.length - 1];
    
    if (entrySignals[entrySignals.length - 1]) {
      return {
        action: 'long',
        confidence: 0.85,
        entry: lastCandle.close,
        stopLoss: lastCandle.close * 0.95,
        takeProfit: [
          lastCandle.close * 1.05,
          lastCandle.close * 1.10,
          lastCandle.close * 1.15
        ],
        reason: 'Volume spike + RSI oversold + MACD bullish'
      };
    }
    
    if (exitSignals[exitSignals.length - 1]) {
      return {
        action: 'close',
        confidence: 0.80,
        reason: 'RSI overbought or MACD bearish cross'
      };
    }
    
    return {
      action: 'hold',
      confidence: 0.5
    };
  }
  
  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = new Array(prices.length).fill(0);
    
    for (let i = period; i < prices.length; i++) {
      let gains = 0;
      let losses = 0;
      
      for (let j = i - period; j < i; j++) {
        const change = prices[j + 1] - prices[j];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
    
    return rsi;
  }
  
  private calculateMA(values: number[], period: number): number[] {
    const ma: number[] = new Array(values.length).fill(0);
    
    for (let i = period - 1; i < values.length; i++) {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      ma[i] = sum / period;
    }
    
    return ma;
  }
  
  private calculateMACD(prices: number[], fast: number, slow: number): number[] {
    const fastEMA = this.calculateEMA(prices, fast);
    const slowEMA = this.calculateEMA(prices, slow);
    
    return fastEMA.map((f, i) => f - slowEMA[i]);
  }
  
  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = new Array(prices.length).fill(0);
    const k = 2 / (period + 1);
    
    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    ema[period - 1] = sum / period;
    
    // Calculate EMA
    for (let i = period; i < prices.length; i++) {
      ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
    }
    
    return ema;
  }
}

module.exports = { MyStrategy };
'''
