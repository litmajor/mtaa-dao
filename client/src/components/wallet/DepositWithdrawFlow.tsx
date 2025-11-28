import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

type DepositMethod = 'mpesa' | 'bank' | 'exchange' | 'crypto';
type WithdrawMethod = 'mpesa' | 'bank' | 'wallet' | 'crypto';
type FlowType = 'deposit' | 'withdraw';

const DEPOSIT_METHODS: Record<DepositMethod, { name: string; icon: string; fee: string; time: string; desc: string }> = {
  mpesa: { 
    name: 'M-Pesa', 
    icon: '📱', 
    fee: '0% - 2%', 
    time: '2-5 mins',
    desc: 'Direct from your M-Pesa account. Instant settlement.'
  },
  bank: { 
    name: 'Bank Transfer', 
    icon: '🏦', 
    fee: '0.5% - 1%', 
    time: '1-2 hours',
    desc: 'Standard bank transfer to your vault account.'
  },
  exchange: { 
    name: 'Exchange Onramp', 
    icon: '💱', 
    fee: '1% - 3%', 
    time: '5-15 mins',
    desc: 'Buy crypto directly using card or bank.'
  },
  crypto: {
    name: 'Crypto Transfer',
    icon: '⛓️',
    fee: 'Network gas',
    time: 'Varies',
    desc: 'Transfer from another crypto wallet.'
  }
};

const WITHDRAW_METHODS: Record<WithdrawMethod, { name: string; icon: string; fee: string; time: string; desc: string }> = {
  mpesa: { 
    name: 'M-Pesa', 
    icon: '📱', 
    fee: '1% - 3%', 
    time: '2-5 mins',
    desc: 'Cash out directly to M-Pesa. Quick access.'
  },
  bank: { 
    name: 'Bank Account', 
    icon: '🏦', 
    fee: '0.5% - 2%', 
    time: '1-3 hours',
    desc: 'Transfer to your bank account.'
  },
  wallet: { 
    name: 'External Wallet', 
    icon: '👛', 
    fee: 'Network gas', 
    time: '5-30 mins',
    desc: 'Send to any crypto wallet address.'
  },
  crypto: {
    name: 'Crypto Swap',
    icon: '🔄',
    fee: '0.5% - 1%',
    time: '1-5 mins',
    desc: 'Convert and send as different token.'
  }
};

const FLOW_STEPS = {
  deposit: {
    mpesa: [
      { num: 1, title: 'Enter Amount', desc: 'Specify how much you want to deposit' },
      { num: 2, title: 'Send to M-Pesa Number', desc: 'Dial *483*123*amount# or use M-Pesa App' },
      { num: 3, title: 'Confirm Payment', desc: 'Enter your M-Pesa PIN to complete' },
      { num: 4, title: 'Instant Credit', desc: 'Funds appear in your wallet immediately' }
    ],
    bank: [
      { num: 1, title: 'Enter Amount', desc: 'Specify deposit amount' },
      { num: 2, title: 'Get Account Details', desc: 'We\'ll show you our receiving bank account' },
      { num: 3, title: 'Transfer Funds', desc: 'Send from your bank (use reference code)' },
      { num: 4, title: 'Confirmation', desc: 'Funds settle within 1-2 hours' }
    ],
    exchange: [
      { num: 1, title: 'Enter Amount', desc: 'How much do you want to buy?' },
      { num: 2, title: 'Select Payment Method', desc: 'Card, bank transfer, or mobile money' },
      { num: 3, title: 'Verify Identity', desc: 'One-time KYC verification (1-2 mins)' },
      { num: 4, title: 'Complete Purchase', desc: 'Crypto delivered to your wallet' }
    ],
    crypto: [
      { num: 1, title: 'Copy Wallet Address', desc: 'Your unique receive address' },
      { num: 2, title: 'Send from Another Wallet', desc: 'Use the address to transfer crypto' },
      { num: 3, title: 'Wait for Confirmations', desc: 'Transaction needs blockchain confirmations' },
      { num: 4, title: 'Funds Received', desc: 'See them in your wallet' }
    ]
  },
  withdraw: {
    mpesa: [
      { num: 1, title: 'Enter Amount', desc: 'How much do you want to withdraw?' },
      { num: 2, title: 'Verify M-Pesa Number', desc: 'Confirm your M-Pesa phone number' },
      { num: 3, title: 'Approve Transaction', desc: 'Confirm withdrawal on your app' },
      { num: 4, title: 'Money in Your Account', desc: 'Appears in M-Pesa within 2-5 minutes' }
    ],
    bank: [
      { num: 1, title: 'Enter Amount', desc: 'Specify withdrawal amount' },
      { num: 2, title: 'Provide Bank Details', desc: 'Account number and bank name' },
      { num: 3, title: 'Confirm & Review', desc: 'Check all details are correct' },
      { num: 4, title: 'Wait for Settlement', desc: 'Funds arrive in 1-3 business hours' }
    ],
    wallet: [
      { num: 1, title: 'Enter Amount', desc: 'How much to send?' },
      { num: 2, title: 'Paste Wallet Address', desc: 'Destination crypto wallet address' },
      { num: 3, title: 'Confirm Network', desc: 'Select which blockchain to use' },
      { num: 4, title: 'Send Complete', desc: 'Wait for network confirmations' }
    ],
    crypto: [
      { num: 1, title: 'Select Token', desc: 'Choose which token to convert to' },
      { num: 2, title: 'Enter Amount', desc: 'How much to swap?' },
      { num: 3, title: 'Preview Rate', desc: 'See the exchange rate' },
      { num: 4, title: 'Swap Complete', desc: 'New tokens in your wallet' }
    ]
  }
};

