import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersonalVaultSection } from './wallet/PesonalVaultBalance';
import { PortfolioOverview } from './wallet/PortfolioOverview';
import { TransactionHistory } from './wallet/TransactionHistory';
import SplitBillModal from './wallet/SplitBillModal';
import PaymentRequestModal from './wallet/PaymentRequestModal';
import { Button } from '@/components/ui/button';
import { Zap, Send, Split } from 'lucide-react';

export default function WalletDashboard() {
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [showPaymentRequest, setShowPaymentRequest] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header with Quick Actions */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Wallet Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Manage your funds and assets</p>
          
          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setShowSplitBill(true)}
              className="gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
            >
              <Split className="w-4 h-4" />
              Split Bill
            </Button>
            <Button
              onClick={() => setShowPaymentRequest(true)}
              className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            >
              <Send className="w-4 h-4" />
              Request Payment
            </Button>
            <Button variant="outline" className="gap-2">
              <Zap className="w-4 h-4" />
              Quick Send
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="vault" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="vault">Vault</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* Vault Tab */}
          <TabsContent value="vault" className="space-y-6">
            <PersonalVaultSection />
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-6">
            <PortfolioOverview />
          </TabsContent>

          {/* Transaction History Tab */}
          <TabsContent value="history" className="space-y-6">
            <TransactionHistory />
          </TabsContent>

          {/* Advanced Features Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Advanced Features Info Cards */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">💰 Bill Splits</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Split expenses with friends and track who owes whom. Never lose track of shared payments again.
                </p>
                <Button onClick={() => setShowSplitBill(true)} variant="outline" className="w-full">
                  Create Split
                </Button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">📨 Request Payment</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Send payment requests to others. They'll receive a notification and can pay in one tap.
                </p>
                <Button onClick={() => setShowPaymentRequest(true)} variant="outline" className="w-full">
                  Send Request
                </Button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🔄 Recurring Payments</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Set up automatic recurring payments for subscriptions and regular bills.
                </p>
                <Button variant="outline" className="w-full">Coming Soon</Button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🎁 Payment Links</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Create shareable payment links. Perfect for invoices, donations, and collecting payments.
                </p>
                <Button variant="outline" className="w-full">Coming Soon</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      {showSplitBill && (
        <SplitBillModal onClose={() => setShowSplitBill(false)} />
      )}
      {showPaymentRequest && (
        <PaymentRequestModal onClose={() => setShowPaymentRequest(false)} />
      )}
    </div>
  );
}
