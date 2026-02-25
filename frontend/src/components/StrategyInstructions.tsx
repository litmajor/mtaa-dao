# frontend/src/components/StrategyInstructions.tsx
"""
In-app instructions and guidance for users uploading strategies
"""

import React, { useState } from 'react';

interface InstructionStep {
  id: number;
  title: string;
  description: string;
  code?: string;
  language?: string;
  tips?: string[];
}

const PYTHON_INSTRUCTIONS: InstructionStep[] = [
  {
    id: 1,
    title: "Import Required Libraries",
    description: "Every Freqtrade strategy must inherit from IStrategy",
    code: `from freqtrade.strategy import IStrategy
import pandas as pd
import talib`,
    language: "python",
    tips: [
      "Use 'talib' for technical analysis (RSI, MACD, Bollinger Bands)",
      "Use 'pandas' for DataFrame manipulation",
      "pandas_ta is also available for additional indicators"
    ]
  },
  {
    id: 2,
    title: "Create Strategy Class",
    description: "Implement the required methods for entry/exit signals",
    code: `class MyStrategy(IStrategy):
    stoploss = -0.05  # 5% hard stop loss
    timeframe = "1m"  # 1m, 5m, 15m, 1h, 4h, 1d
    
    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Add all indicators here
        return dataframe
    
    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Define buy signals: dataframe.loc[conditions, 'enter_long'] = 1
        return dataframe
    
    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Define sell signals: dataframe.loc[conditions, 'exit_long'] = 1
        return dataframe`,
    language: "python",
    tips: [
      "stoploss is required (negative number, e.g., -0.05 for 5%)",
      "timeframe must match your strategy logic",
      "All three methods are mandatory"
    ]
  },
  {
    id: 3,
    title: "Populate Indicators",
    description: "Calculate technical indicators for your strategy",
    code: `def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
    # Volume analysis
    dataframe['volume_ma'] = dataframe['volume'].rolling(window=20).mean()
    dataframe['volume_ratio'] = dataframe['volume'] / dataframe['volume_ma']
    
    # RSI
    dataframe['rsi'] = talib.RSI(dataframe['close'], timeperiod=14)
    
    # MACD
    dataframe['macd'], dataframe['macd_signal'], dataframe['macd_hist'] = \\
        talib.MACD(dataframe['close'], fastperiod=12, slowperiod=26, signalperiod=9)
    
    return dataframe`,
    language: "python",
    tips: [
      "Add new columns to dataframe for each indicator",
      "Use rolling() for moving averages",
      "talib functions are fast and reliable"
    ]
  },
  {
    id: 4,
    title: "Define Entry Signals",
    description: "Set enter_long = 1 when you want to buy",
    code: `def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
    dataframe.loc[
        (
            (dataframe['volume_ratio'] > 2.0) &  # Volume spike
            (dataframe['rsi'] < 30) &            # Oversold
            (dataframe['macd'] > dataframe['macd_signal']) &  # Bullish
            (dataframe['close'] > dataframe['close'].shift(1))
        ),
        'enter_long'] = 1
    
    return dataframe`,
    language: "python",
    tips: [
      "Use & for AND, | for OR conditions",
      "Use .shift(1) to compare with previous candle",
      "test multiple conditions to avoid false signals"
    ]
  },
  {
    id: 5,
    title: "Define Exit Signals",
    description: "Set exit_long = 1 when you want to sell",
    code: `def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
    dataframe.loc[
        (
            (dataframe['rsi'] > 70) |  # Overbought
            (dataframe['close'] > dataframe['bb_upper'])  # Upper Bollinger
        ),
        'exit_long'] = 1
    
    return dataframe`,
    language: "python",
    tips: [
      "Exit signals define when profits are taken",
      "Stoploss will trigger automatically if price drops",
      "Strong exit signals = less drawdown"
    ]
  },
  {
    id: 6,
    title: "Advanced: Optimizable Parameters",
    description: "Mark parameters for hyperparameter optimization",
    code: `from freqtrade.strategy import IntParameter, FloatParameter, CategoricalParameter

class MyStrategy(IStrategy):
    # These parameters will be optimized
    rsi_period = IntParameter(10, 25, default=14, space='buy')
    volume_multiplier = FloatParameter(1.0, 5.0, default=2.0, space='buy')
    macd_fast = IntParameter(5, 20, default=12, space='buy')
    
    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe['rsi'] = talib.RSI(dataframe['close'], timeperiod=self.rsi_period.value)
        return dataframe`,
    language: "python",
    tips: [
      "Parameters marked with IntParameter/FloatParameter will be auto-optimized",
      "Default values are used for backtesting if not optimized",
      "space='buy' or space='sell' for which trend to optimize"
    ]
  }
];

