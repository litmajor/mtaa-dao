
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Wallet, Shield, Sparkles, CheckCircle, Zap, QrCode, ArrowRight } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import SecureWalletManager from './SecureWalletManager';

interface WalletConnectionManagerProps {
  userId?: string;
  onConnect?: (address: string, provider: string) => void;
}

export default function WalletConnectionManager({ userId, onConnect }: WalletConnectionManagerProps) {
  const [step, setStep] = useState<'choice' | 'connect' | 'create'>('choice');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const connectMetaMask = async () => {
    setConnecting(true);
    setError('');
    try {
      if (!window.ethereum) {
        window.open('https://metamask.io/download/', '_blank');
        throw new Error('MetaMask not installed. Opening installation page...');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        // Switch to Celo
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaef3' }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xaef3',
                chainName: 'Celo Mainnet',
                nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
                rpcUrls: ['https://forno.celo.org'],
                blockExplorerUrls: ['https://explorer.celo.org']
              }]
            });
          }
        }

        toast({ title: 'Connected!', description: 'MetaMask wallet connected successfully' });
        onConnect?.(accounts[0], 'metamask');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const connectValora = async () => {
    setConnecting(true);
    setError('');
    try {
      if (window.ethereum && (window.ethereum as any).isValora) {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        
        if (accounts.length > 0) {
          toast({ title: 'Connected!', description: 'Valora wallet connected successfully' });
          onConnect?.(accounts[0], 'valora');
        }
      } else {
        const dappUrl = window.location.origin;
        const dappName = 'MtaaDAO';
        const valoraDeepLink = `celo://wallet/dapp?url=${encodeURIComponent(dappUrl)}&name=${encodeURIComponent(dappName)}`;
        
        if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
          window.location.href = valoraDeepLink;
        } else {
          throw new Error('Please use Valora mobile app or install Valora extension');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const connectMiniPay = async () => {
    setConnecting(true);
    setError('');
    try {
      if (window.ethereum && (window.ethereum as any).isMiniPay) {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });

        if (accounts.length > 0) {
          toast({ title: 'Connected!', description: 'MiniPay wallet connected successfully' });
          onConnect?.(accounts[0], 'minipay');
        }
      } else {
        throw new Error('Please use Opera Mini browser with MiniPay');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  if (step === 'create') {
    return <SecureWalletManager userId={userId || ''} onWalletCreated={(data) => {
      toast({ title: 'Success!', description: 'Wallet created successfully' });
      onConnect?.(data.wallet.address, 'mtaadao');
    }} />;
  }

  if (step === 'connect') {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-2xl">
            <Wallet className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Connect Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Choose your preferred wallet provider
          </p>
        </div>

        <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 shadow-2xl border-0">
          <CardContent className="space-y-4 px-8 py-8">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={connectMetaMask}
              disabled={connecting}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
            >
              <Wallet className="h-5 w-5 mr-3" />
              {connecting ? 'Connecting...' : 'MetaMask'}
            </Button>

            <Button
              onClick={connectValora}
              disabled={connecting}
              className="w-full border-2 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-800 dark:text-gray-200 font-semibold py-6 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
              variant="outline"
            >
              <Shield className="h-5 w-5 mr-3" />
              {connecting ? 'Connecting...' : 'Valora'}
            </Button>

            <Button
              onClick={connectMiniPay}
              disabled={connecting}
              className="w-full border-2 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-800 dark:text-gray-200 font-semibold py-6 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
              variant="outline"
            >
              <Sparkles className="h-5 w-5 mr-3" />
              {connecting ? 'Connecting...' : 'MiniPay'}
            </Button>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => setStep('choice')}
                variant="ghost"
                className="w-full"
              >
                ← Back to Options
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-2xl">
          <Wallet className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          MtaaDAO Wallet
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          Your gateway to decentralized finance
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 shadow-xl border-0 hover:shadow-2xl transition-all">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Create New Wallet</CardTitle>
            <CardDescription className="text-base mt-2">
              Create a secure wallet with recovery phrase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Fully encrypted and secure</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">12 or 24 word recovery phrase</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Full control of your funds</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Export private key anytime</span>
              </div>
            </div>
            <Button
              onClick={() => setStep('create')}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
            >
              Create Wallet
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 shadow-xl border-0 hover:shadow-2xl transition-all">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
              <QrCode className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Connect Existing</CardTitle>
            <CardDescription className="text-base mt-2">
              Use MetaMask, Valora, or MiniPay
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Connect instantly</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Multiple wallet support</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Secure connection</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Celo network ready</span>
              </div>
            </div>
            <Button
              onClick={() => setStep('connect')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
            >
              Connect Wallet
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Security First</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your wallet keys are encrypted and stored securely. We never have access to your private keys or funds.
              Make sure to backup your recovery phrase and keep it safe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
