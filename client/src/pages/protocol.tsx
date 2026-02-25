import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Lock, Vote, Zap, Shield, TrendingUp, Users } from 'lucide-react';

export default function ProtocolPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            MTAA Protocol
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
            Decentralized community governance and finance infrastructure
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            A blockchain-based protocol enabling transparent, democratic management of community finances with smart contracts and collective decision-making.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-16">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-black text-blue-600 mb-2">100%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Transparent</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-black text-purple-600 mb-2">Decentralized</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">No single point of failure</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-black text-green-600 mb-2">Smart</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Contract enforced</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-black text-orange-600 mb-2">Multichain</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Cross-chain support</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Core Pillars */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-black mb-12 text-center">Core Pillars</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1: Governance */}
            <Card>
              <CardHeader>
                <Vote className="w-8 h-8 text-blue-600 mb-2" />
                <CardTitle>Democratic Governance</CardTitle>
                <CardDescription>Every member has a voice</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Members vote on all major decisions including:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>Budget allocation and spending</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>New member acceptance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>Investment decisions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">✓</span>
                    <span>Rule changes and penalties</span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 pt-4">
                  Voting power can be weighted by stake or equal across members
                </p>
              </CardContent>
            </Card>

            {/* Pillar 2: Transparency */}
            <Card>
              <CardHeader>
                <Shield className="w-8 h-8 text-green-600 mb-2" />
                <CardTitle>Full Transparency</CardTitle>
                <CardDescription>Immutable blockchain records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Every transaction is recorded and visible:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>All transactions on blockchain</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Cannot be altered or deleted</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Real-time member access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Complete audit trail</span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 pt-4">
                  No hidden transactions, no secret accounts
                </p>
              </CardContent>
            </Card>

            {/* Pillar 3: Security */}
            <Card>
              <CardHeader>
                <Lock className="w-8 h-8 text-purple-600 mb-2" />
                <CardTitle>Smart Contract Security</CardTitle>
                <CardDescription>Code-enforced rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Funds are protected by:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600">✓</span>
                    <span>Multi-signature requirements (3+ members)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600">✓</span>
                    <span>Time-locks on withdrawals</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600">✓</span>
                    <span>Role-based access control</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600">✓</span>
                    <span>Automatic fund freezing on fraud</span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 pt-4">
                  No single person can steal or move funds
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Technical Architecture */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-black mb-12 text-center">Technical Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Components */}
            <div>
              <h3 className="text-2xl font-bold mb-6">Core Components</h3>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Smart Contracts</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                    Self-executing code that manages treasury, voting, and distributions automatically
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Governance Module</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                    Enables voting on proposals with various voting mechanisms (majority, unanimous, weighted)
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Treasury Management</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                    Secure multi-signature control with automated distribution rules
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Member Registry</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                    On-chain member tracking with roles, permissions, and contribution history
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Features */}
            <div>
              <h3 className="text-2xl font-bold mb-6">Built-in Features</h3>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Multisig Wallets</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                    Require 2-of-3, 3-of-5, etc. signatures for any fund movement
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Time Locks</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                    Delays execution of critical functions (e.g., 48h before withdrawal)
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Automated Distributions</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                    Schedule recurring payments, bonuses, and dividends automatically
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Reputation System</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                    Track member contributions and voting participation on-chain
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Token Economics */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-black mb-12 text-center">Token Economics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <TrendingUp className="w-8 h-8 text-green-600 mb-2" />
                <CardTitle>Native Token Model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold">No MTAA Token (Yet)</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Currently uses USDC, cUSD, cEUR for stability
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Governance Shares</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Each DAO can issue voting shares to members
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Future: MTAA</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Planned protocol token for cross-DAO governance
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="w-8 h-8 text-yellow-600 mb-2" />
                <CardTitle>Fee Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold">Protocol Fees: 1-2%</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    On treasury withdrawals (configurable per DAO)
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Transaction Fees: Minimal</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Blockchain network fees only (~$0.01-0.10)
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Smart Contract Gas</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Optimized for low-cost operations
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="w-8 h-8 text-blue-600 mb-2" />
                <CardTitle>Revenue Model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold">Protocol Revenue</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    1-2% of all treasury withdrawals
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Premium Tiers</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Advanced features for larger DAOs
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Investment Pools</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Performance fees on managed assets
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Supported Blockchains */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-black mb-12 text-center">Supported Networks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Celo Mainnet', native: 'CELO', assets: 'cUSD, cEUR, cREAL' },
              { name: 'Ethereum', native: 'ETH', assets: 'USDC, DAI, USDT' },
              { name: 'Polygon', native: 'MATIC', assets: 'USDC, DAI, aUSDC' },
              { name: 'Arbitrum', native: 'ARB', assets: 'USDC.e, DAI, USDT' },
              { name: 'Optimism', native: 'OP', assets: 'USDC, DAI, USDT' },
              { name: 'Base', native: 'ETH', assets: 'USDC, cbETH' }
            ].map((chain) => (
              <Card key={chain.name}>
                <CardContent className="p-6">
                  <h3 className="font-bold mb-3">{chain.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-500">Native Asset</p>
                      <p className="font-semibold">{chain.native}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Supported Stables</p>
                      <p className="text-sm">{chain.assets}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-black mb-12 text-center">How the Protocol Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '1',
                title: 'Create DAO',
                description: 'Members pool resources and create smart contract'
              },
              {
                step: '2',
                title: 'Fund Treasury',
                description: 'Deposit crypto into multi-sig wallet'
              },
              {
                step: '3',
                title: 'Vote on Decisions',
                description: 'Members propose and vote on fund usage'
              },
              {
                step: '4',
                title: 'Execute Transactions',
                description: 'Smart contract enforces approved decisions automatically'
              }
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-full w-12 h-12 flex items-center justify-center text-2xl font-black mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-white/80 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Audits */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-black mb-12 text-center">Security & Audits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <Shield className="w-8 h-8 text-blue-600 mb-2" />
                <CardTitle>Security Measures</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Multi-signature requirements (2-of-3 minimum)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Time-locked operations (24-72 hours)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Role-based access control</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Emergency pause functions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Replay attack protection</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Lock className="w-8 h-8 text-green-600 mb-2" />
                <CardTitle>Compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>KYC/AML integration available</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>Regulatory framework compliant</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>Transaction monitoring</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>Audit trail for regulators</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>Regular security audits</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-black mb-6">Ready to Join the Revolution?</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Start your community DAO today with transparent governance, secure treasury management, and smart contract automation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/create-dao">
              <Button size="lg" className="gap-2">
                Create a DAO <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <a href="/daos">
              <Button size="lg" variant="outline">
                Explore Existing DAOs
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-black mb-12 text-center">Resources & Documentation</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Technical Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Deep dive into smart contracts, APIs, and integration guides.
                </p>
                <a href="/whitepaper.html" target="_blank" rel="noopener">
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    Read Whitepaper <ArrowRight className="w-3 h-3" />
                  </Button>
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Community & Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Join our community, ask questions, and get help.
                </p>
                <a href="/support">
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    Contact Support <ArrowRight className="w-3 h-3" />
                  </Button>
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blog & Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Latest news, tutorials, and protocol updates.
                </p>
                <a href="/blog">
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    Read Blog <ArrowRight className="w-3 h-3" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
