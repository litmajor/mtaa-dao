import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, LoaderCircle, ChevronLeft } from 'lucide-react';
import PriceImpact from '@/components/crosschain/PriceImpact';
import ExpandableQuote from '@/components/crosschain/ExpandableQuote';
import TrustBadges from '@/components/crosschain/TrustBadges';
import StepProgress from '@/components/crosschain/StepProgress';
import StickyCTA from '@/components/crosschain/StickyCTA';
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
  // debounce amount to avoid query on every keystroke
  const [debouncedAmount, setDebouncedAmount] = useState(amount);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amount), 500);
    return () => clearTimeout(t);
  }, [amount]);

  const [fromToken, setFromToken] = useState('CELO');
  const [toToken, setToToken] = useState('ETH');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [step, setStep] = useState(0);
  // remove local swapQuote state; rely on react-query's cached data

  // Fetch supported chains
  const { data: chains } = useQuery({
    queryKey: ['cross-chain-chains'],
    queryFn: async () => {
      const res = await apiGet('/api/v1/yuki/bridge/chains');
      return res.data;
    }
  });

  // Fetch swap quote
  const { data: swapQuoteData, isLoading: loadingQuote, error: quoteError } = useQuery({
    queryKey: ['swap-quote', sourceChain, destinationChain, fromToken, toToken, amount],
    queryFn: async () => {
      if (!amount || parseFloat(amount) <= 0) return null;
      if (!fromToken || !toToken) return null;
      try {
        const res = await apiPost('/api/v1/yuki/bridge/quote', {
          fromChain: sourceChain,
          toChain: destinationChain,
          fromToken: fromToken.toUpperCase(),
          toToken: toToken.toUpperCase(),
          fromAmount: debouncedAmount,
          slippageTolerance: 1.0
        });
        return res.data;
      } catch (error) {
        // return null and let UI show quoteError from react-query
        return null;
      }
    },
    enabled: !!debouncedAmount && parseFloat(debouncedAmount) > 0,
    refetchInterval: !!debouncedAmount ? 15000 : undefined,
  });

  // Swap mutation
  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!isValidAddress) {
        throw new Error('Invalid destination address');
      }
      if (!swapQuoteData) {
        throw new Error('No swap quote available');
      }
      const res = await apiPost('/api/v1/yuki/bridge/swap', {
        quote: swapQuoteData,
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
      // react-query will refresh quote automatically
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

  // address validation
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(destinationAddress);
  const isSameToken = fromToken === toToken && sourceChain === destinationChain;

  const handleExecuteSwap = () => {
    if (swapMutation.isPending) return;
    toast({ title: 'Swap started', description: 'Your swap is being processed. This may take several minutes.' });
    swapMutation.mutate(undefined);
  };
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/cross-chain" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Swap & Bridge</h1>
            <p className="text-sm text-muted-foreground">Convert tokens and bridge in one flow</p>
          </div>
        </div>
        <TrustBadges />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Swap & Bridge Token</CardTitle>
          <CardDescription>Convert tokens and bridge in one flow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StepProgress step={step} />

          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <label className="text-sm font-medium mb-2 block">From Chain</label>
                <Select value={sourceChain} onValueChange={setSourceChain}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {chains?.map((chain: string) => (
                      <SelectItem key={chain} value={chain}>{CHAIN_NAMES[chain as keyof typeof CHAIN_NAMES] || chain}</SelectItem>
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
                      <SelectItem key={chain} value={chain}>{CHAIN_NAMES[chain as keyof typeof CHAIN_NAMES] || chain}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">From Token</label>
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_TOKENS[sourceChain]?.map((token) => (
                      <SelectItem key={token} value={token}>{token}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">The token you want to convert</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Amount to Swap</label>
                <Input type="number" placeholder="0.00" value={amount} onChange={(e: any) => setAmount(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">You'll send this amount of {fromToken}</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <ExpandableQuote quote={swapQuoteData} fromToken={fromToken} toToken={toToken} />
              <div>
                <label className="text-sm font-medium mb-2 block">Destination Address</label>
                <Input placeholder="0x..." value={destinationAddress} onChange={(e: any) => setDestinationAddress(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">Where your {toToken} will arrive on {CHAIN_NAMES[destinationChain as keyof typeof CHAIN_NAMES]}</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-sm">Review and confirm your swap. You will be redirected to status after confirmation.</div>
              <div className="bg-muted/50 p-3 rounded">
                <div className="flex justify-between"><span>From</span><span>{amount} {fromToken}</span></div>
                <div className="flex justify-between"><span>To (est)</span><span>{Number(swapQuoteData?.estimatedToAmount ?? 0).toFixed(6)} {toToken}</span></div>
                <div className="flex justify-between"><span>Price impact</span><span><PriceImpact value={Number(swapQuoteData?.priceImpact ?? 0)} /></span></div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
            )}
            {step < 3 && (
              <Button onClick={() => setStep((s) => Math.min(3, s + 1))}>{step === 2 ? 'Review' : 'Next'}</Button>
            )}
            {step === 3 && (
              <Button onClick={handleExecuteSwap} disabled={!amount || !destinationAddress || swapMutation.isPending || !swapQuoteData}>Execute Swap</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <StickyCTA
        receive={swapQuoteData ? `${Number(swapQuoteData?.estimatedToAmount ?? 0).toFixed(6)} ${toToken}` : undefined}
        priceImpact={Number(swapQuoteData?.priceImpact ?? 0)}
        disabled={!amount || !destinationAddress || !swapQuoteData}
        onConfirm={() => setStep(3)}
      />
    </div>
  );
}
