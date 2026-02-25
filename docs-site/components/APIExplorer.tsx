import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const apiEndpoints = [
  {
    method: 'GET',
    path: '/api/v1/daos',
    description: 'List all DAOs',
    category: 'DAOs',
    rateLimit: '100 req/min',
    response: {
      daos: [
        { id: 'dao_123', name: 'Nairobi Youth Group', members: 45, treasury: 125000 }
      ],
      total: 1
    }
  },
  {
    method: 'POST',
    path: '/api/v1/daos',
    description: 'Create a new DAO',
    category: 'DAOs',
    rateLimit: '10 req/min',
    body: {
      name: 'My Community DAO',
      description: 'Local savings group',
      type: 'collective',
      treasury_address: '0x...'
    },
    response: {
      id: 'dao_456',
      name: 'My Community DAO',
      created_at: '2026-02-04T10:30:00Z'
    }
  },
  {
    method: 'GET',
    path: '/api/v1/daos/:id/proposals',
    description: 'Get DAO proposals',
    category: 'Governance',
    rateLimit: '1000 req/min',
    response: {
      proposals: [
        { id: 'prop_1', title: 'Approve funding', status: 'active', votes: { yes: 30, no: 5 } }
      ]
    }
  },
  {
    method: 'POST',
    path: '/api/v1/daos/:id/proposals',
    description: 'Create a proposal',
    category: 'Governance',
    rateLimit: '50 req/min',
    body: {
      title: 'Allocate 10,000 KES for community project',
      description: 'Fund education initiative',
      type: 'spending',
      amount: 10000
    }
  },
  {
    method: 'GET',
    path: '/api/v1/daos/:id/treasury',
    description: 'Get treasury balance and history',
    category: 'Treasury',
    rateLimit: '500 req/min',
    response: {
      balance: 125000,
      currency: 'KES',
      transactions: [
        { id: 'txn_1', amount: 10000, type: 'deposit', date: '2026-02-01' }
      ]
    }
  },
  {
    method: 'POST',
    path: '/api/v1/daos/:id/treasury/transfer',
    description: 'Execute a treasury transfer',
    category: 'Treasury',
    rateLimit: '20 req/min',
    body: {
      to: '0xabc...',
      amount: 5000,
      reason: 'Grant payment'
    }
  },
  {
    method: 'GET',
    path: '/api/v1/daos/:id/members',
    description: 'List DAO members',
    category: 'Members',
    rateLimit: '500 req/min'
  },
  {
    method: 'POST',
    path: '/api/v1/daos/:id/members/invite',
    description: 'Invite a member',
    category: 'Members',
    rateLimit: '50 req/min'
  },
  {
    method: 'GET',
    path: '/api/v1/defi/yields',
    description: 'Get yield farming opportunities',
    category: 'DeFi',
    rateLimit: '1000 req/min',
    response: {
      yields: [
        { pool: 'MTAA/USDC', apy: '12.5%', tvl: 1500000 }
      ]
    }
  },
  {
    method: 'POST',
    path: '/api/v1/agents/create',
    description: 'Create an automated agent',
    category: 'Agents',
    rateLimit: '10 req/min',
    body: {
      name: 'Trading Bot',
      type: 'trading',
      strategy: 'dca',
      parameters: { interval: 'daily', amount: 1000 }
    }
  }
]

const categories = [...new Set(apiEndpoints.map(e => e.category))]
const methods = { GET: 'bg-blue-100 text-blue-800', POST: 'bg-green-100 text-green-800', PUT: 'bg-yellow-100 text-yellow-800', DELETE: 'bg-red-100 text-red-800' }

export function APIExplorer() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [expandedId, setExpandedId] = useState(null)
  const [copied, setCopied] = useState(null)

  const filteredEndpoints = selectedCategory === 'All' 
    ? apiEndpoints 
    : apiEndpoints.filter(e => e.category === selectedCategory)

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatJSON = (obj) => JSON.stringify(obj, null, 2)

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      {/* Filter */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Filter by Category</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'All'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoints */}
      <div className="space-y-4">
        <AnimatePresence>
          {filteredEndpoints.map((endpoint, idx) => (
            <motion.div
              key={endpoint.path + endpoint.method}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <button
                onClick={() => setExpandedId(expandedId === endpoint.path ? null : endpoint.path)}
                className="w-full text-left"
              >
                <div className="p-4 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-400 transition-all hover:shadow-lg bg-white dark:bg-gray-900">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded font-mono text-xs font-bold ${methods[endpoint.method]}`}>
                          {endpoint.method}
                        </span>
                        <code className="text-sm font-mono text-gray-700 dark:text-gray-300">{endpoint.path}</code>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{endpoint.description}</p>
                      <div className="mt-2 flex gap-4 text-xs text-gray-500">
                        <span>Category: <strong>{endpoint.category}</strong></span>
                        <span>Rate Limit: <strong>{endpoint.rateLimit}</strong></span>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 transition-transform ${expandedId === endpoint.path ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>

                  <AnimatePresence>
                    {expandedId === endpoint.path && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                      >
                        {endpoint.body && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Request Body</h4>
                            <div className="relative">
                              <pre className="p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
{formatJSON(endpoint.body)}
                              </pre>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(formatJSON(endpoint.body), 'body_' + endpoint.path)
                                }}
                                className="absolute top-2 right-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                              >
                                {copied === 'body_' + endpoint.path ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}

                        {endpoint.response && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Response</h4>
                            <div className="relative">
                              <pre className="p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
{formatJSON(endpoint.response)}
                              </pre>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(formatJSON(endpoint.response), 'resp_' + endpoint.path)
                                }}
                                className="absolute top-2 right-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                              >
                                {copied === 'resp_' + endpoint.path ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Stats */}
      <div className="mt-12 grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{apiEndpoints.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Endpoints</div>
        </div>
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{categories.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Categories</div>
        </div>
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">REST</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">API Type</div>
        </div>
      </div>
    </div>
  )
}
