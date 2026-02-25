// frontend/src/components/dashboard/OpportunitiesSection.tsx
import React from 'react';

interface Opportunity {
  id: string;
  type: 'exchange_spread' | 'flash_loan' | 'dex_spread';
  entryPrice: number;
  exitPrice: number;
  expectedProfit: number;
  timeEstimate: string;
  gasCost: number;
  riskLevel: string;
  confidence: number;
  pair: string;
}

interface OpportunitiesSectionProps {
  opportunities: Opportunity[];
  onSelectOpportunity: (opp: Opportunity) => void;
}

const OpportunitiesSection: React.FC<OpportunitiesSectionProps> = ({
  opportunities,
  onSelectOpportunity,
}) => {
  const mockOpportunities: Opportunity[] = [
    {
      id: '1',
      type: 'dex_spread',
      pair: 'SOL/USDC',
      entryPrice: 20.45,
      exitPrice: 20.85,
      expectedProfit: 45.20,
      timeEstimate: '2-5 minutes',
      gasCost: 0.02,
      riskLevel: 'Low',
      confidence: 0.89,
    },
    {
      id: '2',
      type: 'exchange_spread',
      pair: 'PUMP/USDC',
      entryPrice: 0.00421,
      exitPrice: 0.00437,
      expectedProfit: 78.50,
      timeEstimate: '5-10 minutes',
      gasCost: 0.04,
      riskLevel: 'Medium',
      confidence: 0.76,
    },
  ];

  const data = opportunities.length > 0 ? opportunities : mockOpportunities;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        ⚡ Real-Time Arbitrage Opportunities
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((opp) => (
          <div
            key={opp.id}
            className="p-4 bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow duration-200 cursor-pointer"
            onClick={() => onSelectOpportunity(opp)}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">{opp.pair}</h4>
              <span className={`px-2 py-1 text-xs font-semibold rounded ${
                opp.riskLevel === 'Low' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                opp.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {opp.riskLevel}
              </span>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              {opp.type.replace(/_/g, ' ')}
            </p>

            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Entry</p>
                <p className="font-semibold text-gray-900 dark:text-white">${opp.entryPrice.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Exit</p>
                <p className="font-semibold text-gray-900 dark:text-white">${opp.exitPrice.toFixed(6)}</p>
              </div>
            </div>

            <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-success-green font-bold text-lg">+${opp.expectedProfit.toFixed(2)}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Gas: ${opp.gasCost.toFixed(4)}</p>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600 dark:text-gray-400">{opp.timeEstimate}</span>
              <span className="text-brand-blue font-semibold">{(opp.confidence * 100).toFixed(0)}%</span>
            </div>

            <button className="w-full mt-3 px-3 py-2 bg-brand-blue text-white text-sm rounded hover:opacity-90 transition-opacity">
              ⚡ EXECUTE NOW
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OpportunitiesSection;
