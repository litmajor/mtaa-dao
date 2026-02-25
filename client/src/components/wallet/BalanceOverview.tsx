/**
 * BalanceOverview Component
 * Individual account balance card
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ReactNode } from 'react';

interface WalletAccount {
  id: string;
  accountType: 'wallet' | 'trading' | 'vault' | 'escrow';
  balance: string;
  currency: string;
  status: string;
}

interface BalanceOverviewProps {
  account: WalletAccount;
  icon: ReactNode;
  color: string;
}

export default function BalanceOverview({ account, icon, color }: BalanceOverviewProps) {
  const getAccountLabel = (type: string) => {
    switch (type) {
      case 'wallet':
        return 'Primary Wallet';
      case 'trading':
        return 'Trading Account';
      case 'vault':
        return 'Vault (Locked)';
      case 'escrow':
        return 'Escrow';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'frozen':
        return 'text-red-400';
      case 'pending':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <Card className={`bg-gradient-to-br ${color} border-0 hover:shadow-lg transition-shadow`}>
      <CardContent className="pt-6">
        {/* Icon */}
        <div className="mb-3 text-white opacity-80">{icon}</div>

        {/* Account Type */}
        <div className="text-sm text-gray-200 mb-1">{getAccountLabel(account.accountType)}</div>

        {/* Balance */}
        <div className="text-2xl font-bold text-white mb-3">
          {parseFloat(account.balance).toFixed(2)}
        </div>

        {/* Currency and Status */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-300">{account.currency}</span>
          <span className={`capitalize font-semibold ${getStatusColor(account.status)}`}>
            {account.status}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
