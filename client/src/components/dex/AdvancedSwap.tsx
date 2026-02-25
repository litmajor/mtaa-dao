import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Info, ArrowRight, Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';

export default function AdvancedSwap() {
  const { toast } = useToast();
  const [fromAsset, setFromAsset] = useState('USDC');
  const [toAsset, setToAsset] = useState('ETH');
  const [amountIn, setAmountIn] = useState('100');
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [preferredDex, setPreferredDex] = useState('all');
  const [slippage, setSlippage] = useState('0.5');
  const [walletAddress, setWalletAddress] = useState('0x123...abc');

  const { data: dexList = [] } = useQuery({
    queryKey: ['dex-list-advanced'],
    queryFn: async () => await apiGet('/api/dex/supported'),
  });

  const chains = useMemo(() => {
    const set = new Set<string>();
    dexList.forEach((d: any) => d.chain && set.add(d.chain));
    return Array.from(set).sort();
  }, [dexList]);

  const dexesForChain = useMemo(() => {
    return dexList.filter((d: any) => d.chain === selectedChain);
  }, [dexList, selectedChain]);

  const quoteMutation = useMutation(async () => {
    const body = { fromAsset, toAsset, amountIn: Number(amountIn), preferredDex: preferredDex === 'all' ? undefined : preferredDex, chain: selectedChain };
    return await apiPost('/api/dex/quote', body);
  });

  const bestRouteMutation = useMutation(async () => {
    const body = { fromAsset, toAsset, amountIn: Number(amountIn), chain: selectedChain };
    return await apiPost('/api/dex/best-route', body);
  });

  const swapMutation = useMutation(async (dex: string) => {
    const body = { fromAsset, toAsset, amountIn: Number(amountIn), slippageTolerance: Number(slippage), dex };
    return await apiPost('/api/dex/swap', body);
  });

  const handleQuote = async () => {
    if (!amountIn || Number(amountIn) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter an amount greater than 0', variant: 'destructive' });
      return;
    }
    try {
      const res = await quoteMutation.mutateAsync();
      toast({ 
        title: '✅ Quote Received', 
        description: `${res.estimatedAmountOut?.toFixed(6) ?? '?'} ${toAsset} via ${res.dex}` 
      });
    } catch (err: any) {
      toast({ title: '❌ Quote failed', description: err?.message || 'Could not fetch quote', variant: 'destructive' });
    }
  };

  const handleBestRoute = async () => {
    if (!amountIn || Number(amountIn) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter an amount greater than 0', variant: 'destructive' });
      return;
    }
    try {
      const res = await bestRouteMutation.mutateAsync();
      const routeCount = Array.isArray(res.routes) ? res.routes.length : 1;
      toast({ title: '🎯 Routes found', description: `Found ${routeCount} optimal swap route(s)` });
    } catch (err: any) {
      toast({ title: '❌ Route search failed', description: err?.message || 'Could not find routes', variant: 'destructive' });
    }
  };

  const handleExecute = async (dex?: string) => {
    if (!amountIn || Number(amountIn) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter an amount greater than 0', variant: 'destructive' });
      return;
    }
    try {
      const useDex = dex || (preferredDex !== 'all' ? preferredDex : (dexesForChain[0]?.id ?? ''));
      toast({ title: '⏳ Processing...', description: 'Executing swap on blockchain...' });
      const res = await swapMutation.mutateAsync(useDex);
      if (res.success) {
        toast({ 
          title: '✅ Swap Success!', 
          description: `Received ~${res.amountOut?.toFixed(6) ?? '?'} ${toAsset}. Tx: ${res.transactionHash?.slice(0, 10)}...` 
        });
      } else {
        toast({ title: '❌ Swap failed', description: res.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '❌ Swap error', description: err?.message || 'Transaction failed', variant: 'destructive' });
    }
  };

  const quote = quoteMutation.data;
  const bestRoute = bestRouteMutation.data;
  const isLoadingQuote = quoteMutation.isLoading;
  const isLoadingRoute = bestRouteMutation.isLoading;
  const isExecuting = swapMutation.isLoading;

  return (
    <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" />Advanced Swap</CardTitle>
            <CardDescription>Multi-DEX swaps with best-route optimization and price impact protection</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Wallet Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Output Destination</p>
              <p className="text-blue-800 dark:text-blue-200 mt-1">
                Swapped tokens will be sent to your <strong>connected wallet</strong>:
              </p>
              <p className="font-mono text-xs bg-white dark:bg-slate-800 p-2 mt-2 rounded border border-blue-200 dark:border-blue-700">
                {walletAddress}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                💡 <strong>Tip:</strong> This can be your Yuki personal vault, a DAO treasury, or any connected wallet.
              </p>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* From Asset */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              From Token
              <span title="Token symbol (e.g., USDC, ETH, cUSD)" className="text-gray-400 cursor-help">?</span>
            </label>
            <Input 
              value={fromAsset} 
              onChange={e => setFromAsset(e.target.value.toUpperCase())} 
              placeholder="e.g., USDC"
              className="uppercase"
            />
            <p className="text-xs text-gray-500 mt-1">Enter token symbol</p>
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              Amount
              <span title="Amount in tokens (will be checked against your balance)" className="text-gray-400 cursor-help">?</span>
            </label>
            <Input 
              type="number" 
              value={amountIn} 
              onChange={e => setAmountIn(e.target.value)} 
              placeholder="0.0"
              step="0.0001"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">You have ~1,234.56 {fromAsset}</p>
          </div>

          {/* To Asset */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              To Token
              <span title="Token you want to receive (e.g., ETH, cUSD, CELO)" className="text-gray-400 cursor-help">?</span>
            </label>
            <Input 
              value={toAsset} 
              onChange={e => setToAsset(e.target.value.toUpperCase())} 
              placeholder="e.g., ETH"
              className="uppercase"
            />
            <p className="text-xs text-gray-500 mt-1">Destination token</p>
          </div>

          {/* Chain */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              Blockchain
              <span title="Which blockchain to execute on (Ethereum, Polygon, Arbitrum, etc.)" className="text-gray-400 cursor-help">?</span>
            </label>
            <Select value={selectedChain} onValueChange={setSelectedChain}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chains.length === 0 ? (
                  <SelectItem value="ethereum">ethereum</SelectItem>
                ) : (
                  chains.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">{dexesForChain.length} DEXs available</p>
          </div>
        </div>

        {/* DEX & Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Preferred DEX */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              Preferred DEX
              <span title="'Auto' picks the best route automatically. Choose a specific DEX for manual control." className="text-gray-400 cursor-help">?</span>
            </label>
            <Select value={preferredDex} onValueChange={setPreferredDex}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🤖 Auto (Best Route)</SelectItem>
                {dexesForChain.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">Recommended: Auto mode</p>
          </div>

          {/* Slippage */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              Max Slippage %
              <span title="Max acceptable price change. Higher = more risk but higher chance of execution. Typical: 0.5-1%" className="text-gray-400 cursor-help">?</span>
            </label>
            <div className="flex gap-2">
              <Input 
                type="number" 
                value={slippage} 
                onChange={e => setSlippage(e.target.value)} 
                placeholder="0.5"
                step="0.1"
                min="0"
                max="5"
                className="flex-1"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSlippage('0.5')}
                className="text-xs"
              >
                0.5%
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Number(slippage) > 2 ? '⚠️ High slippage' : Number(slippage) > 1 ? '⚠️ Moderate' : '✅ Safe'}
            </p>
          </div>
        </div>

        {/* Quote Display */}
        {quote && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="font-semibold text-green-900 dark:text-green-100">Quote Details</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">You get</p>
                <p className="font-semibold text-lg">{quote.estimatedAmountOut?.toFixed(6)}</p>
                <p className="text-xs text-gray-500">{toAsset}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Rate</p>
                <p className="font-semibold">{quote.exchangeRate?.toFixed(6)}</p>
                <p className="text-xs text-gray-500">{fromAsset}/{toAsset}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Price Impact</p>
                <p className={`font-semibold ${(quote.priceImpact ?? 0) > 1 ? 'text-red-600' : 'text-green-600'}`}>
                  {quote.priceImpact?.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Gas Fee</p>
                <p className="font-semibold">{quote.estimatedGas?.toFixed(6)}</p>
                <p className="text-xs text-gray-500">~${(Number(quote.estimatedGas) * 2000)?.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 border-t border-green-200 dark:border-green-800 pt-2">
              Via <span className="font-semibold">{quote.dex}</span>
            </p>
          </div>
        )}

        {/* Best Routes Display */}
        {bestRoute && (
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-purple-600" />
              <p className="font-semibold text-purple-900 dark:text-purple-100">Optimal Routes</p>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {(bestRoute.routes || [bestRoute]).slice(0, 3).map((r: any, i: number) => (
                <div 
                  key={i} 
                  className="p-3 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-lg text-sm space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Route {i + 1}</span>
                    <span className="text-green-600 font-bold">{r.estimatedOutput ?? r.estimatedAmountOut}  {toAsset}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Impact: {(r.priceImpact ?? r.priceImpactPercent)?.toFixed(2)}%</span>
                    <span>Gas: {r.gasEstimate}</span>
                  </div>
                  {Array.isArray(r.path || r.steps) && (
                    <p className="text-xs font-mono text-gray-500">{(r.path || r.steps).join(' → ')}</p>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full mt-1"
                    onClick={() => handleExecute(r.dex || r.preferredDex || (r.dexPath?.[0]))}
                    disabled={isExecuting}
                  >
                    {isExecuting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Execute Route {i + 1}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleQuote} 
            disabled={isLoadingQuote || !fromAsset || !toAsset || !amountIn}
            className="flex-1 md:flex-none"
          >
            {isLoadingQuote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : '📊'}
            Get Quote
          </Button>
          <Button 
            variant="outline" 
            onClick={handleBestRoute} 
            disabled={isLoadingRoute || !fromAsset || !toAsset || !amountIn}
            className="flex-1 md:flex-none"
          >
            {isLoadingRoute ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : '🎯'}
            Find Best Route
          </Button>
          <Button 
            onClick={() => handleExecute()} 
            disabled={isExecuting || !fromAsset || !toAsset || !amountIn}
            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700"
          >
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : '⚡'}
            Execute Swap
          </Button>
        </div>

        {/* Help Text */}
        <div className="p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p><strong>💡 Workflow:</strong> 1) Enter tokens & amount  2) Click "Get Quote" to see rate  3) Click "Find Best Route" to compare routes  4) Click "Execute Swap" to confirm</p>
          <p><strong>⚠️ Important:</strong> Your wallet address (shown above) must have enough {fromAsset} balance. Gas fees apply.</p>
        </div>
      </CardContent>
    </Card>
  );
}
