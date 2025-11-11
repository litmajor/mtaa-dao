
import { motion } from 'framer-motion'
import { useState } from 'react'

const daoTypes = [
  {
    type: 'Short-Term DAO',
    duration: '30 days',
    fee: '₭500',
    ideal: 'Wedding, funeral, event',
    upgrade: 'Extend / Upgrade',
  color: 'bg-blue-100 dark:bg-blue-900 border-blue-500 dark:border-blue-400',
    examples: ['Wedding fundraiser', 'Funeral support', 'One-time event']
  },
  {
    type: 'Collective DAO',
    duration: 'Monthly',
    fee: '₭1,500',
    ideal: 'Savings, chama, community projects',
    upgrade: 'Merge / MetaDAO',
  color: 'bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-400',
    examples: ['Savings group', 'Business chama', 'Community development']
  },
  {
    type: 'MetaDAO',
    duration: 'Continuous',
    fee: 'Dynamic',
    ideal: 'Regional, strategic alliances',
    upgrade: 'Federation Layer',
  color: 'bg-purple-100 dark:bg-purple-900 border-purple-500 dark:border-purple-400',
    examples: ['Nairobi Creative Cluster', 'Regional alliance', 'Multi-DAO network']
  }
]

export function DAOTypeComparison() {
  const [selected, setSelected] = useState(0)

  return (
    <div className="my-8">
      <div className="flex gap-4 mb-6 overflow-x-auto">
        {daoTypes.map((dao, idx) => (
          <button
            key={idx}
            onClick={() => setSelected(idx)}
            className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
              selected === idx
                ? 'bg-orange-500 text-white dark:bg-orange-600 dark:text-gray-100'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {dao.type}
          </button>
        ))}
      </div>

      <motion.div
        key={selected}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
  className={`p-6 border-2 rounded-xl ${daoTypes[selected].color}`}
      >
  <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">{daoTypes[selected].type}</h3>
        
  <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Duration</p>
            <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">{daoTypes[selected].duration}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Creation Fee</p>
            <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">{daoTypes[selected].fee}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Best For</p>
            <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">{daoTypes[selected].ideal}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Upgrade Path</p>
            <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">{daoTypes[selected].upgrade}</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Example Use Cases:</p>
          <ul className="list-disc list-inside space-y-1">
            {daoTypes[selected].examples.map((example, idx) => (
              <li key={idx} className="text-gray-800 dark:text-gray-100">{example}</li>
            ))}
          </ul>
        </div>
      </motion.div>
    </div>
  )
}
