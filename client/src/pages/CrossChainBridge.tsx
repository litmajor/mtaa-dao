
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const CHAIN_NAMES = {
  'celo': 'Celo',
  'ethereum': 'Ethereum',
  'polygon': 'Polygon',
  'optimism': 'Optimism',
  'arbitrum': 'Arbitrum',
  'bsc': 'BNB Chain',
  'tron': 'TRON',
  'ton': 'TON'
};

const SUPPORTED_TOKENS: Record<string, string[]> = {
  'ethereum': ['ETH', 'USDC', 'USDT', 'DAI'],
  'polygon': ['MATIC', 'USDC', 'USDT'],
  'bsc': ['BNB', 'USDT', 'BUSD'],
  'celo': ['CELO', 'cUSD', 'cEUR', 'cKES'],
  'tron': ['TRX', 'USDT'],
  'ton': ['TON', 'USDT'],
  'optimism': ['ETH', 'USDC'],
  'arbitrum': ['ETH', 'USDC']
};

export default function CrossChainBridge() {
  const { toast } = useToast();
  const [mode, setMode] = useState<'bridge' | 'swap'>('bridge');
  const [sourceChain, setSourceChain] = useState('celo');
  const [destinationChain, setDestinationChain] = useState('ethereum');
  const [amount, setAmount] = useState('');
  const [fromToken, setFromToken] = useState('CELO');
  const [toToken, setToToken] = useState('ETH');
  const [tokenAddress, setTokenAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [swapQuote, setSwapQuote] = useState<any>(null);

  // Fetch supported chains
  const { data: chains } = useQuery({
    queryKey: ['cross-chain-chains'],
    queryFn: async () => {
      const res = await apiGet('/api/cross-chain/chains');
      return res.data;
    }
  });

  // Fetch fee estimate or swap quote
  const { data: feeEstimate, isLoading: loadingFees } = useQuery({
    queryKey: ['bridge-fees', sourceChain, destinationChain, amount, mode],
    queryFn: async () => {
      if (!amount || parseFloat(amount) <= 0) return null;
      
      if (mode === 'swap') {
        const res = await apiPost('/api/cross-chain/swap/quote', {
          fromChain: sourceChain,
          toChain: destinationChain,
          fromToken,
          toToken,
          fromAmount: amount,
          slippageTolerance: 1.0
        });
        setSwapQuote(res.data);
        return res.data;
      } else {
        const res = await apiPost('/api/cross-chain/estimate-fees', { sourceChain, destinationChain, amount });
        return res.data;
      }
    },
    enabled: !!amount && parseFloat(amount) > 0
  });

  // Transfer/Swap mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'swap' && swapQuote) {
        const res = await apiPost('/api/cross-chain/swap/execute', {
          quote: swapQuote,
          userAddress: destinationAddress
        });
        return res.data;
      } else {
        const res = await apiPost('/api/cross-chain/transfer', {
          sourceChain,
          destinationChain,
          tokenAddress,
          amount,
          destinationAddress,
        });
        return res.data;
      }
    },
    onSuccess: (data) => {
      const title = mode === 'swap' ? 'Swap Initiated' : 'Transfer Initiated';
      const id = data.swapId || data.transferId;
      toast({
        title,
        description: `Transaction ID: ${id}. Estimated time: ${Math.floor((data.estimatedTime || 1800) / 60)} minutes`
      });
      // Reset form
      setAmount('');
      setDestinationAddress('');
      setSwapQuote(null);
    },
    onError: () => {
      toast({
        title: mode === 'swap' ? 'Swap Failed' : 'Transfer Failed',
        description: `Failed to initiate cross-chain ${mode}`,
        variant: 'destructive'
      });
    }
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Cross-Chain Bridge</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Cross-Chain Bridge & Swap</CardTitle>
          <CardDescription>
            Transfer and swap tokens across Celo, Ethereum, Polygon, TRON, TON, and more
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={mode === 'bridge' ? 'default' : 'ghost'}
              onClick={() => setMode('bridge')}
              className="flex-1"
            >
              Bridge
            </Button>
            <Button
              variant={mode === 'swap' ? 'default' : 'ghost'}
              onClick={() => setMode('swap')}
              className="flex-1"
            >
              Swap
            </Button>
          </div>
          {/* Chain Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <label className="text-sm font-medium mb-2 block">From Chain</label>
              <Select value={sourceChain} onValueChange={setSourceChain}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chains?.map((chain: string) => (
                    <SelectItem key={chain} value={chain}>
                      {CHAIN_NAMES[chain as keyof typeof CHAIN_NAMES] || chain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">To Chain</label>
              <Select value={destinationChain} onValueChange={setDestinationChain}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chains?.filter((c: string) => c !== sourceChain).map((chain: string) => (
                    <SelectItem key={chain} value={chain}>
                      {CHAIN_NAMES[chain as keyof typeof CHAIN_NAMES] || chain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Token Details */}
          {mode === 'swap' ? (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">From Token</label>
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_TOKENS[sourceChain]?.map((token) => (
                      <SelectItem key={token} value={token}>
                        {token}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">To Token</label>
                <Select value={toToken} onValueChange={setToToken}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_TOKENS[destinationChain]?.map((token) => (
                      <SelectItem key={token} value={token}>
                        {token}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {swapQuote && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ≈ {parseFloat(swapQuote.estimatedToAmount).toFixed(6)} {toToken}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Token Address</label>
                <Input
                  placeholder="0x..."
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">Destination Address</label>
            <Input
              placeholder="0x..."
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
            />
          </div>

          {/* Fee Estimate / Swap Quote */}
          {feeEstimate && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="space-y-2 text-sm">
                  {mode === 'swap' && swapQuote ? (
                    <>
                      <div className="flex justify-between">
                        <span>Exchange Rate:</span>
                        <span className="font-medium">1 {fromToken} = {swapQuote.exchangeRate.toFixed(6)} {toToken}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estimated Output:</span>
                        <span className="font-medium">{parseFloat(swapQuote.estimatedToAmount).toFixed(6)} {toToken}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Price Impact:</span>
                        <span className="font-medium text-orange-500">{swapQuote.priceImpact.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bridge Fee:</span>
                        <span className="font-medium">{swapQuote.bridgeFee} {fromToken}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gas Fee:</span>
                        <span className="font-medium">{swapQuote.estimatedGas} ETH</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-xs text-muted-foreground">Route:</span>
                        <span className="text-xs">{swapQuote.route.join(' → ')}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Gas Fee:</span>
                        <span className="font-medium">{feeEstimate.gasFee} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bridge Fee:</span>
                        <span className="font-medium">{feeEstimate.bridgeFee}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Total Fee:</span>
                        <span className="font-semibold">{feeEstimate.totalFee}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={
              !amount || 
              !destinationAddress || 
              (mode === 'bridge' && !tokenAddress) ||
              transferMutation.isPending
            }
            className="w-full"
            size="lg"
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'swap' ? 'Executing Swap...' : 'Initiating Transfer...'}
              </>
            ) : (
              mode === 'swap' ? 'Execute Swap' : 'Bridge Assets'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
