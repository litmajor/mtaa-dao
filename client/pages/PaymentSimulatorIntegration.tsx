/**
 * PaymentSimulatorIntegration Page
 * 
 * Complete integration showing all payment simulators and pending actions dashboard
 */

import React, { useState } from 'react';
import { PaymentDepositForm } from '../components/PaymentDepositForm';
import { PaymentWithdrawalForm } from '../components/PaymentWithdrawalForm';
import { PaymentP2PTransferForm } from '../components/PaymentP2PTransferForm';
import { RecurringPaymentForm } from '../components/RecurringPaymentForm';
import { PaymentSettlementForm } from '../components/PaymentSettlementForm';
import { PendingActionsDashboard } from '../components/PendingActionsDashboard';
import { ActionDetailModal } from '../components/ActionDetailModal';

type TabType = 'overview' | 'deposit' | 'withdraw' | 'p2p' | 'recurring' | 'settlement' | 'pending';

interface PaymentSimulatorIntegrationProps {
  userId?: string;
}

export const PaymentSimulatorIntegration: React.FC<PaymentSimulatorIntegrationProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showActionDetail, setShowActionDetail] = useState(false);

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'pending', label: '⏱️ Pending Actions', icon: '⏱️' },
    { id: 'deposit', label: '💰 Deposit', icon: '💰' },
    { id: 'withdraw', label: '💸 Withdraw', icon: '💸' },
    { id: 'p2p', label: '👥 P2P Transfer', icon: '👥' },
    { id: 'recurring', label: '⏰ Recurring', icon: '⏰' },
    { id: 'settlement', label: '📋 Settlement', icon: '📋' },
  ];

  const handleActionSuccess = (action: any) => {
    setCompletedActions(prev => [...prev, action.id]);
    // Switch to pending actions to show the new action
    setTimeout(() => {
      setActiveTab('pending');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold">💳 Payment Simulator Hub</h1>
          <p className="text-blue-100 mt-2">
            Full control over all payment operations with complete reversibility
          </p>
          {userId && (
            <p className="text-blue-200 text-sm mt-2">User: {userId}</p>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-[120px] z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex overflow-x-auto gap-2 py-4 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-6 py-3 rounded-t-lg font-semibold whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Welcome Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-8">
              <h2 className="text-2xl font-bold text-blue-900 mb-4">🎯 Welcome to Payment Simulator</h2>
              <p className="text-blue-800 mb-6">
                The Payment Simulator Hub gives you complete control over your financial transactions with 
                built-in reversibility. Every payment action is fully reversible within a grace period.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="bg-white rounded p-4 border border-blue-100">
                  <p className="text-lg font-bold text-blue-900">✅ 5 Payment Types</p>
                  <ul className="text-sm text-gray-700 mt-3 space-y-1">
                    <li>• Deposits (add funds to account)</li>
                    <li>• Withdrawals (remove funds)</li>
                    <li>• P2P Transfers (send to other users)</li>
                    <li>• Recurring Payments (subscriptions)</li>
                    <li>• Settlements (invoice payments)</li>
                  </ul>
                </div>

                <div className="bg-white rounded p-4 border border-green-100">
                  <p className="text-lg font-bold text-green-900">🔒 100% Reversible</p>
                  <ul className="text-sm text-gray-700 mt-3 space-y-1">
                    <li>• All actions fully reversible</li>
                    <li>• 24h-365d grace periods</li>
                    <li>• See before/after impact</li>
                    <li>• Transparent fee calculations</li>
                    <li>• Risk assessment included</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-3xl mb-3">📋</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Preview Before Commit</h3>
                <p className="text-gray-600 text-sm">
                  See exactly what will happen to your account before finalizing any transaction. 
                  No surprises, full transparency.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-3xl mb-3">⏮️</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Reverse Any Time</h3>
                <p className="text-gray-600 text-sm">
                  Accidentally sent to the wrong person? Made a mistake? Reverse any action 
                  within the grace period.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-3xl mb-3">⚠️</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Risk Detection</h3>
                <p className="text-gray-600 text-sm">
                  Automatic risk assessment identifies potential issues before they happen. 
                  Color-coded risk levels.
                </p>
              </div>
            </div>

            {/* Getting Started */}
            <div className="bg-white rounded-lg shadow p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">🚀 Getting Started</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { step: 1, action: 'Select Action', desc: 'Choose a payment type' },
                  { step: 2, action: 'Enter Details', desc: 'Amount, recipient, etc' },
                  { step: 3, action: 'Preview', desc: 'See before/after impact' },
                  { step: 4, action: 'Confirm', desc: 'Finalize the transaction' },
                  { step: 5, action: 'Monitor', desc: 'Reverse if needed' },
                ].map(item => (
                  <div key={item.step} className="text-center">
                    <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold mx-auto mb-2">
                      {item.step}
                    </div>
                    <p className="font-semibold text-gray-800">{item.action}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Card */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-900 mb-4">📊 Quick Stats</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{completedActions.length}</p>
                  <p className="text-xs text-green-700">Actions Today</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">5</p>
                  <p className="text-xs text-green-700">Payment Types</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">100%</p>
                  <p className="text-xs text-green-700">Reversible</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Actions Tab */}
        {activeTab === 'pending' && (
          <div>
            <PendingActionsDashboard
              onReverseSuccess={(actionId) => {
                // Refresh pending actions
              }}
            />
          </div>
        )}

        {/* Deposit Tab */}
        {activeTab === 'deposit' && (
          <PaymentDepositForm onSuccess={handleActionSuccess} />
        )}

        {/* Withdrawal Tab */}
        {activeTab === 'withdraw' && (
          <PaymentWithdrawalForm onSuccess={handleActionSuccess} />
        )}

        {/* P2P Transfer Tab */}
        {activeTab === 'p2p' && (
          <PaymentP2PTransferForm onSuccess={handleActionSuccess} />
        )}

        {/* Recurring Payment Tab */}
        {activeTab === 'recurring' && (
          <RecurringPaymentForm onSuccess={handleActionSuccess} />
        )}

        {/* Settlement Tab */}
        {activeTab === 'settlement' && (
          <PaymentSettlementForm onSuccess={handleActionSuccess} />
        )}
      </div>

      {/* Action Detail Modal */}
      <ActionDetailModal
        isOpen={showActionDetail}
        actionId={selectedActionId || undefined}
        onClose={() => setShowActionDetail(false)}
      />

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="text-white font-bold mb-4">Payment Simulator</h4>
              <p className="text-sm">
                Complete financial control with reversibility rights on all payment operations.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Security</h4>
              <ul className="text-sm space-y-2">
                <li>• End-to-end encrypted</li>
                <li>• Grade A+ security audit</li>
                <li>• FDIC-insured accounts</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Support</h4>
              <ul className="text-sm space-y-2">
                <li>• 24/7 customer support</li>
                <li>• Live chat available</li>
                <li>• Email: support@mtaa.com</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 text-center text-sm">
            <p>&copy; 2024 MTAA Payment System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
