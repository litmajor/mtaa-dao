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

export default function CrossChainBridgePage() {
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
      const res = await apiGet('/api/cross-chain/chains');
      return res.data;
    }
  });

  // Fetch fee estimate
  const { data: feeEstimate, isLoading: loadingFees, error: feeError } = useQuery({
    queryKey: ['bridge-fees', sourceChain, destinationChain, amount],
    queryFn: async () => {
      if (!amount || parseFloat(amount) <= 0) return null;
      
      try {
        const res = await apiPost('/api/cross-chain/estimate-fees', { 
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
      const res = await apiPost('/api/cross-chain/transfer', {
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
      {/* Back Link */}
      <Link to="/cross-chain" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
        <ChevronLeft className="h-4 w-4" />
        Back to Hub
      </Link>

      <h1 className="text-3xl font-bold mb-2">Bridge Assets</h1>
      <p className="text-gray-600 mb-6">Transfer your tokens to another blockchain while keeping the same token type</p>
      
      <Card>
        <CardHeader>
          <CardTitle>Bridge Token</CardTitle>
          <CardDescription>
            Move your tokens across blockchains. Your token type stays the same.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Information Card */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base text-blue-900">How Bridging Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-blue-900">
              <div>
                <p className="font-semibold mb-1">💡 The Process:</p>
                <p className="text-blue-800">1. You lock your tokens on the source chain 2. Smart contracts verify the lock 3. Equivalent tokens are released on the destination chain</p>
              </div>
              <div>
                <p className="font-semibold mb-1">✅ Key Benefits:</p>
                <p className="text-blue-800">Token amount stays exactly the same. No conversion involved. Access the same token on different chains.</p>
              </div>
              <div>
                <p className="font-semibold mb-1">⏱️ Timeline:</p>
                <p className="text-blue-800">Typical processing: 10-30 minutes. Speed depends on network congestion.</p>
              </div>
              <div>
                <p className="font-semibold mb-1">💰 Costs:</p>
                <p className="text-blue-800">Bridge fee + gas fees on both chains. Usually €5-50 depending on chain and network conditions.</p>
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

          {/* Token and Amount Details */}
          <div>
            <label className="text-sm font-medium mb-2 block">Token Address</label>
            <Input
              placeholder="0x..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              description="The contract address of the token you want to bridge"
            />
            <p className="text-xs text-gray-500 mt-1">Enter the token contract address on the source chain</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Amount to Bridge</label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">You'll send this exact amount to the destination chain</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Destination Address</label>
            <Input
              placeholder="0x..."
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Where your tokens will arrive on the destination chain</p>
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
                  <div className="mt-3 p-2 bg-blue-100 rounded text-blue-800 text-xs">
                    <p className="font-semibold mb-1">📌 Tips for successful bridging:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Make sure you have enough balance to cover fees</li>
                      <li>Don't modify the destination address during transfer</li>
                      <li>Check back in 10-30 minutes to see your tokens</li>
                      <li>On busy chains, fees may be higher - consider timing</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Errors */}
          {feeError && (
            <div className="p-3 bg-red-100 border border-red-300 rounded text-red-800 text-sm">
              <p className="font-semibold mb-1">⚠️ Error calculating fees:</p>
              <p>{feeError instanceof Error ? feeError.message : 'Unable to calculate fees. Check your inputs.'}</p>
            </div>
          )}

          {/* Input Validation Feedback */}
          {amount && sourceChain && destinationChain && tokenAddress && destinationAddress && !feeError && (
            <div className="p-3 bg-green-100 border border-green-300 rounded text-green-800 text-sm">
              <p className="font-semibold">✅ All inputs validated</p>
              <p>Ready to bridge {amount} tokens to {CHAIN_NAMES[destinationChain as keyof typeof CHAIN_NAMES]}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={
              !amount || 
              !destinationAddress || 
              !tokenAddress ||
              transferMutation.isPending ||
              loadingFees
            }
            className="w-full"
            size="lg"
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initiating Bridge...
              </>
            ) : loadingFees ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculating Fees...
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
