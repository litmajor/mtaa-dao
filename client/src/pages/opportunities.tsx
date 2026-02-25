/**
 * Opportunities Scanner & Flash Loan Strategy Page
 * 
 * Real-time opportunity detection with integrated flash loan execution
 */

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OpportunityScannerDashboard } from '@/components/OpportunityScannerDashboard';
import { ArrowRight, Zap, Lightbulb, BookOpen } from 'lucide-react';

interface FlashLoanStrategy {
  id: string;
  name: string;
  description: string;
  requiredBalance?: string;
  estimatedGas?: string;
  expectedProfit?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export default function OpportunitiesPage() {
  const { address, isConnected } = useAccount();
  const [strategies, setStrategies] = useState<FlashLoanStrategy[]>([
    {
      id: 'arbitrage',
      name: 'Cross-Exchange Arbitrage',
      description: 'Execute price differences between CEX platforms using flash loans',
      requiredBalance: 'None (flash loan funded)',
      estimatedGas: '~$50-200',
      expectedProfit: '0.5%-3%',
      riskLevel: 'medium',
    },
    {
      id: 'dex-spread',
      name: 'DEX Spread Capture',
      description: 'Capture liquidity spreads across DEX platforms on multiple chains',
      requiredBalance: 'None (flash loan funded)',
      estimatedGas: '~$30-150',
      expectedProfit: '0.2%-2%',
      riskLevel: 'low',
    },
    {
      id: 'emerging-token',
      name: 'Emerging Token Amplification',
      description: 'Execute strategies on emerging tokens with calculated risk management',
      requiredBalance: '0.1-1 ETH (optional)',
      estimatedGas: '~$100-500',
      expectedProfit: '1%-10%',
      riskLevel: 'high',
    },
  ]);

  const [selectedStrategy, setSelectedStrategy] = useState<FlashLoanStrategy | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Opportunity Scanner</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Real-time market opportunities with integrated flash loan strategies
          </p>
        </div>

        {/* Connection Status */}
        <Card className="mb-8 bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold mb-1">Wallet Status</h3>
                <p className="text-sm text-gray-400">
                  {isConnected
                    ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
                    : 'Not connected'}
                </p>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Opportunity Scanner Dashboard */}
        <div className="mb-8">
          <OpportunityScannerDashboard />
        </div>

        {/* Flash Loan Strategies Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Available Strategies</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {strategies.map((strategy) => (
              <Card
                key={strategy.id}
                className={`bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:border-purple-500 ${
                  selectedStrategy?.id === strategy.id ? 'border-purple-500 ring-2 ring-purple-500' : ''
                }`}
                onClick={() => setSelectedStrategy(strategy)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white">{strategy.name}</CardTitle>
                      <CardDescription className="text-gray-400 mt-2">
                        {strategy.description}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        strategy.riskLevel === 'low'
                          ? 'outline'
                          : strategy.riskLevel === 'medium'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {strategy.riskLevel.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400">Required Balance</p>
                        <p className="text-white font-semibold">{strategy.requiredBalance}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Est. Gas</p>
                        <p className="text-white font-semibold">{strategy.estimatedGas}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Expected Return</p>
                      <p className="text-green-400 font-bold text-lg">{strategy.expectedProfit}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Strategy Details & Execution */}
        {selectedStrategy && (
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Execute Strategy</CardTitle>
              <CardDescription>
                {selectedStrategy.name} - {selectedStrategy.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Strategy Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Risk Level
                  </label>
                  <Badge variant="outline" className="w-full py-2 justify-center">
                    {selectedStrategy.riskLevel.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Est. Gas Cost
                  </label>
                  <input
                    type="text"
                    value={selectedStrategy.estimatedGas}
                    disabled
                    title="Estimated gas cost"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Profit Target
                  </label>
                  <input
                    type="text"
                    value={selectedStrategy.expectedProfit}
                    disabled
                    title="Expected profit percentage"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                  />
                </div>
              </div>

              {/* Execution Info */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <div className="flex gap-3">
                  <Lightbulb className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-200">Flash Loan Powered</p>
                    <p className="text-xs text-blue-300 mt-1">
                      This strategy uses flash loans, so you need zero balance to execute. The loan is repaid
                      + profit taken in a single transaction.
                    </p>
                  </div>
                </div>
              </div>

              {/* Execution Buttons */}
              <div className="flex gap-4">
                <Button
                  disabled={!isConnected}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Execute Strategy
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedStrategy(null)}
                  className="border-slate-600 text-gray-300"
                >
                  Cancel
                </Button>
              </div>

              {!isConnected && (
                <p className="text-sm text-yellow-400 text-center">
                  Please connect your wallet to execute strategies
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Guide Section */}
        {showGuide && (
          <Card className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border-green-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-400" />
                  <CardTitle className="text-white">How It Works</CardTitle>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex gap-3">
                  <span className="text-green-400 font-bold">1.</span>
                  <span>The scanner continuously monitors CEX and DEX markets for profitable opportunities</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-400 font-bold">2.</span>
                  <span>
                    Opportunities are filtered by minimum profit threshold and displayed in real-time
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-400 font-bold">3.</span>
                  <span>
                    Flash loan strategies execute these opportunities without requiring upfront capital
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-400 font-bold">4.</span>
                  <span>
                    Profit is extracted and your address receives the gains in a single atomic transaction
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
