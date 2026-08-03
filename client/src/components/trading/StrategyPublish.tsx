import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, DollarSign, Tag, FileText, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { publishStrategy } from '@/api/yukiApi';
import { useToast } from '@/hooks/use-toast';

interface StrategyPublishProps {
  strategyId: string;
  strategyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StrategyPublish({ strategyId, strategyName, open, onOpenChange }: StrategyPublishProps) {
  const { toast } = useToast();
  const [model, setModel] = useState<'free' | 'profit-share' | 'subscription' | 'licensing'>('free');
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'mean-reversion' | 'momentum' | 'arbitrage' | 'yield' | 'grid'>('mean-reversion');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      return publishStrategy(strategyId, { model, amount: amount ? Number(amount) : undefined }, description, category);
    },
    onSuccess: () => {
      toast({
        title: 'Strategy Published! 🎉',
        description: 'Your strategy is now live on the Yuki Marketplace.',
        variant: 'default',
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Publish Failed',
        description: 'There was an error publishing your strategy. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const isFormValid = () => {
    if (description.length < 50) return false;
    if (!termsAccepted) return false;
    if (model !== 'free' && (!amount || Number(amount) <= 0)) return false;
    return true;
  };

  const handlePublish = () => {
    if (!isFormValid()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6 text-blue-400" />
            Publish to Marketplace
          </DialogTitle>
          <DialogDescription className="text-slate-400 mt-2">
            Share "{strategyName}" with the community and optionally monetize your trading logic.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Category */}
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2 text-slate-300">
              <Tag className="h-4 w-4" /> Strategy Category
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['mean-reversion', 'momentum', 'arbitrage', 'yield', 'grid'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat as any)}
                  className={`px-3 py-2 rounded border text-sm capitalize transition-colors ${
                    category === cat 
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300' 
                    : 'bg-slate-800 border-slate-700 hover:border-slate-500 text-slate-400'
                  }`}
                >
                  {cat.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2 text-slate-300">
              <FileText className="h-4 w-4" /> Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain how your strategy works, the risks involved, and who it's for... (min 50 characters)"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm min-h-[100px] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <div className="text-right text-xs text-slate-500">
              {description.length} / 50 min
            </div>
          </div>

          {/* Pricing Model */}
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2 text-slate-300">
              <DollarSign className="h-4 w-4" /> Pricing Model
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'free', label: 'Free (Open Source)', desc: 'Anyone can copy and use' },
                { id: 'profit-share', label: 'Profit Share', desc: 'Take a % of follower profits' },
                { id: 'subscription', label: 'Subscription', desc: 'Monthly recurring fee' },
                { id: 'licensing', label: 'Licensing', desc: 'One-time fee to copy' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m.id as any); setAmount(''); }}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    model === m.id 
                    ? 'bg-purple-600/20 border-purple-500' 
                    : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className={`font-semibold mb-1 ${model === m.id ? 'text-purple-300' : 'text-slate-300'}`}>{m.label}</div>
                  <div className="text-xs text-slate-500">{m.desc}</div>
                </button>
              ))}
            </div>

            {model !== 'free' && (
              <div className="mt-4 flex items-center gap-3 bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="font-medium text-slate-300">
                  {model === 'profit-share' ? 'Profit Share % :' :
                   model === 'subscription' ? 'Monthly Fee (USD) :' :
                   'One-time Fee (USD) :'}
                </div>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-32 bg-slate-900 border-slate-600"
                  placeholder={model === 'profit-share' ? 'e.g. 10' : 'e.g. 50'}
                />
              </div>
            )}
          </div>

          {/* Terms */}
          <div className="pt-4 border-t border-slate-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded border ${termsAccepted ? 'bg-blue-600 border-blue-600' : 'border-slate-500'} flex items-center justify-center transition-colors`} onClick={() => setTermsAccepted(!termsAccepted)}>
                {termsAccepted && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className="text-sm text-slate-400 select-none" onClick={() => setTermsAccepted(!termsAccepted)}>
                I confirm that this strategy has been thoroughly backtested and does not contain malicious logic. I agree to the Yuki Marketplace Terms of Service and understand my reputation score will be impacted by its performance.
              </div>
            </label>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 bg-slate-800/50 border-t border-slate-700 sm:justify-between">
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handlePublish}
            disabled={!isFormValid() || mutation.isPending}
          >
            {mutation.isPending ? 'Publishing...' : 'Publish to Marketplace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
