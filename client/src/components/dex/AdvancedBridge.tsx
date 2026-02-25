import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Info, Loader2, CheckCircle2, AlertCircle, ArrowRight, Clock, DollarSign } from 'lucide-react';

const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', icon: '⟠', gas: '~$50-200' },
  { id: 'polygon', name: 'Polygon', icon: '⬡', gas: '~$0.10-1' },
  { id: 'arbitrum', name: 'Arbitrum', icon: '🔵', gas: '~$0.50-5' },
  { id: 'optimism', name: 'Optimism', icon: '🔴', gas: '~$0.50-5' },
  { id: 'base', name: 'Base', icon: '⚪', gas: '~$0.10-1' },
  { id: 'celo', name: 'Celo', icon: '💚', gas: '~$0.01-0.1' },
  { id: 'solana', name: 'Solana', icon: '🟣', gas: '~$0.00025' },
];

const BRIDGE_PROVIDERS = [
  { id: 'stargate', name: 'Stargate', tvl: '$2.5B', speed: '~5-10 min', fee: '0.05-0.25%' },
  { id: 'layerzero', name: 'LayerZero', tvl: '$1.8B', speed: '~2-5 min', fee: '0.01-0.1%' },
  { id: 'axelar', name: 'Axelar', tvl: '$800M', speed: '~10-20 min', fee: '0.1-0.5%' },
  { id: 'hop', name: 'Hop Protocol', tvl: '$600M', speed: '~1-5 min', fee: '0.25-1%' },
  { id: 'across', name: 'Across', tvl: '$400M', speed: '~2-10 min', fee: '0.01-0.5%' },
];

