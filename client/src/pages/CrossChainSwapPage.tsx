import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2, ChevronLeft } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

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

export default function CrossChainSwapPage() {
  const { toast } = useToast();
  const [sourceChain, setSourceChain] = useState('celo');
  const [destinationChain, setDestinationChain] = useState('ethereum');
  const [amount, setAmount] = useState('');
  const [fromToken, setFromToken] = useState('CELO');
  const [toToken, setToToken] = useState('ETH');
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

  // Fetch swap quote
  const { data: swapQuoteData, isLoading: loadingQuote, error: quoteError } = useQuery({
    queryKey: ['swap-quote', sourceChain, destinationChain, fromToken, toToken, amount],
    queryFn: async () => {
      if (!amount || parseFloat(amount) <= 0) return null;
      
      try {
        if (!fromToken || !toToken) {
          throw new Error('Please select both tokens');
        }
        const res = await apiPost('/api/cross-chain/swap/quote', {
          fromChain: sourceChain,
          toChain: destinationChain,
          fromToken: fromToken.toUpperCase(),
          toToken: toToken.toUpperCase(),
          fromAmount: amount,
          slippageTolerance: 1.0
        });
        setSwapQuote(res.data);
        return res.data;
      } catch (error: any) {
        const message = error?.response?.data?.message || error?.message || 'Failed to fetch quote';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive'
        });
        throw error;
      }
    },
    enabled: !!amount && parseFloat(amount) > 0
  });

  // Swap mutation
  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!destinationAddress || !destinationAddress.startsWith('0x')) {
        throw new Error('Invalid destination address');
      }
      if (!swapQuote) {
        throw new Error('No swap quote available');
      }
      const res = await apiPost('/api/cross-chain/swap/execute', {
        quote: swapQuote,
        userAddress: destinationAddress
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Swap Initiated',
        description: `Transaction ID: ${data.swapId}. Estimated time: ${Math.floor((data.estimatedTime || 2700) / 60)} minutes`
      });
      setAmount('');
      setDestinationAddress('');
      setSwapQuote(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to execute swap';
      toast({
        title: 'Swap Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Back Link */}
      <Link to="/cross-chain" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
        <ChevronLeft className="h-4 w-4" />
        Back to Hub
      </Link>

      <h1 className="text-3xl font-bold mb-2">Swap & Bridge</h1>
      <p className="text-gray-600 mb-6">Convert your tokens and transfer them to another blockchain in one transaction</p>
      
      <Card>
        <CardHeader>
          <CardTitle>Swap & Bridge Token</CardTitle>
          <CardDescription>
            Convert between different tokens and send to another chain simultaneously
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Information Card */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-base text-green-900">How Swap & Bridge Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-green-900">
              <div>
                <p className="font-semibold mb-1">💡 The Process:</p>
                <p className="text-green-800">1. Your token is swapped at the best rate available 2. The output token is automatically bridged 3. Arrives on destination chain in your wallet</p>
              </div>
              <div>
                <p className="font-semibold mb-1">✅ Key Benefits:</p>
                <p className="text-green-800">Convert between any supported tokens. Get exactly the token you want on the chain you want. All in one transaction.</p>
              </div>
              <div>
                <p className="font-semibold mb-1">⏱️ Timeline:</p>
                <p className="text-green-800">Typical processing: 15-45 minutes. Includes swap routing and bridge confirmation time.</p>
              </div>
              <div>
                <p className="font-semibold mb-1">💰 Costs:</p>
                <p className="text-green-800">Swap fee + bridge fee + gas fees. Usually €10-75 depending on token pair, amount, and network conditions.</p>
              </div>
              <div className="border-t pt-3">
                <p className="font-semibold text-green-800 mb-2">⚠️ Price Impact:</p>
                <p className="text-green-800 text-xs">Price impact shows market movement from your trade size. Green (&lt;2%) = good, Orange (2-5%) = fair, Red (&gt;5%) = high. Larger swaps have higher impact.</p>
              </div>
            </CardContent>
          </Card>

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

          {/* Token Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <p className="text-xs text-gray-500 mt-1">The token you want to convert</p>
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
              <p className="text-xs text-gray-500 mt-1">The token you want to receive</p>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-medium mb-2 block">Amount to Swap</label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">You'll send this amount of {fromToken}</p>
            {swapQuote && (
              <p className="text-sm text-green-600 mt-1 font-medium">
                ≈ {parseFloat(swapQuote.estimatedToAmount).toFixed(6)} {toToken}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Destination Address</label>
            <Input
              placeholder="0x..."
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Where your {toToken} will arrive on {CHAIN_NAMES[destinationChain as keyof typeof CHAIN_NAMES]}</p>
          </div>

          {/* Swap Quote */}
          {swapQuoteData && swapQuote && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Exchange Rate:</span>
                    <span className="font-medium">1 {fromToken} = {swapQuote.exchangeRate.toFixed(6)} {toToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>You Receive:</span>
                    <span className="font-medium">{parseFloat(swapQuote.estimatedToAmount).toFixed(6)} {toToken}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Price Impact:</span>
                    <span className={`font-medium ${
                      swapQuote.priceImpact > 5 ? 'text-red-600 bg-red-100' : 
                      swapQuote.priceImpact > 2 ? 'text-orange-600 bg-orange-100' : 
                      'text-green-600 bg-green-100'
                    } px-2 py-1 rounded text-xs`}>
                      {swapQuote.priceImpact.toFixed(2)}%
                    </span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between">
                    <span>Swap Fee:</span>
                    <span className="font-medium">{swapQuote.swapFee}</span>
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
                    <span className="text-xs text-right">{swapQuote.route.join(' → ')}</span>
                  </div>
                  <div className="mt-3 p-2 bg-yellow-100 rounded text-yellow-800 text-xs">
                    <p className="font-semibold mb-1">📌 Tips for better swaps:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>High price impact? Try a smaller amount for a better rate</li>
                      <li>Peak times (UTC 14:00-18:00) may have higher slippage</li>
                      <li>Fees shown are estimates - actual may vary slightly</li>
                      <li>Check your {toToken} balance on {CHAIN_NAMES[destinationChain as keyof typeof CHAIN_NAMES]} in 15-45 minutes</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {quoteError && (
            <div className="p-3 bg-red-100 border border-red-300 rounded text-red-800 text-sm">
              <p className="font-semibold mb-1">⚠️ Error getting swap quote:</p>
              <p>{quoteError instanceof Error ? quoteError.message : 'Unable to calculate swap. Check your inputs.'}</p>
            </div>
          )}

          {/* Validation Feedback */}
          {amount && sourceChain && destinationChain && fromToken && toToken && destinationAddress && !quoteError && (
            <div className="p-3 bg-green-100 border border-green-300 rounded text-green-800 text-sm">
              <p className="font-semibold">✅ All inputs validated</p>
              <p>Ready to swap {amount} {fromToken} to {toToken} on {CHAIN_NAMES[destinationChain as keyof typeof CHAIN_NAMES]}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={() => swapMutation.mutate()}
            disabled={
              !amount || 
              !destinationAddress || 
              !swapQuote ||
              swapMutation.isPending ||
              loadingQuote
            }
            className="w-full"
            size="lg"
          >
            {swapMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing Swap...
              </>
            ) : loadingQuote ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching Quote...
              </>
            ) : (
              `Execute Swap`
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