const TYPESCRIPT_INSTRUCTIONS: InstructionStep[] = [
  {
    id: 1,
    title: "Implement IStrategy Interface",
    description: "TypeScript strategies must implement the IStrategy interface",
    code: `/**
 * @name My Trading Strategy
 * @description Volume breakout strategy with RSI
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

interface IStrategy {
  populateIndicators(candles: Candle[]): Map<string, number[]>;
  populateEntryTrend(candles: Candle[], indicators: Map<string, number[]>): boolean[];
  populateExitTrend(candles: Candle[], indicators: Map<string, number[]>): boolean[];
}`,
    language: "typescript",
    tips: [
      "Add JSDoc comments for metadata extraction",
      "@name, @description, @author are extracted automatically",
      "@tags helps categorize your strategy"
    ]
  },
  {
    id: 2,
    title: "Create Strategy Class",
    description: "Implement all required methods",
    code: `class MyStrategy implements IStrategy {
  readonly rsiPeriod: number = 14;
  readonly volumeMultiplier: number = 2.0;
  
  populateIndicators(candles: Candle[]): Map<string, number[]> {
    const indicators = new Map<string, number[]>();
    
    // Calculate RSI
    const rsi = this.calculateRSI(candles.map(c => c.close), this.rsiPeriod);
    indicators.set('rsi', rsi);
    
    // Calculate Volume MA
    const volumeMa = this.calculateMA(candles.map(c => c.volume), 20);
    indicators.set('volumeMa', volumeMa);
    
    return indicators;
  }
  
  populateEntryTrend(candles: Candle[], indicators: Map<string, number[]>): boolean[] {
    const entrySignals = new Array(candles.length).fill(false);
    const rsi = indicators.get('rsi') || [];
    const volumeMa = indicators.get('volumeMa') || [];
    
    for (let i = 1; i < candles.length; i++) {
      const volumeRatio = candles[i].volume / volumeMa[i];
      
      if (
        volumeRatio > this.volumeMultiplier &&
        rsi[i] < 30 &&
        candles[i].close > candles[i - 1].close
      ) {
        entrySignals[i] = true;
      }
    }
    
    return entrySignals;
  }
  
  populateExitTrend(candles: Candle[], indicators: Map<string, number[]>): boolean[] {
    const exitSignals = new Array(candles.length).fill(false);
    const rsi = indicators.get('rsi') || [];
    
    for (let i = 1; i < candles.length; i++) {
      if (rsi[i] > 70) {
        exitSignals[i] = true;
      }
    }
    
    return exitSignals;
  }
  
  private calculateRSI(prices: number[], period: number): number[] {
    // RSI calculation here
    return [];
  }
}`,
    language: "typescript",
    tips: [
      "readonly fields are automatically extracted as parameters",
      "Use readonly for fields you want to optimize",
      "Methods must return the correct types"
    ]
  }
];

export const StrategyInstructions: React.FC<{ language: 'python' | 'typescript' }> = ({ language }) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const instructions = language === 'python' ? PYTHON_INSTRUCTIONS : TYPESCRIPT_INSTRUCTIONS;
  
  return (
    <div className="space-y-4 p-6 bg-white rounded-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-6">How to Write a {language === 'python' ? 'Python' : 'TypeScript'} Strategy</h2>
      
      {instructions.map((step) => (
        <div
          key={step.id}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
          >
            <div className="flex items-center gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                {step.id}
              </span>
              <h3 className="font-semibold text-lg">{step.title}</h3>
            </div>
            <span className="text-gray-500">{expandedStep === step.id ? '▼' : '▶'}</span>
          </button>
          
          {expandedStep === step.id && (
            <div className="p-4 space-y-4">
              <p className="text-gray-700">{step.description}</p>
              
              {step.code && (
                <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
                  <pre>{step.code}</pre>
                </div>
              )}
              
              {step.tips && (
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">💡 Tips:</h4>
                  <ul className="space-y-1">
                    {step.tips.map((tip, idx) => (
                      <li key={idx} className="text-blue-800 flex gap-2">
                        <span>•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      
      {/* Common Errors Section */}
      <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-bold text-red-900 mb-3">⚠️ Common Mistakes to Avoid</h3>
        <ul className="space-y-2 text-red-800">
          <li>❌ Forgetting to set 'enter_long' or 'exit_long' columns</li>
          <li>❌ Using current candle data to avoid look-ahead bias</li>
          <li>❌ Not handling empty/NaN values in indicators</li>
          <li>❌ Strategy with no exits (profits trapped)</li>
          <li>❌ Over-optimizing to historical data (overfitting)</li>
        </ul>
      </div>
      
      {/* Resources Section */}
      <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-bold text-green-900 mb-3">📚 Resources</h3>
        <ul className="space-y-2 text-green-800">
          <li>• <a href="#" className="underline">Freqtrade Strategy Documentation</a></li>
          <li>• <a href="#" className="underline">Technical Analysis Library (talib)</a></li>
          <li>• <a href="#" className="underline">Example Strategies</a></li>
          <li>• <a href="#" className="underline">API Documentation</a></li>
        </ul>
      </div>
    </div>
  );
};

export default StrategyInstructions;