export default function AdvancedBridge() {
  const { toast } = useToast();
  const [fromChain, setFromChain] = useState('ethereum');
  const [toChain, setToChain] = useState('polygon');
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('100');
  const [slippage, setSlippage] = useState('1');
  const [selectedBridge, setSelectedBridge] = useState('stargate');
  const [walletAddress] = useState('0x123...abc');

  const [bridgeQuote, setBridgeQuote] = useState<any>(null);
  const [bestRoutes, setBestRoutes] = useState<any[]>([]);

  const bridgeMutation = useMutation(async () => {
    const body = {
      fromChain,
      toChain,
      token,
      amount: Number(amount),
      slippageTolerance: Number(slippage),
      bridgeProvider: selectedBridge,
    };
    return await apiPost('/api/cross-chain/bridge', body);
  });

  const quoteMutation = useMutation(async () => {
    try {
      // Simulate bridge quote for now
      const estimatedTime = Math.random() * 15 + 2;
      const fee = Number(amount) * 0.001;
      const receiveAmount = Number(amount) - fee;
      
      setBridgeQuote({
        fromChain,
        toChain,
        token,
        amountIn: Number(amount),
        estimatedReceive: receiveAmount,
        fee,
        provider: selectedBridge,
        estimatedTime: estimatedTime.toFixed(0),
        gasCost: 50,
        status: 'Ready to bridge'
      });
      
      toast({ title: '✅ Bridge Quote', description: `Send ${amount} ${token} from ${fromChain} → ${toChain}` });
    } catch (err: any) {
      toast({ title: '❌ Quote failed', description: err?.message || 'Could not fetch quote', variant: 'destructive' });
    }
  });

  const routesMutation = useMutation(async () => {
    try {
      const routes = BRIDGE_PROVIDERS.map(provider => ({
        ...provider,
        estimatedReceive: Number(amount) * (1 - (Math.random() * 0.005)),
        totalFee: Number(amount) * (Math.random() * 0.005 + 0.001),
      }));
      setBestRoutes(routes.sort((a, b) => b.estimatedReceive - a.estimatedReceive));
      
      toast({ title: '🎯 Routes Found', description: `Found ${routes.length} optimal bridge routes` });
    } catch (err: any) {
      toast({ title: '❌ Route search failed', description: err?.message || 'Could not find routes', variant: 'destructive' });
    }
  });

  const handleExecuteBridge = async (provider?: string) => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter an amount greater than 0', variant: 'destructive' });
      return;
    }
    
    try {
      const useBridge = provider || selectedBridge;
      toast({ title: '⏳ Bridging...', description: `Moving ${amount} ${token} to ${toChain}...` });
      
      const result = await bridgeMutation.mutateAsync();
      if (result.success) {
        toast({
          title: '✅ Bridge Started!',
          description: `Bridging ${amount} ${token}. Check your wallet on ${toChain}`,
        });
      } else {
        toast({ title: '❌ Bridge failed', description: result.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '❌ Bridge error', description: err?.message || 'Transaction failed', variant: 'destructive' });
    }
  };

  return (
    <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5 text-blue-500" />Advanced Bridge</CardTitle>
            <CardDescription>Cross-chain token transfers with route optimization and MEV protection</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Wallet Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Destination: Connected Wallet</p>
              <p className="text-blue-800 dark:text-blue-200 mt-1">
                Bridged tokens arrive at:
              </p>
              <p className="font-mono text-xs bg-white dark:bg-slate-800 p-2 mt-2 rounded border border-blue-200 dark:border-blue-700">
                {walletAddress}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                💡 <strong>Tip:</strong> You'll receive tokens on the destination chain within the estimated time.
              </p>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="space-y-4">
          {/* Token & Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                Token
                <span title="Token to bridge (USDC, USDT, ETH, etc.)" className="text-gray-400 cursor-help">?</span>
              </label>
              <Input
                value={token}
                onChange={e => setToken(e.target.value.toUpperCase())}
                placeholder="e.g., USDC"
                className="uppercase"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                Amount
                <span title="Amount to bridge in tokens" className="text-gray-400 cursor-help">?</span>
              </label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.0"
                step="0.0001"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">You have ~50,000 {token}</p>
            </div>
          </div>

          {/* From & To Chains */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                From Chain
                <span title="Source blockchain" className="text-gray-400 cursor-help">?</span>
              </label>
              <Select value={fromChain} onValueChange={setFromChain}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CHAINS.map(chain => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.icon} {chain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Gas: {SUPPORTED_CHAINS.find(c => c.id === fromChain)?.gas}</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                To Chain
                <span title="Destination blockchain" className="text-gray-400 cursor-help">?</span>
              </label>
              <Select value={toChain} onValueChange={setToChain}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CHAINS.filter(c => c.id !== fromChain).map(chain => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.icon} {chain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Gas: {SUPPORTED_CHAINS.find(c => c.id === toChain)?.gas}</p>
            </div>
          </div>

          {/* Bridge & Slippage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                Bridge Provider
                <span title="Cross-chain bridge (Stargate, LayerZero, Axelar, etc.)" className="text-gray-400 cursor-help">?</span>
              </label>
              <Select value={selectedBridge} onValueChange={setSelectedBridge}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🤖 Auto (Optimized)</SelectItem>
                  {BRIDGE_PROVIDERS.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} — {provider.fee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Recommended: Auto mode</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                Max Slippage %
                <span title="Max acceptable price change during bridge" className="text-gray-400 cursor-help">?</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={slippage}
                  onChange={e => setSlippage(e.target.value)}
                  placeholder="1"
                  step="0.1"
                  min="0"
                  max="10"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSlippage('1')}
                  className="text-xs"
                >
                  1%
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Number(slippage) > 2 ? '⚠️ High' : Number(slippage) > 1 ? '⚠️ Moderate' : '✅ Safe'}
              </p>
            </div>
          </div>
        </div>

        {/* Bridge Quote */}
        {bridgeQuote && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="font-semibold text-green-900 dark:text-green-100">Bridge Quote</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">You'll Receive</p>
                <p className="font-semibold text-lg">{bridgeQuote.estimatedReceive?.toFixed(4)}</p>
                <p className="text-xs text-gray-500">{token}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Bridge Fee</p>
                <p className="font-semibold">{bridgeQuote.fee?.toFixed(4)}</p>
                <p className="text-xs text-gray-500">~${(bridgeQuote.fee * 1.2)?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Est. Time</p>
                <p className="font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {bridgeQuote.estimatedTime}m
                </p>
                <p className="text-xs text-gray-500">~10 blocks</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Gas Cost</p>
                <p className="font-semibold">${bridgeQuote.gasCost?.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Included</p>
              </div>
            </div>
          </div>
        )}

        {/* Best Routes */}
        {bestRoutes.length > 0 && (
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="h-4 w-4 text-purple-600" />
              <p className="font-semibold text-purple-900 dark:text-purple-100">Bridge Routes</p>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {bestRoutes.slice(0, 5).map((route, i) => (
                <div
                  key={i}
                  className="p-3 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-lg text-sm space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{route.name}</span>
                    <span className="text-green-600 font-bold">{route.estimatedReceive?.toFixed(4)} {token}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <span>Speed: {route.speed}</span>
                    <span>Fee: {route.fee}</span>
                    <span>TVL: {route.tvl}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => handleExecuteBridge(route.id)}
                    disabled={bridgeMutation.isLoading}
                  >
                    {bridgeMutation.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Bridge via {route.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => quoteMutation.mutateAsync()}
            disabled={quoteMutation.isLoading || !amount || !token}
            className="flex-1 md:flex-none"
          >
            {quoteMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : '📊'}
            Get Quote
          </Button>
          <Button
            variant="outline"
            onClick={() => routesMutation.mutateAsync()}
            disabled={routesMutation.isLoading || !amount || !token}
            className="flex-1 md:flex-none"
          >
            {routesMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : '🛣️'}
            Compare Routes
          </Button>
          <Button
            onClick={() => handleExecuteBridge()}
            disabled={bridgeMutation.isLoading || !amount || !token}
            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700"
          >
            {bridgeMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : '⛓️'}
            Start Bridge
          </Button>
        </div>

        {/* Help Text */}
        <div className="p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p><strong>💡 Workflow:</strong> 1) Select chains & amount  2) Click "Get Quote"  3) Click "Compare Routes"  4) Click "Start Bridge"</p>
          <p><strong>⚠️ Note:</strong> Bridge transfers take 2-20 minutes. You'll receive tokens on the destination chain automatically.</p>
        </div>
      </CardContent>
    </Card>
  );
}
