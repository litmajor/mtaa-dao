import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Shield, Zap, Users, DollarSign, Globe } from "lucide-react";

export default function TransactionLimitsPage() {
  return (
    <div className="container mx-auto py-8 px-4" data-testid="transaction-limits-page">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-transaction-limits">Transaction Limits & Features</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Comprehensive guide to plan limits, transaction capabilities, and multi-chain support
          </p>
        </div>

        {/* Plan Comparison */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card data-testid="card-free-plan">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="title-free-plan">
                <Shield className="w-5 h-5 text-gray-600" />
                Free Plan
              </CardTitle>
              <CardDescription>Perfect for getting started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Membership Limits</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Maximum 1 DAO</li>
                  <li>• Up to 20 members per DAO</li>
                  <li>• 5 proposals per month</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Transaction Limits</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Standard processing speed</li>
                  <li>• Single-chain only (Ethereum)</li>
                  <li>• Basic transaction fees</li>
                  <li>• No priority support</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">AI & Features</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <li>• 10 AI queries per month</li>
                  <li>• Basic analytics</li>
                  <li>• Community chat</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-500" data-testid="card-premium-plan">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2" data-testid="title-premium-plan">
                  <Zap className="w-5 h-5 text-purple-600" />
                  Premium Plan
                </CardTitle>
                <Badge className="bg-purple-600" data-testid="badge-recommended">Recommended</Badge>
              </div>
              <CardDescription>For growing communities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Unlimited Access</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Unlimited DAOs</li>
                  <li>• Unlimited members</li>
                  <li>• Unlimited proposals</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Advanced Transactions</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Priority processing</li>
                  <li>• Multi-chain support</li>
                  <li>• Optimized gas fees</li>
                  <li>• 24/7 priority support</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Premium Features</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Unlimited AI assistance</li>
                  <li>• Advanced analytics</li>
                  <li>• Investment pools & NFTs</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Multi-Chain Support */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600" />
              Multi-Chain Support (Premium Only)
            </CardTitle>
            <CardDescription>
              Hold and manage assets across multiple blockchain networks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Supported Chains</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Badge variant="outline">ETH</Badge>
                    Ethereum Mainnet
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline">BSC</Badge>
                    Binance Smart Chain
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline">MATIC</Badge>
                    Polygon
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline">ARB</Badge>
                    Arbitrum
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Features</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li>• View balances across all chains</li>
                  <li>• Wallet addresses visible to users</li>
                  <li>• Treasury visible to community</li>
                  <li>• Cross-chain asset management</li>
                  <li>• Multi-chain vaults</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Transaction Visibility</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li>• All wallet addresses public</li>
                  <li>• Real-time balance updates</li>
                  <li>• Transaction history per chain</li>
                  <li>• Gas fee optimization</li>
                  <li>• Community transparency</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DAO Lifecycle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              DAO Lifecycle & Management
            </CardTitle>
            <CardDescription>
              How DAOs are created, managed, and dissolved
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                DAO Deletion Policy
              </h4>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm mb-2">
                  <strong>DAOs cannot be permanently deleted.</strong> This ensures:
                </p>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Preservation of transaction history</li>
                  <li>• Community member protection</li>
                  <li>• Financial transparency and accountability</li>
                  <li>• Legal compliance requirements</li>
                </ul>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Who Can Dissolve a DAO?</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">Admin/Elder</Badge>
                  <span>Can initiate dissolution proposal (requires 75% member approval)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">Platform</Badge>
                  <span>Can suspend DAOs violating terms (fraud, illegal activity)</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Dissolution Process</h4>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <Badge className="bg-purple-600">1</Badge>
                  <div>
                    <strong>Proposal Creation</strong> - Admin creates dissolution proposal
                  </div>
                </li>
                <li className="flex gap-3">
                  <Badge className="bg-purple-600">2</Badge>
                  <div>
                    <strong>Member Vote</strong> - Requires 75% approval from active members
                  </div>
                </li>
                <li className="flex gap-3">
                  <Badge className="bg-purple-600">3</Badge>
                  <div>
                    <strong>Treasury Distribution</strong> - Assets distributed according to proposal terms
                  </div>
                </li>
                <li className="flex gap-3">
                  <Badge className="bg-purple-600">4</Badge>
                  <div>
                    <strong>DAO Archive</strong> - DAO marked as "Dissolved" but history preserved
                  </div>
                </li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold mb-3">What Happens During Dissolution?</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-2">✓ Preserved</p>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <li>• Transaction history</li>
                    <li>• Proposal records</li>
                    <li>• Member contributions</li>
                    <li>• Voting records</li>
                    <li>• Financial reports</li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-600 mb-2">✗ Disabled</p>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <li>• New proposals</li>
                    <li>• New member joins</li>
                    <li>• Treasury operations</li>
                    <li>• Voting on new issues</li>
                    <li>• Asset transfers</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
