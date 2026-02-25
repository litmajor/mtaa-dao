import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const features = [
  {
    id: 'governance',
    name: 'Governance',
    category: 'Core',
    status: 'live',
    description: 'Democratic decision-making with transparent voting',
    features: [
      'Proposal creation and voting',
      'Multiple voting mechanisms',
      'Timed voting periods',
      'Quorum requirements'
    ],
    icon: '🗳️',
    color: 'from-blue-400 to-blue-600'
  },
  {
    id: 'treasury',
    name: 'Treasury Management',
    category: 'Financial',
    status: 'live',
    description: 'Transparent fund management and allocation',
    features: [
      'Multi-signature approvals',
      'Expense tracking',
      'Budget planning',
      'Payment scheduling'
    ],
    icon: '💰',
    color: 'from-green-400 to-green-600'
  },
  {
    id: 'defi',
    name: 'DeFi Integration',
    category: 'Financial',
    status: 'live',
    description: 'Earn yield and access financial markets',
    features: [
      'Lending & borrowing',
      'Yield farming',
      'Token swaps',
      'Liquidity pools'
    ],
    icon: '📈',
    color: 'from-purple-400 to-purple-600'
  },
  {
    id: 'accounts',
    name: 'Account Model',
    category: 'Core',
    status: 'live',
    description: 'Role-based access control and permissions',
    features: [
      'Sub-profiles',
      'Permission levels',
      'Multi-sig support',
      'Social recovery'
    ],
    icon: '👥',
    color: 'from-orange-400 to-orange-600'
  },
  {
    id: 'ai-layer',
    name: 'AI Recommendations',
    category: 'Advanced',
    status: 'beta',
    description: 'AI-powered insights and decision support',
    features: [
      'Risk analysis',
      'Proposal summaries',
      'Trend detection',
      'Smart recommendations'
    ],
    icon: '🤖',
    color: 'from-pink-400 to-pink-600'
  },
  {
    id: 'mobile',
    name: 'Mobile Money',
    category: 'Integration',
    status: 'live',
    description: 'M-Pesa and airtime integration',
    features: [
      'M-Pesa deposits/withdrawals',
      'Airtime trading',
      'SMS voting',
      'USSD interface'
    ],
    icon: '📱',
    color: 'from-teal-400 to-teal-600'
  },
  {
    id: 'metadao',
    name: 'MetaDAO Network',
    category: 'Network',
    status: 'coming-soon',
    description: 'Federation of DAOs with cross-community coordination',
    features: [
      'DAO federation',
      'Cross-DAO governance',
      'Resource pooling',
      'Network effects'
    ],
    icon: '🌐',
    color: 'from-indigo-400 to-indigo-600'
  },
  {
    id: 'nft-credentials',
    name: 'NFT Credentials',
    category: 'Advanced',
    status: 'coming-soon',
    description: 'Verifiable digital credentials and achievements',
    features: [
      'Member badges',
      'Contribution tracking',
      'Skill verification',
      'Transferable credentials'
    ],
    icon: '🏅',
    color: 'from-yellow-400 to-yellow-600'
  }
]

const categories = ['All', ...new Set(features.map(f => f.category))]
const statuses = ['All', 'live', 'beta', 'coming-soon']

export function FeatureExplorer() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [expandedId, setExpandedId] = useState(null)

  const filteredFeatures = features.filter(feature => {
    const categoryMatch = selectedCategory === 'All' || feature.category === selectedCategory
    const statusMatch = selectedStatus === 'All' || feature.status === selectedStatus
    return categoryMatch && statusMatch
  })

  const statusColors = {
    live: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    beta: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    'coming-soon': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-8">
      {/* Filters */}
      <div className="mb-8">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Filter by Category</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Filter by Status</h3>
          <div className="flex flex-wrap gap-2">
            {statuses.map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedStatus === status
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {status === 'All' ? 'All Statuses' : status.replace('-', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredFeatures.map((feature, idx) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: idx * 0.05 }}
              className="h-full"
            >
              <button
                onClick={() => setExpandedId(expandedId === feature.id ? null : feature.id)}
                className="w-full text-left"
              >
                <div className={`h-full p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-400 transition-all hover:shadow-lg bg-white dark:bg-gray-900 cursor-pointer`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-4xl">{feature.icon}</div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[feature.status]}`}>
                      {feature.status === 'coming-soon' ? 'Coming Soon' : feature.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{feature.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{feature.category}</p>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">{feature.description}</p>

                  <AnimatePresence>
                    {expandedId === feature.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                      >
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Included Features:</h4>
                        <ul className="space-y-1">
                          {feature.features.map((f, i) => (
                            <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                              <span className="text-orange-500 mr-2">✓</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredFeatures.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No features match your filters. Try adjusting them.</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{features.filter(f => f.status === 'live').length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Live Features</div>
        </div>
        <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{features.filter(f => f.status === 'beta').length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Beta Features</div>
        </div>
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{new Set(features.map(f => f.category)).size}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Categories</div>
        </div>
        <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{features.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Features</div>
        </div>
      </div>
    </div>
  )
}
