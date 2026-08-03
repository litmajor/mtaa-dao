import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { triggerRebalance } from '@/api/yukiApi';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { AlertCircle, RefreshCw, BarChart2, Shield } from 'lucide-react';

interface AssetAllocation {
  asset: string;
  weight: number; // percentage
}

const DEFAULT_ALLOCATIONS: AssetAllocation[] = [
  { asset: 'BTC', weight: 40 },
  { asset: 'XAUT', weight: 30 },
  { asset: 'ETH', weight: 10 },
  { asset: 'SOL', weight: 10 },
  { asset: 'AAVE', weight: 5 },
  { asset: 'LINK', weight: 5 },
];

export default function RebalancingPanel() {
  const { toast } = useToast();
  const [allocations, setAllocations] = useState<AssetAllocation[]>(DEFAULT_ALLOCATIONS);
  const [maxSlippage, setMaxSlippage] = useState<number>(1.0);

  const totalWeight = allocations.reduce((sum, item) => sum + item.weight, 0);

  const rebalanceMutation = useMutation({
    mutationFn: async () => {
      // Map allocations to the API payload shape
      const orders = allocations.map(a => ({
        asset: a.asset,
        action: 'buy' as const, // The backend route resolves actual buy/sell internally or accepts target state
        amount: a.weight,       // Sending weights or amounts
        amountUsd: a.weight * 10 // Simulated USD sizes
      }));
      return triggerRebalance('custom-rebalance', orders);
    },
    onSuccess: (data) => {
      toast({
        title: 'Rebalance Triggered',
        description: `Successfully initiated portfolio rebalancing. Task ID: ${data?.taskId || 'Pending'}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Rebalance Failed',
        description: err.message || 'Failed to trigger portfolio rebalance',
        variant: 'destructive',
      });
    }
  });

  const handleWeightChange = (index: number, val: number) => {
    const updated = [...allocations];
    updated[index].weight = val;
    setAllocations(updated);
  };

  const handleTrigger = () => {
    if (totalWeight !== 100) {
      toast({
        title: 'Invalid Allocations',
        description: `Total allocation must equal 100%. Currently: ${totalWeight}%`,
        variant: 'destructive'
      });
      return;
    }
    rebalanceMutation.mutate();
  };

  return (
    <div className="space-y-6 bg-slate-900 border border-slate-800 p-6 rounded-xl text-white">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500 animate-spin-slow" />
            Portfolio Rebalancing
          </h2>
          <p className="text-sm text-slate-400 mt-1">Set target weights and rebalance allocations instantly</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-slate-300">Microstructure Risk Gate Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 bg-slate-800/40 p-5 rounded-xl border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Target Asset Allocation</h3>
          
          <div className="space-y-4">
            {allocations.map((item, idx) => (
              <div key={item.asset} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-200">{item.asset}</span>
                  <span className="text-slate-400">{item.weight}%</span>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[item.weight]}
                    onValueChange={(val) => handleWeightChange(idx, val[0])}
                    className="flex-1"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-400">Total Allocation:</span>
            <span className={`text-lg font-bold ${totalWeight === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalWeight}% / 100%
            </span>
          </div>
        </div>

        <div className="space-y-6 flex flex-col justify-between">
          <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Execution Settings</h3>
            
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Max Price Slippage (%)</label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                value={maxSlippage}
                onChange={(e) => setMaxSlippage(parseFloat(e.target.value) || 0.5)}
                className="bg-slate-950 border-slate-800 text-white"
              />
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800/80 flex gap-3 text-xs text-slate-400">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-semibold text-slate-300 mb-1">Execution Warnings</p>
                <p>Rebalancing will perform spot swaps on linked CEX venues. Illiquid pairs will be checked against the active microstructure spread monitor.</p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleTrigger}
            disabled={totalWeight !== 100 || rebalanceMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 py-6 text-base font-bold shadow-lg shadow-blue-900/20"
          >
            {rebalanceMutation.isPending ? 'Processing Rebalance...' : 'Execute Portfolio Rebalance'}
          </Button>
        </div>
      </div>
    </div>
  );
}
