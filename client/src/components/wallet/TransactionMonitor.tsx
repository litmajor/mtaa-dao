import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Clock, Zap, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PendingTransaction {
  id: string;
  hash: string;
  type: 'send' | 'receive' | 'swap' | 'bridge';
  amount: string;
  currency: string;
  from: string;
  to: string;
  status: 'mempool' | 'processing' | 'confirming' | 'confirmed';
  confirmations: number;
  requiredConfirmations: number;
  blockNumber?: number;
  gasPrice: string;
  gasUsed?: string;
  totalGasCost: string;
  estimatedTime: string; // in seconds
  timeRemaining: string; // formatted
  timestamp: number;
  chain: string;
  explorerUrl: string;
}

const MOCK_TRANSACTIONS: PendingTransaction[] = [
  {
    id: '1',
    hash: '0xabc123def456...',
    type: 'send',
    amount: '100',
    currency: 'cUSD',
    from: '0x1234...5678',
    to: '0x8765...4321',
    status: 'confirming',
    confirmations: 8,
    requiredConfirmations: 12,
    blockNumber: 52435125,
    gasPrice: '0.5',
    gasUsed: '21000',
    totalGasCost: '0.01 cUSD',
    estimatedTime: '45',
    timeRemaining: '~45 seconds',
    timestamp: Date.now() - 15000,
    chain: 'Celo',
    explorerUrl: 'https://celoscan.io/tx/0xabc123def456'
  },
  {
    id: '2',
    hash: '0xdef789ghi012...',
    type: 'receive',
    amount: '500',
    currency: 'USDC',
    from: '0x9999...1111',
    to: '0x1234...5678',
    status: 'processing',
    confirmations: 2,
    requiredConfirmations: 12,
    blockNumber: 52435118,
    gasPrice: '0.8',
    totalGasCost: '0.016 cUSD',
    estimatedTime: '120',
    timeRemaining: '~2 minutes',
    timestamp: Date.now() - 60000,
    chain: 'Polygon → Celo',
    explorerUrl: 'https://polygonscan.com/tx/0xdef789ghi012'
  },
  {
    id: '3',
    hash: '0xjkl345mno678...',
    type: 'bridge',
    amount: '1000',
    currency: 'USDT',
    from: 'Binance Smart Chain',
    to: 'Celo',
    status: 'mempool',
    confirmations: 0,
    requiredConfirmations: 1,
    gasPrice: '1.2',
    totalGasCost: '0.024 cUSD',
    estimatedTime: '10',
    timeRemaining: '~10 seconds',
    timestamp: Date.now() - 5000,
    chain: 'BSC → Celo',
    explorerUrl: 'https://bscscan.com/tx/0xjkl345mno678'
  }
];

const getStatusInfo = (status: string): { icon: React.ReactNode; label: string; color: string; bgColor: string } => {
  switch (status) {
    case 'mempool':
      return {
        icon: <Clock className="w-4 h-4" />,
        label: 'In Mempool',
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20'
      };
    case 'processing':
      return {
        icon: <Zap className="w-4 h-4" />,
        label: 'Processing',
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
      };
    case 'confirming':
      return {
        icon: <TrendingUp className="w-4 h-4" />,
        label: 'Confirming',
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20'
      };
    case 'confirmed':
      return {
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: 'Confirmed',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20'
      };
    default:
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Unknown',
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-50 dark:bg-gray-900/20'
      };
  }
};

const formatAddress = (addr: string): string => {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

export function TransactionMonitor() {
  const [transactions, setTransactions] = useState<PendingTransaction[]>(MOCK_TRANSACTIONS);
  const [timeRemaining, setTimeRemaining] = useState<Record<string, string>>({});

  // Update time remaining every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const updated: Record<string, string> = {};

      transactions.forEach((tx) => {
        const elapsed = Math.floor((now - tx.timestamp) / 1000);
        const remaining = Math.max(0, parseInt(tx.estimatedTime) - elapsed);

        if (remaining === 0) {
          updated[tx.id] = 'Completed!';
        } else if (remaining < 60) {
          updated[tx.id] = `~${remaining} seconds`;
        } else {
          updated[tx.id] = `~${Math.ceil(remaining / 60)} minutes`;
        }
      });

      setTimeRemaining(updated);
    }, 1000);

    return () => clearInterval(interval);
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No pending transactions</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">All transactions have been confirmed!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction Monitor</h2>
        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
          {transactions.length} Pending
        </Badge>
      </div>

      <AnimatePresence>
        {transactions.map((tx, index) => {
          const statusInfo = getStatusInfo(tx.status);
          const confirmProgress = (tx.confirmations / tx.requiredConfirmations) * 100;

          return (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`overflow-hidden border-l-4 ${
                tx.status === 'confirmed' ? 'border-l-green-500' : 
                tx.status === 'confirming' ? 'border-l-purple-500' :
                tx.status === 'processing' ? 'border-l-yellow-500' :
                'border-l-blue-500'
              }`}>
                <CardContent className="p-6">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
                        <span className={statusInfo.color}>{statusInfo.icon}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {tx.type === 'send' && '📤 Sending'} 
                          {tx.type === 'receive' && '📥 Receiving'}
                          {tx.type === 'swap' && '🔄 Swapping'}
                          {tx.type === 'bridge' && '🌉 Bridging'}
                          {' '}{tx.amount} {tx.currency}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatAddress(tx.from)} → {formatAddress(tx.to)}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${statusInfo.bgColor} ${statusInfo.color} border-0`}>
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {/* Confirmation Progress */}
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmations</span>
                      <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                        {tx.confirmations} / {tx.requiredConfirmations}
                      </span>
                    </div>
                    <Progress value={confirmProgress} className="h-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {confirmProgress.toFixed(0)}% complete • Block #{tx.blockNumber}
                    </p>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {/* Gas Info */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gas Price</p>
                      <p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{tx.gasPrice} gwei</p>
                    </div>

                    {/* Total Cost */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Cost</p>
                      <p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{tx.totalGasCost}</p>
                    </div>

                    {/* Chain */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Network</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tx.chain}</p>
                    </div>

                    {/* Time Remaining */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Est. Time</p>
                      <p className="text-sm font-bold text-gradient bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {timeRemaining[tx.id] || tx.timeRemaining}
                      </p>
                    </div>
                  </div>

                  {/* Transaction Hash */}
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono mb-4">
                    <p className="text-gray-500 dark:text-gray-400 mb-1">TX Hash</p>
                    <p className="text-gray-900 dark:text-gray-100 break-all">{tx.hash}</p>
                  </div>

                  {/* View on Explorer Button */}
                  <button
                    onClick={() => window.open(tx.explorerUrl, '_blank')}
                    className="w-full px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors font-medium text-sm"
                    data-testid={`button-view-tx-${tx.id}`}
                  >
                    View on Block Explorer →
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Legend */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="text-sm text-blue-900 dark:text-blue-300">
            <p className="font-semibold mb-2">Transaction States:</p>
            <ul className="space-y-1 text-xs">
              <li><span className="text-blue-600 dark:text-blue-400">●</span> <strong>In Mempool</strong> - Waiting to be picked up by miners</li>
              <li><span className="text-yellow-600 dark:text-yellow-400">●</span> <strong>Processing</strong> - First block confirmation received</li>
              <li><span className="text-purple-600 dark:text-purple-400">●</span> <strong>Confirming</strong> - Receiving additional confirmations</li>
              <li><span className="text-green-600 dark:text-green-400">●</span> <strong>Confirmed</strong> - Transaction is final and irreversible</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
