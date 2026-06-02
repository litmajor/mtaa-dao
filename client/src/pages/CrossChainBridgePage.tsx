import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpRight, LoaderCircle, ChevronDown, ChevronLeft } from 'lucide-react';
import StepProgress from '@/components/crosschain/StepProgress';
import DestinationPreview from '@/components/crosschain/DestinationPreview';
import FeeIndicator from '@/components/crosschain/FeeIndicator';
import RiskCollapse from '@/components/crosschain/RiskCollapse';
import RouteInfo from '@/components/crosschain/RouteInfo';
import TokenSelector from '@/components/crosschain/TokenSelector';
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

export default function CrossChainBridgePage() {
  const { toast } = useToast();
  const [sourceChain, setSourceChain] = useState('celo');
  const [destinationChain, setDestinationChain] = useState('ethereum');
  const [amount, setAmount] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [step, setStep] = useState(0);
  const [destinationAddress, setDestinationAddress] = useState('');

  // Fetch supported chains
  const { data: chains } = useQuery({
    queryKey: ['cross-chain-chains'],
    queryFn: async () => {
      const res = await apiGet('/api/v1/yuki/bridge/chains');
      return res.data;
    }
  });

  // Fetch fee estimate
  const { data: feeEstimate, isLoading: loadingFees, error: feeError } = useQuery({
    queryKey: ['bridge-fees', sourceChain, destinationChain, amount],
    queryFn: async () => {
      if (!amount || parseFloat(amount) <= 0) return null;
      
      try {
        const res = await apiPost('/api/v1/yuki/bridge/fees', { 
          sourceChain, 
          destinationChain, 
          amount 
        });
        return res.data;
      } catch (error: any) {
        const message = error?.response?.data?.message || error?.message || 'Failed to fetch fees';
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

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!destinationAddress || !destinationAddress.startsWith('0x')) {
        throw new Error('Invalid destination address');
      }
      if (!tokenAddress || !tokenAddress.startsWith('0x')) {
        throw new Error('Invalid token address');
      }
      const res = await apiPost('/api/v1/yuki/bridge/transfer', {
        sourceChain,
        destinationChain,
        tokenAddress,
        amount,
        destinationAddress,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Transfer Initiated',
        description: `Transaction ID: ${data.transferId}. Estimated time: ${Math.floor((data.estimatedTime || 1800) / 60)} minutes`
      });
      setAmount('');
      setDestinationAddress('');
      setTokenAddress('');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to initiate transfer';
      toast({
        title: 'Transfer Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/cross-chain" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Bridge Assets</h1>
            <p className="text-sm text-muted-foreground">Move tokens across chains with guidance and risk info</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bridge Token</CardTitle>
          <CardDescription>Structured flow to reduce cognitive load</CardDescription>
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
                <ArrowUpRight className="h-6 w-6 text-muted-foreground" />
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
            <div>
              <TokenSelector chain={sourceChain} value={tokenSymbol} address={tokenAddress} onSelect={(sym, addr) => { setTokenSymbol(sym); if (addr) setTokenAddress(addr); }} onAddressChange={setTokenAddress} />
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Amount to Bridge</label>
              <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">You'll send this exact amount to the destination chain</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <FeeIndicator total={Number(feeEstimate?.totalFee ?? 0)} />
              <RouteInfo route={feeEstimate?.route} speed={feeEstimate?.speed} reliability={feeEstimate?.reliability} />
              <DestinationPreview chain={CHAIN_NAMES[destinationChain as keyof typeof CHAIN_NAMES] || destinationChain} token={tokenSymbol || tokenAddress || 'Token'} eta={feeEstimate?.eta} />
              <RiskCollapse />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="text-sm">Confirm and initiate the bridge transfer</div>
              <div className="bg-muted/50 p-3 rounded">
                <div className="flex justify-between"><span>From</span><span>{amount} {tokenSymbol || ''}</span></div>
                <div className="flex justify-between"><span>To</span><span>{tokenSymbol || ''} on {CHAIN_NAMES[destinationChain as keyof typeof CHAIN_NAMES]}</span></div>
                <div className="flex justify-between"><span>Total Fee</span><span>{feeEstimate?.totalFee ?? '—'}</span></div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>}
            {step < 4 && <Button onClick={() => setStep((s) => Math.min(4, s + 1))}>{step === 3 ? 'Review' : 'Next'}</Button>}
            {step === 4 && (
              <Button onClick={() => transferMutation.mutate(undefined)} disabled={!amount || !destinationAddress || transferMutation.isPending || loadingFees}>Bridge Assets</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <StickyCTA
        receive={feeEstimate ? `${Number((feeEstimate?.received ?? 0)).toFixed(6)} ${tokenSymbol || ''}` : undefined}
        priceImpact={0}
        disabled={!amount || !destinationAddress || !feeEstimate}
        onConfirm={() => setStep(4)}
      />
    </div>
  );
}
