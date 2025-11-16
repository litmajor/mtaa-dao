
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ArrowDown, RefreshCw, Settings } from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface TokenSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenSwapModal({ isOpen, onClose }: TokenSwapModalProps) {
  const [fromToken, setFromToken] = useState('cUSD');
  const [toToken, setToToken] = useState('CELO');
  const [fromAmount, setFromAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const { toast } = useToast();

  const tokens = ['cUSD', 'CELO', 'cEUR', 'cREAL'];
  const exchangeRate = 0.65; // Mock rate

  const handleSwap = () => {
    toast({ title: 'Swap Initiated', description: `Swapping ${fromAmount} ${fromToken} for ${toToken}` });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Swap Tokens</CardTitle>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* From Token */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <label className="text-sm text-gray-600">From</label>
            <div className="flex items-center gap-2 mt-2">
              <Input 
                type="number" 
                placeholder="0.0" 
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="flex-1 text-2xl font-bold border-0 bg-transparent"
              />
              <select 
                value={fromToken} 
                onChange={(e) => setFromToken(e.target.value)}
                className="p-2 rounded bg-white border"
              >
                {tokens.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <p className="text-sm text-gray-500 mt-1">Balance: 1,234.56 {fromToken}</p>
          </div>

          {/* Swap Direction */}
          <div className="flex justify-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full"
              onClick={() => {
                const temp = fromToken;
                setFromToken(toToken);
                setToToken(temp);
              }}
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          </div>

          {/* To Token */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <label className="text-sm text-gray-600">To (estimated)</label>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 text-2xl font-bold">
                {fromAmount ? (parseFloat(fromAmount) * exchangeRate).toFixed(2) : '0.0'}
              </div>
              <select 
                value={toToken} 
                onChange={(e) => setToToken(e.target.value)}
                className="p-2 rounded bg-white border"
              >
                {tokens.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <p className="text-sm text-gray-500 mt-1">1 {fromToken} = {exchangeRate} {toToken}</p>
          </div>

          {/* Swap Details */}
          <div className="p-3 bg-blue-50 rounded text-sm space-y-1">
            <div className="flex justify-between">
              <span>Slippage Tolerance</span>
              <span>{slippage}%</span>
            </div>
            <div className="flex justify-between">
              <span>Network Fee</span>
              <span>~$0.01</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleSwap} disabled={!fromAmount} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Swap
            </Button>
            <Button onClick={onClose} variant="outline">Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
