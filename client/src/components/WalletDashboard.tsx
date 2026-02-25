import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PersonalVaultSection } from './wallet/PesonalVaultBalance';
import { PortfolioOverview } from './wallet/PortfolioOverview';
import TransactionHistory from './wallet/TransactionHistory';
import { TransactionMonitor } from './wallet/TransactionMonitor';
import { DepositWithdrawFlow } from './wallet/DepositWithdrawFlow';
import SplitBillModal from './wallet/SplitBillModal';
import PaymentRequestModal from './wallet/PaymentRequestModal';
import { Button } from '@/components/ui/button';
import { Zap, Send, Split, Lock, Shield } from 'lucide-react';
import { useWallet } from '@/pages/hooks/useWallet';

export default function WalletDashboard() {
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [showPaymentRequest, setShowPaymentRequest] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(false);

  // Check 2FA and PIN status on component mount
  useEffect(() => {
    const checkSecurityStatus = async () => {
      try {
        const res = await fetch('/api/2fa/config', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.success) {
          setTwoFAEnabled(data.config?.twoFA?.enabled || false);
          setPinConfigured(data.config?.pin?.configured || false);
        }
      } catch (err) {
        console.error('Failed to check security status:', err);
      }
    };

    checkSecurityStatus();
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Wallet</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your funds and transactions</p>
        </div>

        {/* Security Status Badges */}
        <div className="flex gap-2 items-center">
          {twoFAEnabled && (
            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
              <Shield className="w-3 h-3 mr-1" />
              2FA Enabled
            </Badge>
          )}
          {pinConfigured && (
            <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
              <Lock className="w-3 h-3 mr-1" />
              PIN Set
            </Badge>
          )}
          {!twoFAEnabled && (
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              2FA Disabled
            </Badge>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowPaymentRequest(true)}
            data-testid="button-request-payment"
          >
            <Zap className="w-4 h-4 mr-2" />
            Request Payment
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowSplitBill(true)}
            data-testid="button-split-bill"
          >
            <Split className="w-4 h-4 mr-2" />
            Split Bill
          </Button>
          <Button 
            variant="default"
            data-testid="button-send-funds"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Funds
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="vault" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="vault">Vault</TabsTrigger>
          <TabsTrigger value="deposit">Deposit/Withdraw</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Vault Tab */}
        <TabsContent value="vault" className="space-y-6">
          <PersonalVaultSection />
        </TabsContent>

        {/* Deposit/Withdraw Tab */}
        <TabsContent value="deposit" className="space-y-6">
          <DepositWithdrawFlow />
        </TabsContent>

        {/* Portfolio Tab */}
        <TabsContent value="portfolio" className="space-y-6">
          <PortfolioOverview />
        </TabsContent>

        {/* Transaction Monitor Tab */}
        <TabsContent value="monitor" className="space-y-6">
          <TransactionMonitor />
        </TabsContent>

        {/* Transaction History Tab */}
        <TabsContent value="history" className="space-y-6">
          <TransactionHistory />
        </TabsContent>

        {/* Advanced Features Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {showSplitBill && <SplitBillModal onClose={() => setShowSplitBill(false)} />}
            {showPaymentRequest && <PaymentRequestModal onClose={() => setShowPaymentRequest(false)} />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
