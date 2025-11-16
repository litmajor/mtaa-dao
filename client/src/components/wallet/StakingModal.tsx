
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { TrendingUp, Lock, Info } from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface StakingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StakingModal({ isOpen, onClose }: StakingModalProps) {
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('30');
  const { toast } = useToast();

  const stakingOptions = [
    { days: 30, apy: '8.5%', protocol: 'Moola Market' },
    { days: 90, apy: '10.2%', protocol: 'Celo Validators' },
    { days: 180, apy: '12.8%', protocol: 'Ubeswap LP' },
  ];

  const selectedOption = stakingOptions.find(o => o.days.toString() === period) || stakingOptions[0];

  const handleStake = () => {
    toast({ 
      title: 'Staking Initiated', 
      description: `Staking ${amount} CELO for ${period} days at ${selectedOption.apy} APY` 
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Stake & Earn
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="text-sm font-medium">Amount to Stake</label>
            <Input 
              type="number" 
              placeholder="0.0" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Available: 100.00 CELO</p>
          </div>

          {/* Staking Period */}
          <div>
            <label className="text-sm font-medium">Staking Period</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {stakingOptions.map(option => (
                <button
                  key={option.days}
                  onClick={() => setPeriod(option.days.toString())}
                  className={`p-3 rounded-lg border-2 transition ${
                    period === option.days.toString()
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-semibold">{option.days} days</div>
                  <div className="text-xs text-green-600">{option.apy} APY</div>
                </button>
              ))}
            </div>
          </div>

          {/* Protocol Info */}
          <div className="p-3 bg-blue-50 rounded space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-blue-600" />
              Protocol: {selectedOption.protocol}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Est. Earnings:</span>
                <div className="font-semibold">
                  {amount ? (parseFloat(amount) * parseFloat(selectedOption.apy) / 100 * parseInt(period) / 365).toFixed(2) : '0.00'} CELO
                </div>
              </div>
              <div>
                <span className="text-gray-600">Lock Period:</span>
                <div className="font-semibold flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {period} days
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            ⚠️ Your funds will be locked for {period} days. Early withdrawal may incur penalties.
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleStake} disabled={!amount} className="flex-1 bg-green-600 hover:bg-green-700">
              Stake Now
            </Button>
            <Button onClick={onClose} variant="outline">Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