export function DepositWithdrawFlow() {
  const [flowType, setFlowType] = useState<FlowType>('deposit');
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | WithdrawMethod>('mpesa');
  const [amount, setAmount] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  const methods = flowType === 'deposit' ? DEPOSIT_METHODS : WITHDRAW_METHODS;
  const methodInfo = methods[selectedMethod];
  const steps = FLOW_STEPS[flowType][selectedMethod as any] || [];

  const handleStart = () => {
    if (!amount) {
      toast.error('Please enter an amount');
      return;
    }
    setCurrentStep(1);
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setAmount('');
  };

  return (
    <div className="space-y-6">
      {/* Flow Type Selector */}
      <div className="flex gap-4">
        <button
          onClick={() => { setFlowType('deposit'); setCurrentStep(0); }}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            flowType === 'deposit'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          data-testid="button-flow-deposit"
        >
          <ArrowDownLeft className="w-6 h-6 mx-auto mb-2 text-green-600" />
          <p className="font-semibold text-gray-900 dark:text-white">Deposit</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Add funds</p>
        </button>
        <button
          onClick={() => { setFlowType('withdraw'); setCurrentStep(0); }}
          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
            flowType === 'withdraw'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          data-testid="button-flow-withdraw"
        >
          <ArrowUpRight className="w-6 h-6 mx-auto mb-2 text-blue-600" />
          <p className="font-semibold text-gray-900 dark:text-white">Withdraw</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Remove funds</p>
        </button>
      </div>

      {/* Main Flow Card */}
      {currentStep === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Method Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(methods).map(([key, method]) => (
                <motion.button
                  key={key}
                  onClick={() => setSelectedMethod(key as any)}
                  whileHover={{ scale: 1.02 }}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedMethod === key
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                  data-testid={`button-method-${key}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{method.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{method.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{method.desc}</p>
                      <div className="flex gap-3 mt-2">
                        <Badge variant="outline" className="text-xs">{method.fee}</Badge>
                        <Badge variant="outline" className="text-xs">{method.time}</Badge>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </CardContent>
          </Card>

          {/* Amount Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enter Amount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Amount (KES)
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-lg"
                  data-testid="input-amount"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Fee: {methodInfo.fee} • Time: {methodInfo.time}
                </p>
              </div>
              <Button onClick={handleStart} className="w-full bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-start-flow">
                Start {flowType === 'deposit' ? 'Deposit' : 'Withdrawal'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        // Step-by-Step Flow
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Step {currentStep} of {steps.length}</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{Math.round((currentStep / steps.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Current Step */}
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{steps[currentStep - 1]?.num}</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {steps[currentStep - 1]?.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {steps[currentStep - 1]?.desc}
                </p>

                {/* Amount Display */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Amount</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">KES {amount}</p>
                </div>

                {/* Instructions for specific step */}
                {currentStep === 2 && selectedMethod === 'mpesa' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-left mb-6 text-sm text-blue-900 dark:text-blue-300">
                    <p className="font-mono font-bold mb-2">*483*123*{amount}#</p>
                    <p>Then press SEND on your phone. You'll receive a prompt to enter your M-Pesa PIN.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1" data-testid="button-cancel-flow">
              Cancel
            </Button>
            {currentStep < steps.length && (
              <Button onClick={handleNext} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-next-step">
                Next Step
              </Button>
            )}
            {currentStep === steps.length && (
              <Button onClick={handleReset} className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600" data-testid="button-complete-flow">
                Done
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
