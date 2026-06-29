import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api';
import { ArrowUpRight, ArrowDownLeft, Shield, Link2, Repeat, Gift, Activity, CreditCard } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PaymentsWorkspace() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTransactions() {
      try {
        const res = await fetch('/api/v1/wallets/transactions', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setTransactions(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to load transactions', err);
      } finally {
        setLoading(false);
      }
    }
    loadTransactions();
  }, []);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="h-4 w-4 text-emerald-400" />;
      case 'withdrawal': return <ArrowUpRight className="h-4 w-4 text-red-400" />;
      case 'transfer': return <Activity className="h-4 w-4 text-blue-400" />;
      case 'escrow_deposit': return <Shield className="h-4 w-4 text-amber-400" />;
      case 'payment_link': return <Link2 className="h-4 w-4 text-purple-400" />;
      case 'recurring': return <Repeat className="h-4 w-4 text-cyan-400" />;
      case 'voucher': return <Gift className="h-4 w-4 text-pink-400" />;
      default: return <CreditCard className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-emerald-400" />
          Wallet Tools & Payments
        </h2>
        <p className="text-slate-400">Manage your active escrows, subscriptions, and comprehensive transaction history.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tool Cards */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" />
              Escrows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">Secure P2P payments</p>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Repeat className="h-4 w-4 text-cyan-400" />
              Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">Manage recurring payments</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-purple-400" />
              Payment Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">Shareable crypto links</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Gift className="h-4 w-4 text-pink-400" />
              Gift Vouchers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400">Create redeemable vouchers</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Transaction History</CardTitle>
          <CardDescription>Comprehensive record of all your deposits, transfers, and withdrawals.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-400">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
              <Activity className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p>No transaction history found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded-lg">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{tx.type.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-400">
                        {tx.description || tx.metadata?.description || 'Wallet transaction'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${tx.type === 'deposit' || tx.type === 'escrow_release' ? 'text-emerald-400' : 'text-white'}`}>
                      {tx.type === 'deposit' ? '+' : ''}{tx.amount} {tx.currency || 'cUSD'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {tx.createdAt ? formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true }) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
