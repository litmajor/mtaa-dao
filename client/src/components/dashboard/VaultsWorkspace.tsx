import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Shield, Wallet, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { VaultCreationWizard } from '../vault/VaultCreationWizard';

export default function VaultsWorkspace() {
  const [vaults, setVaults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadVaults = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/wallets/vaults', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setVaults(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load vaults', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVaults();
  }, []);

  const handleVaultCreated = (vaultId: string) => {
    setShowWizard(false);
    loadVaults(); // Refresh the list
  };

  const getVaultIcon = (type: string) => {
    switch (type) {
      case 'savings': 
      case 'locked_savings': return <Shield className="h-5 w-5 text-purple-400" />;
      case 'yield': return <TrendingUp className="h-5 w-5 text-green-400" />;
      default: return <Wallet className="h-5 w-5 text-blue-400" />;
    }
  };

  const formatCurrency = (amount: string, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'cUSD' ? 'USD' : currency === 'cEUR' ? 'EUR' : currency,
      minimumFractionDigits: 2,
    }).format(parseFloat(amount || '0'));
  };

  if (showWizard) {
    return (
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => setShowWizard(false)} className="mb-4 text-slate-400 hover:text-white">
          ← Back to Vaults
        </Button>
        <VaultCreationWizard onClose={() => setShowWizard(false)} onSuccess={handleVaultCreated} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-purple-400" />
            My Vaults
          </h2>
          <p className="text-slate-400">Manage your personal savings, locked funds, and yield strategies.</p>
        </div>
        <Button 
          onClick={() => {
            if (vaults.length >= 3) {
              setErrorMsg('You have reached the maximum limit of 3 personal vaults on the Free tier.');
              return;
            }
            setShowWizard(true);
          }} 
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Vault
        </Button>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading your vaults...</div>
      ) : vaults.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No Vaults Yet</h3>
            <p className="text-slate-400 text-center max-w-md mb-6">
              Create a vault to lock your savings, earn yield, or manage personal funds separately from your main wallet.
            </p>
            <Button onClick={() => setShowWizard(true)} className="bg-purple-600 hover:bg-purple-700">
              Create Your First Vault
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vaults.map((vault) => (
            <Card key={vault.id} className="bg-slate-800 border-slate-700 hover:border-purple-500/50 transition-colors cursor-pointer" onClick={() => window.location.href=`/vault/${vault.id}`}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-white flex items-center gap-2 mb-1">
                    {getVaultIcon(vault.vaultType)}
                    {vault.name}
                  </CardTitle>
                  <CardDescription className="capitalize">
                    {vault.vaultType.replace('_', ' ')}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mt-4">
                  <p className="text-sm text-slate-400 mb-1">Total Balance</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(vault.balance, vault.currency)}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                  <span>Created {formatDistanceToNow(new Date(vault.createdAt), { addSuffix: true })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
