
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const CHAIN_NAMES = {
  'celo': 'Celo',
  'ethereum': 'Ethereum',
  'polygon': 'Polygon',
  'optimism': 'Optimism',
  'arbitrum': 'Arbitrum'
};

export default function CrossChainBridge() {
  const { toast } = useToast();
  const [sourceChain, setSourceChain] = useState('celo');
  const [destinationChain, setDestinationChain] = useState('ethereum');
  const [amount, setAmount] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');

  // Fetch supported chains
  const { data: chains } = useQuery({
    queryKey: ['cross-chain-chains'],
    queryFn: async () => {
      const res = await apiRequest('/api/cross-chain/chains');
      return res.data;
    }
  });

  // Fetch fee estimate
  const { data: feeEstimate, isLoading: loadingFees } = useQuery({
    queryKey: ['bridge-fees', sourceChain, destinationChain, amount],
    queryFn: async () => {
      if (!amount || parseFloat(amount) <= 0) return null;
      const res = await apiRequest('/api/cross-chain/estimate-fees', {
        method: 'POST',
        body: JSON.stringify({ sourceChain, destinationChain, amount })
      });
      return res.data;
    },
    enabled: !!amount && parseFloat(amount) > 0
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/cross-chain/transfer', {
        method: 'POST',
        body: JSON.stringify({
          sourceChain,
          destinationChain,
          tokenAddress,
          amount,
          destinationAddress
        })
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Transfer Initiated',
        description: `Transfer ID: ${data.transferId}. Estimated time: ${Math.floor(data.estimatedTime / 60)} minutes`
      });
      // Reset form
      setAmount('');
      setDestinationAddress('');
    },
    onError: () => {
      toast({
        title: 'Transfer Failed',
        description: 'Failed to initiate cross-chain transfer',
        variant: 'destructive'
      });
    }
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Cross-Chain Bridge</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Bridge Assets Across Chains</CardTitle>
          <CardDescription>
            Transfer tokens between Celo, Ethereum, Polygon, Optimism, and more
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <div>
            <label className="text-sm font-medium mb-2 block">Destination Address</label>
            <Input
              placeholder="0x..."
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
            />
          </div>

          {/* Fee Estimate */}
          {feeEstimate && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="space-y-2 text-sm">
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
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={!amount || !tokenAddress || !destinationAddress || transferMutation.isPending}
            className="w-full"
            size="lg"
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initiating Transfer...
              </>
            ) : (
              'Bridge Assets'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
