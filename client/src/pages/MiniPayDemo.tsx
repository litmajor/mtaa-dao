
import React, { useState } from 'react';
import MiniPayIntegration from '../components/MiniPayIntegration';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { CheckCircle, Smartphone, Zap, Shield, Globe } from 'lucide-react';

export default function MiniPayDemo() {
  const [lastPayment, setLastPayment] = useState<{
    txHash: string;
    amount: string;
    currency: string;
  } | null>(null);

  const handlePaymentSuccess = (txHash: string, amount: string, currency: string) => {
    setLastPayment({ txHash, amount, currency });
    console.log('Payment successful:', { txHash, amount, currency });
  };

  const handleError = (error: string) => {
    console.error('Payment error:', error);
    alert(`Payment Error: ${error}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-green-50 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Smartphone className="h-8 w-8 text-yellow-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-green-600 bg-clip-text text-transparent">
              MiniPay Integration
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Seamless mobile payments on the Celo blockchain. Fast, secure, and built for everyone.
          </p>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 px-4 py-2">
            Powered by Celo Blockchain
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* MiniPay Integration Component */}
          <div>
            <MiniPayIntegration 
              onPaymentSuccess={handlePaymentSuccess}
              onError={handleError}
            />
          </div>

          {/* Information Cards */}
          <div className="space-y-4">
            {/* Last Payment */}
            {lastPayment && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    Payment Successful!
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Amount:</span> {lastPayment.amount} {lastPayment.currency}
                  </div>
                  <div className="text-sm break-all">
                    <span className="font-medium">Transaction:</span> {lastPayment.txHash}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Why MiniPay?
                </CardTitle>
                <CardDescription>
                  Built for mobile-first payments in emerging markets
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Secure & Fast</div>
                      <div className="text-sm text-gray-600">Military-grade encryption with instant transactions</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Globe className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Global Reach</div>
                      <div className="text-sm text-gray-600">Send money anywhere in the world with minimal fees</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Smartphone className="h-5 w-5 text-purple-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Mobile First</div>
                      <div className="text-sm text-gray-600">Designed specifically for smartphone users</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Supported Currencies */}
            <Card>
              <CardHeader>
                <CardTitle>Supported Currencies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-green-50 border-green-200 text-green-800">
                    cUSD (Celo Dollar)
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800">
                    CELO
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  More currencies coming soon including cEUR and cREAL
                </p>
              </CardContent>
            </Card>

            {/* Developer Info */}
            <Card>
              <CardHeader>
                <CardTitle>For Developers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Network:</span> Celo Mainnet</div>
                  <div><span className="font-medium">Gas Token:</span> CELO</div>
                  <div><span className="font-medium">Stable Coin:</span> cUSD</div>
                  <div><span className="font-medium">Average Fee:</span> ~$0.01</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
