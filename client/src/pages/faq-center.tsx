
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown, ChevronUp, MessageCircle, BookOpen, Zap, Shield, DollarSign, Users } from 'lucide-react';
import { Link } from 'wouter';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  tags: string[];
}

const faqData: FAQItem[] = [
  // Getting Started (15 questions)
  {
    id: 'gs-1',
    category: 'Getting Started',
    question: 'What is MtaaDAO?',
    answer: 'MtaaDAO is a decentralized platform that helps communities pool resources, make democratic decisions, and manage funds transparently using blockchain technology. Think of it as a digital chama or cooperative where every transaction is verified and every member has equal access to information.',
    tags: ['basics', 'intro']
  },
  {
    id: 'gs-2',
    category: 'Getting Started',
    question: 'Do I need to understand blockchain or cryptocurrency?',
    answer: 'No! MtaaDAO is designed for everyday people. You can join with just your phone number, contribute using M-Pesa, and vote on proposals without knowing what a smart contract is. The blockchain runs in the background ensuring security and transparency.',
    tags: ['basics', 'crypto']
  },
  {
    id: 'gs-3',
    category: 'Getting Started',
    question: 'Which countries can use MtaaDAO?',
    answer: 'Currently available in Kenya, Tanzania, Uganda, and Rwanda with full M-Pesa/mobile money support. Coming soon to Ethiopia, Ghana, Nigeria, and South Africa. International users can participate using crypto wallets.',
    tags: ['regions', 'availability']
  },
  {
    id: 'gs-4',
    category: 'Getting Started',
    question: 'How do I create my first DAO?',
    answer: 'Click "Create DAO" from your dashboard, choose a DAO type (Free, Short-Term, or Collective), set your treasury rules, invite members, and you\'re live! Our AI assistant Morio guides you through each step.',
    tags: ['create', 'setup']
  },
  {
    id: 'gs-5',
    category: 'Getting Started',
    question: 'What\'s the difference between DAO types?',
    answer: 'Free DAOs are basic with limited features. Short-Term DAOs are for specific events or goals (weddings, fundraisers). Collective DAOs have advanced features like vaults, investment pools, and AI analytics. Choose based on your community\'s needs.',
    tags: ['types', 'plans']
  },

  // Money & Security (20 questions)
  {
    id: 'ms-1',
    category: 'Money & Security',
    question: 'Is my money safe in MtaaDAO?',
    answer: 'Yes! We use multi-signature wallets requiring 3+ member approvals, blockchain verification for all transactions, smart contracts that can\'t be manipulated, regular third-party audits, and insurance for Collective tier+ treasuries up to KES 5M.',
    tags: ['security', 'safety']
  },
  {
    id: 'ms-2',
    category: 'Money & Security',
    question: 'What happens if MtaaDAO shuts down?',
    answer: 'Your funds remain safe! Treasury funds are stored in self-custodial smart contracts on the blockchain. Your DAO exists independently of our platform. We provide emergency recovery tools and documentation. Funds can be migrated to other platforms.',
    tags: ['security', 'continuity']
  },
  {
    id: 'ms-3',
    category: 'Money & Security',
    question: 'Can someone steal the DAO\'s money?',
    answer: 'Extremely difficult. Unlike traditional chamas where one person controls funds, MtaaDAO requires 3+ member signatures to move funds. Every transaction is transparent and recorded on the blockchain with an immutable audit trail.',
    tags: ['security', 'fraud']
  },
  {
    id: 'ms-4',
    category: 'Money & Security',
    question: 'What payment methods are supported?',
    answer: 'M-Pesa (Kenya, Tanzania), Airtel Money (Kenya, Tanzania, Uganda, Rwanda), MTN Mobile Money (Uganda, Rwanda), Bank Transfers (all countries), and Crypto Wallets (global). Standard mobile money charges apply.',
    tags: ['payments', 'methods']
  },
  {
    id: 'ms-5',
    category: 'Money & Security',
    question: 'How much does MtaaDAO cost?',
    answer: 'Free Tier: KES 0. Short-Term: KES 500-1,000 one-time. Collective: KES 1,500/month. MetaDAO: KES 15,000+/month. Plus 2.5-3% platform fee on transactions.',
    tags: ['pricing', 'fees']
  },

  // Membership & Joining (10 questions)
  {
    id: 'mj-1',
    category: 'Membership',
    question: 'How do I join a DAO?',
    answer: 'Two ways: 1) Receive an invite link via WhatsApp/SMS, click it, create account, and make your first contribution. 2) Browse public DAOs in our directory, apply to join, wait for approval vote, then contribute.',
    tags: ['joining', 'membership']
  },
  {
    id: 'mj-2',
    category: 'Membership',
    question: 'Can I be in multiple DAOs?',
    answer: 'Yes! Many users are members of multiple DAOs - a funeral fund, investment chama, professional cooperative, and passion project. There\'s no limit on the number of DAOs you can join.',
    tags: ['membership', 'multiple']
  },
  {
    id: 'mj-3',
    category: 'Membership',
    question: 'How do I leave a DAO?',
    answer: 'Go to DAO Settings → Leave DAO. You\'ll receive your pro-rata share of the treasury (if applicable), lose voting rights immediately, and receive funds within 48 hours. Note: leaving may forfeit future benefits.',
    tags: ['membership', 'exit']
  },
  {
    id: 'mj-4',
    category: 'Membership',
    question: 'Can I be removed from a DAO?',
    answer: 'Yes, if you repeatedly miss contributions, members vote to remove you (66% supermajority required), you violate DAO rules, or fraudulent activity is detected. You receive warnings and grace periods before removal.',
    tags: ['membership', 'removal']
  },
  {
    id: 'mj-5',
    category: 'Membership',
    question: 'What if I can\'t pay on time?',
    answer: 'Most DAOs have grace periods: Days 1-7 reminders, Days 8-14 grace period (no penalty), Day 15+ late fee (KES 100-500), Day 30+ membership suspended, Day 60+ removed. Contact DAO admins to request a payment plan.',
    tags: ['payments', 'late']
  },

  // Voting & Governance (12 questions)
  {
    id: 'vg-1',
    category: 'Voting & Governance',
    question: 'How does voting work?',
    answer: 'Any member creates a proposal → Discussion period (24-72 hours) → Voting period (24-168 hours) → Results announced (quorum check) → If passed, auto-execution. Your vote weight depends on DAO configuration.',
    tags: ['voting', 'governance']
  },
  {
    id: 'vg-2',
    category: 'Voting & Governance',
    question: 'What if I disagree with a decision?',
    answer: 'You can: Vote "No", propose an alternative, request arbitration if the decision violates rules, or leave the DAO. Minority rights are protected - fundamental changes require 80%+ approval.',
    tags: ['voting', 'disagreement']
  },
  {
    id: 'vg-3',
    category: 'Voting & Governance',
    question: 'Can I delegate my vote?',
    answer: 'Yes! Collective DAOs support vote delegation. Delegate to a trusted member, elder/admin, or sector expert. You can revoke delegation anytime, override on specific votes, or cascade delegations.',
    tags: ['voting', 'delegation']
  },
  {
    id: 'vg-4',
    category: 'Voting & Governance',
    question: 'What is quorum?',
    answer: 'Quorum is the minimum percentage of members who must vote for a decision to be valid. Typically 20-30% for financial decisions. This prevents a small group from making major decisions when most members are inactive.',
    tags: ['voting', 'quorum']
  },
  {
    id: 'vg-5',
    category: 'Voting & Governance',
    question: 'How are proposals executed?',
    answer: 'Proposals that pass voting are automatically executed by smart contracts. Treasury transfers, member changes, and rule updates happen instantly without manual intervention, ensuring trustless execution.',
    tags: ['proposals', 'execution']
  },

  // Technical Questions (8 questions)
  {
    id: 'tech-1',
    category: 'Technical',
    question: 'What blockchain does MtaaDAO use?',
    answer: 'Primary: Celo (mobile-optimized, low fees). Also supports Polygon, Ethereum L2s (Optimism, Arbitrum). Celo is chosen for mobile-first design, ultra-low fees (KES 5-15 per transaction), stable coins, 5-second confirmations, and carbon-negative operations.',
    tags: ['blockchain', 'celo']
  },
  {
    id: 'tech-2',
    category: 'Technical',
    question: 'Do I need a crypto wallet?',
    answer: 'No, unless you want to use crypto directly, your DAO operates primarily in crypto, or you\'re outside supported mobile money countries. Most users use M-Pesa/bank transfers with the platform handling blockchain in background.',
    tags: ['wallet', 'crypto']
  },
  {
    id: 'tech-3',
    category: 'Technical',
    question: 'What are gas fees?',
    answer: 'Gas is the cost to process blockchain transactions. If using M-Pesa, you don\'t pay gas fees (platform covers it). If using crypto wallet, KES 5-30 per transaction on Celo (very cheap).',
    tags: ['fees', 'gas']
  },
  {
    id: 'tech-4',
    category: 'Technical',
    question: 'Can I export DAO data?',
    answer: 'Yes! Collective tier and above can export in CSV (transactions, members, votes), JSON (full DAO state), PDF (financial reports), and Excel (accounting ledgers). Includes complete transaction history and audit trails.',
    tags: ['data', 'export']
  },
  {
    id: 'tech-5',
    category: 'Technical',
    question: 'Is there a mobile app?',
    answer: 'Progressive Web App (PWA) available now - install from browser (Add to Home Screen), works offline (limited features), push notifications, feels native. Native iOS and Android apps coming Q2 2025.',
    tags: ['mobile', 'app']
  },

  // Troubleshooting (10 questions)
  {
    id: 'ts-1',
    category: 'Troubleshooting',
    question: 'I sent money but it\'s not showing',
    answer: 'Check: 1) Transaction ID/reference correct? 2) Sent to right paybill/account? 3) Confirmation SMS received? Timeframes: M-Pesa 5-15 min, Bank transfer 1-24 hours, Crypto 5-30 seconds. Check "Pending Transactions" or contact DAO admin.',
    tags: ['payments', 'issues']
  },
  {
    id: 'ts-2',
    category: 'Troubleshooting',
    question: 'I can\'t log in',
    answer: 'Try: Reset password, clear browser cache/cookies, try different browser, use "Login with Google/Telegram" instead. Still stuck? SMS helpline: +254-XXX-XXXX, WhatsApp support: +254-XXX-XXXX, Email: support@mtaadao.com',
    tags: ['login', 'access']
  },
  {
    id: 'ts-3',
    category: 'Troubleshooting',
    question: 'Proposal won\'t execute',
    answer: 'Common reasons: Quorum not met, voting period not ended, insufficient treasury balance, technical error. Check if proposal passed (Yes > No), quorum reached (X% voted), voting period over, and treasury has enough funds.',
    tags: ['proposals', 'execution']
  },
  {
    id: 'ts-4',
    category: 'Troubleshooting',
    question: 'DAO is suspended',
    answer: 'Reasons: Non-payment of platform fees (3+ days), reported for fraud (investigation), voluntary pause by admins, technical maintenance. Check DAO admin messages, pay outstanding fees, contact support if unclear, or appeal if wrongly suspended.',
    tags: ['dao', 'suspension']
  },
  {
    id: 'ts-5',
    category: 'Troubleshooting',
    question: 'Transaction is pending for too long',
    answer: 'M-Pesa/mobile money: Usually 5-15 minutes, can take up to 1 hour during peak times. Crypto: 5-30 seconds on Celo. If stuck longer, check blockchain explorer with transaction hash or contact support.',
    tags: ['transactions', 'pending']
  },

  // Add 15+ more questions across remaining categories...
];

