
import React, { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, Wallet, TrendingUp } from 'lucide-react';

export default function VaultSuccess() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1]);
  const vaultId = params.get('vaultId');
  const vaultName = params.get('name') || 'Your Vault';

  useEffect(() => {
    // Confetti animation or celebration effect
    const timer = setTimeout(() => {
      // Auto redirect after 5 seconds
      window.location.href = '/vault-overview';
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-white/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900">
            Vault Created Successfully! 🎉
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-lg text-gray-600 mb-2">
              <strong>{vaultName}</strong> is now ready to use!
            </p>
            <p className="text-gray-500">
              You can now deposit funds, allocate to strategies, and start earning yields.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <Wallet className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold mb-2">Next Steps</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Deposit your first funds</li>
                  <li>• Set up yield strategies</li>
                  <li>• Configure auto-compound</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-6">
                <TrendingUp className="w-8 h-8 text-purple-600 mb-3" />
                <h3 className="font-semibold mb-2">Features Available</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Real-time performance tracking</li>
                  <li>• Multi-asset support</li>
                  <li>• Risk assessment tools</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3 justify-center pt-4">
            <Link to={`/vault/${vaultId}`}>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                Go to Vault
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/vault-overview">
              <Button variant="outline">
                View All Vaults
              </Button>
            </Link>
          </div>

          <p className="text-center text-sm text-gray-500">
            Redirecting to vault overview in 5 seconds...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
