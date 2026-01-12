import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Shuffle3 } from 'lucide-react';

export default function CrossChainHub() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Cross-Chain Hub</h1>
        <p className="text-gray-600 text-lg">Move your assets across different blockchains</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bridge Card */}
        <Link to="/cross-chain/bridge">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ArrowRight className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Bridge</CardTitle>
              </div>
              <CardDescription>Transfer tokens across chains</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">Move tokens between blockchains</p>
                  <p className="text-gray-600 mt-1">Transfer your CELO from Celo to Ethereum, Polygon, or any supported chain without converting</p>
                </div>
                <div className="border-t pt-3">
                  <p className="font-semibold text-gray-900 mb-1">Perfect for:</p>
                  <ul className="text-gray-600 space-y-1 text-xs">
                    <li>✓ Moving tokens to access different opportunities</li>
                    <li>✓ Consolidating assets on preferred chains</li>
                    <li>✓ Using tokens across multiple blockchains</li>
                  </ul>
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded text-sm text-blue-900">
                <p className="font-semibold mb-1">⏱️ Typical time: 10-30 minutes</p>
                <p className="text-xs">Your token amount stays the same</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Swap Card */}
        <Link to="/cross-chain/swap">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shuffle3 className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Swap</CardTitle>
              </div>
              <CardDescription>Convert and transfer in one step</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">Convert and send to another chain</p>
                  <p className="text-gray-600 mt-1">Transform your CELO into ETH, USDC, or any token and send it to another blockchain in one transaction</p>
                </div>
                <div className="border-t pt-3">
                  <p className="font-semibold text-gray-900 mb-1">Perfect for:</p>
                  <ul className="text-gray-600 space-y-1 text-xs">
                    <li>✓ Converting between different token types</li>
                    <li>✓ Accessing tokens not available on your chain</li>
                    <li>✓ All-in-one conversion and transfer</li>
                  </ul>
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded text-sm text-green-900">
                <p className="font-semibold mb-1">⏱️ Typical time: 15-45 minutes</p>
                <p className="text-xs">Includes token conversion and bridge time</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Supported Chains */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Supported Networks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['Celo', 'Ethereum', 'Polygon', 'Optimism', 'Arbitrum', 'BNB Chain', 'TRON', 'TON'].map((chain) => (
              <div key={chain} className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm font-medium">{chain}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Quick Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-semibold text-sm mb-1">❓ Which should I use?</p>
            <p className="text-sm text-gray-600">Use Bridge if you want to keep the same token. Use Swap if you want to change token types.</p>
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">💰 How much does it cost?</p>
            <p className="text-sm text-gray-600">Both use similar fees: bridge fee + gas fees. Bridge is typically cheaper since there's no swap involved.</p>
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">⚠️ What about slippage?</p>
            <p className="text-sm text-gray-600">Only Swap is affected by slippage. We automatically apply 1% slippage tolerance to protect you.</p>
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">🔐 Is it safe?</p>
            <p className="text-sm text-gray-600">Yes! Both Bridge and Swap use secure cross-chain protocols. Your funds are protected throughout the transfer.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
