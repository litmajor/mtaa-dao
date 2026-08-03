import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Play, TrendingUp, Clock, Settings2 } from 'lucide-react';

export default function AlgoTradingPanel() {
  const { toast } = useToast();
  const [asset, setAsset] = useState('BTC/USDT');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('1.5');
  const [duration, setDuration] = useState('60'); // Minutes
  const [chunks, setChunks] = useState('6');
  const [slippage, setSlippage] = useState('0.5');

  const startAlgoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/yuki/algo/twap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // fallback mapping
        },
        body: JSON.stringify({
          symbol: asset,
          side,
          amount: parseFloat(amount),
          durationMinutes: parseFloat(duration),
          chunks: parseInt(chunks)
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to place TWAP order');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Algo Order Placed',
        description: `Successfully scheduled TWAP execution task ${data?.parentId?.slice(0, 8)}...`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Algo Placement Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  });

  const handleStart = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    startAlgoMutation.mutate();
  };

  return (
    <div className="space-y-6 bg-slate-900 border border-slate-800 p-6 rounded-xl text-white">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Algorithmic Trading (TWAP)
          </h2>
          <p className="text-sm text-slate-400 mt-1">Split large block orders across specific execution time windows</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Asset Pair</label>
            <Select value={asset} onValueChange={setAsset}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                <SelectValue placeholder="Select asset pair" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-white">
                <SelectItem value="BTC/USDT">BTC/USDT</SelectItem>
                <SelectItem value="ETH/USDT">ETH/USDT</SelectItem>
                <SelectItem value="SOL/USDT">SOL/USDT</SelectItem>
                <SelectItem value="XAUT/USDT">XAUT/USDT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Side</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={side === 'buy' ? 'default' : 'outline'}
                  onClick={() => setSide('buy')}
                  className={`py-5 font-semibold ${side === 'buy' ? 'bg-emerald-600 hover:bg-emerald-500' : 'border-slate-800 hover:bg-slate-800/40 text-slate-300'}`}
                >
                  BUY
                </Button>
                <Button
                  variant={side === 'sell' ? 'default' : 'outline'}
                  onClick={() => setSide('sell')}
                  className={`py-5 font-semibold ${side === 'sell' ? 'bg-rose-600 hover:bg-rose-500' : 'border-slate-800 hover:bg-slate-800/40 text-slate-300'}`}
                >
                  SELL
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Amount</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white py-5"
                placeholder="0.0"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 bg-slate-800/40 p-5 rounded-xl border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2">
            <Settings2 className="h-4 w-4 text-slate-400" />
            Execution Slicing Settings
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Duration (Minutes)</label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Slices/Chunks</label>
              <Input
                type="number"
                value={chunks}
                onChange={(e) => setChunks(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Max Price Slippage (%)</label>
            <Input
              type="number"
              step="0.1"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white"
            />
          </div>

          <div className="bg-slate-900/60 p-4 rounded-lg flex items-start gap-3 text-xs text-slate-400 mt-2">
            <Clock className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">Slice Execution Estimate:</span>
              <p className="mt-1">
                Executing {amount ? (parseFloat(amount) / parseInt(chunks || '1')).toFixed(4) : '0.0'} {asset.split('/')[0]} every{' '}
                {duration ? (parseFloat(duration) / parseInt(chunks || '1')).toFixed(1) : '0.0'} minutes.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-800">
        <Button
          onClick={handleStart}
          disabled={startAlgoMutation.isPending}
          className="bg-blue-600 hover:bg-blue-500 font-bold px-8 py-6 rounded-lg text-base flex items-center gap-2"
        >
          <Play className="h-5 w-5 fill-current" />
          {startAlgoMutation.isPending ? 'Deploying Algorithm...' : 'Launch TWAP Execution'}
        </Button>
      </div>
    </div>
  );
}
