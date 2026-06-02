import React, { useState, useMemo } from 'react';
import { Strategy } from '../../hooks/useStrategyRegistry';
import { Lucide } from '../../src/lib/icons';
const { ChartBar, TrendingUp, Box, Bolt, Cpu, Users, Settings, Search, Check } = (Lucide as any) || {};

// Icon mapping for categories (runtime-safe)
const categoryIcons: Record<string, JSX.Element> = {
  technical: <ChartBar className="inline w-5 h-5 mr-2 text-slate-500" />,
  dca: <TrendingUp className="inline w-5 h-5 mr-2 text-green-400" />,
  grid: <Box className="inline w-5 h-5 mr-2 text-purple-400" />,
  arbitrage: <Bolt className="inline w-5 h-5 mr-2 text-yellow-400" />,
  ml: <Cpu className="inline w-5 h-5 mr-2 text-red-400" />,
  community: <Users className="inline w-5 h-5 mr-2 text-indigo-400" />,
  custom: <Settings className="inline w-5 h-5 mr-2 text-slate-400" />,
};

interface StrategyCardProps {
  strategy: Strategy;
  isSelected: boolean;
  onSelect: (strategy: Strategy) => void;
}

function StrategyCardInner({ strategy, isSelected, onSelect }: StrategyCardProps) {
  return (
    <div
      onClick={() => onSelect(strategy)}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-300'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{categoryIcons[strategy.category]}</span>
            <h3 className="font-bold text-lg">{strategy.name}</h3>
            {strategy.verified && (
              <span className="px-2 py-1 bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-100 text-xs rounded-full">
                ✓ Verified
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            by {strategy.author} • v{strategy.version}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{strategy.popularity}</div>
          <div className="text-xs text-slate-500">popularity</div>
        </div>
      </div>

      <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 line-clamp-2">
        {strategy.description}
      </p>

      {/* Backtest Results */}
      {strategy.backtestResults && (
        <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-slate-100 dark:bg-slate-700 rounded">
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Total Return</div>
            <div className="font-bold text-green-600">{strategy.backtestResults.totalReturn.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Sharpe Ratio</div>
            <div className="font-bold">{strategy.backtestResults.sharpeRatio.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Win Rate</div>
            <div className="font-bold text-blue-600">{(strategy.backtestResults.winRate * 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Max DD</div>
            <div className="font-bold text-orange-600">{strategy.backtestResults.maxDrawdown.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {strategy.tags.slice(0, 3).map((tag: string) => (
          <span key={tag} className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
            #{tag}
          </span>
        ))}
        {strategy.tags.length > 3 && (
          <span className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400">+{strategy.tags.length - 3}</span>
        )}
      </div>

      {isSelected && (
        <div className="mt-3 pt-3 border-t border-blue-300 text-blue-600 font-bold text-sm"><Check className="inline w-4 h-4 mr-1" />Selected</div>
      )}
    </div>
  );
}

// Memoize StrategyCard to avoid unnecessary re-renders when parent filters change
export const StrategyCard = React.memo(StrategyCardInner);

interface StrategySelectorProps {
  strategies: Strategy[];
  selectedStrategyId: string | null;
  onStrategySelect: (strategy: Strategy) => void;
  onCategoryFilter: (category: string | null) => void;
  onSearch: (query: string) => void;
}

export const StrategySelector: React.FC<StrategySelectorProps> = ({
  strategies,
  selectedStrategyId,
  onStrategySelect,
  onCategoryFilter,
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { value: 'technical', label: <><ChartBar className="inline w-4 h-4 mr-1" />Technical</>, color: 'bg-blue-100 dark:bg-blue-900' },
    { value: 'dca', label: <><TrendingUp className="inline w-4 h-4 mr-1" />DCA</>, color: 'bg-green-100 dark:bg-green-900' },
    { value: 'grid', label: <><Box className="inline w-4 h-4 mr-1" />Grid</>, color: 'bg-purple-100 dark:bg-purple-900' },
    { value: 'arbitrage', label: <><Bolt className="inline w-4 h-4 mr-1" />Arbitrage</>, color: 'bg-yellow-100 dark:bg-yellow-900' },
    { value: 'ml', label: <><Cpu className="inline w-4 h-4 mr-1" />ML</>, color: 'bg-red-100 dark:bg-red-900' },
    { value: 'community', label: <><Users className="inline w-4 h-4 mr-1" />Community</>, color: 'bg-indigo-100 dark:bg-indigo-900' },
  ];

  const handleCategoryClick = (category: string | null) => {
    setSelectedCategory(category);
    onCategoryFilter(category);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  // Memoize filtering to avoid re-computation on every render
  const filteredStrategies = useMemo(() => {
    return strategies.filter((s) => {
      const matchesCategory = !selectedCategory || s.category === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [strategies, searchQuery, selectedCategory]);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Select Strategy</h2>
        <p className="text-slate-600 dark:text-slate-400">Choose from verified strategies or create your own</p>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search strategies..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Category Filters */}
      <div>
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Filter by Category</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryClick(null)}
            className={`px-3 py-1 rounded-full text-sm transition-all ${
              selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategoryClick(cat.value)}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                selectedCategory === cat.value ? 'bg-blue-600 text-white' : `${cat.color} text-slate-700 dark:text-slate-300 hover:opacity-80`
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Strategies Grid */}
      <div>
        <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">{filteredStrategies.length} strategies found</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStrategies.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} isSelected={selectedStrategyId === strategy.id} onSelect={onStrategySelect} />
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredStrategies.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-2"><Search className="w-12 h-12 mx-auto mb-4 opacity-50" /></div>
          <p className="text-slate-600 dark:text-slate-400">No strategies found</p>
          <p className="text-sm text-slate-500 dark:text-slate-500">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Selected Summary */}
      {selectedStrategyId && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-600 rounded">
          <div className="font-bold text-blue-900 dark:text-blue-100">✓ {strategies.find((s) => s.id === selectedStrategyId)?.name} selected</div>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">Ready to configure inputs and risk controls</p>
        </div>
      )}
    </div>
  );
};