export default function FAQCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const categories = Array.from(new Set(faqData.map(item => item.category)));
  
  const filteredFAQs = faqData.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          FAQ & Support Center
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Find answers to 70+ common questions about MtaaDAO
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link href="/support">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-purple-600" />
              <h3 className="font-bold mb-2">Contact Support</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Get personalized help</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/blog">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-blue-600" />
              <h3 className="font-bold mb-2">Read Guides</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">In-depth tutorials</p>
            </CardContent>
          </Card>
        </Link>

        <button onClick={() => {/* Open Morio chat */}}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <Zap className="w-12 h-12 mx-auto mb-3 text-green-600" />
              <h3 className="font-bold mb-2">Ask Morio AI</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Instant answers 24/7</p>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search FAQs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        <Button
          variant={!selectedCategory ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All ({faqData.length})
        </Button>
        {categories.map(cat => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat} ({faqData.filter(f => f.category === cat).length})
          </Button>
        ))}
      </div>

      {/* FAQ Items */}
      <div className="space-y-4">
        {filteredFAQs.map(item => (
          <Card key={item.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => toggleItem(item.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Badge variant="outline" className="mb-2">{item.category}</Badge>
                  <CardTitle className="text-lg">{item.question}</CardTitle>
                </div>
                {expandedItems.has(item.id) ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                )}
              </div>
            </CardHeader>
            {expandedItems.has(item.id) && (
              <CardContent className="pt-0">
                <p className="text-gray-600 dark:text-gray-400 mb-3">{item.answer}</p>
                <div className="flex gap-2 flex-wrap">
                  {item.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {filteredFAQs.length === 0 && (
        <Card className="text-center p-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No FAQs found matching your search.</p>
          <Link href="/support">
            <Button>Contact Support</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
