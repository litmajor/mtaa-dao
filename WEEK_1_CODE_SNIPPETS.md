# Week 1 Implementation - Code Snippets Reference

## Overview
This document contains the exact code snippets added during Week 1 implementation for the DeFi DEX analytics expansion.

---

## 1. Enhanced Metrics Cards (4-Column Grid)

```tsx
{/* Key Metrics */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-blue-600 dark:text-blue-400">
        Total TVL
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
        ${(totalTVL / 1e9).toFixed(2)}B
      </div>
      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
        Total Value Locked
      </p>
    </CardContent>
  </Card>

  <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        24h Volume
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
        ${(total24hVolume / 1e9).toFixed(2)}B
      </div>
      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
        Trading Volume
      </p>
    </CardContent>
  </Card>

  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-purple-600 dark:text-purple-400">
        Active Pools
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
        {pools?.length || 0}
      </div>
      <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
        Liquidity Pools
      </p>
    </CardContent>
  </Card>

  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-amber-600 dark:text-amber-400">
        Avg. Vol/TVL
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
        {totalTVL > 0 ? (total24hVolume / totalTVL).toFixed(2) : '0'}
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
        Volume to TVL Ratio
      </p>
    </CardContent>
  </Card>
</div>
```

---

## 2. Enhanced Search & Filter Section

```tsx
{/* Controls - Enhanced Search & Filter */}
<div className="space-y-4">
  <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
    <div className="flex-1">
      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
        Select Chain
      </label>
      <Select value={selectedChain} onValueChange={setSelectedChain}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ethereum">Ethereum</SelectItem>
          <SelectItem value="polygon">Polygon</SelectItem>
          <SelectItem value="arbitrum">Arbitrum</SelectItem>
          <SelectItem value="optimism">Optimism</SelectItem>
          <SelectItem value="celo">Celo</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex-1">
      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
        Filter DEX
      </label>
      <Select value={selectedDEX} onValueChange={setSelectedDEX}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All DEXes</SelectItem>
          {dexList?.map(dex => (
            <SelectItem key={dex.id} value={dex.id}>
              {dex.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <Button
      variant="outline"
      size="lg"
      onClick={() => window.location.reload()}
      className="gap-2"
    >
      <span>🔄</span>
      Refresh
    </Button>
  </div>

  {/* Enhanced Search Bar */}
  <div className="relative">
    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
      Search Token Pairs
    </label>
    <div className="relative">
      <Input
        placeholder="Search by token symbol (e.g., USDC/ETH, USDT)..."
        value={searchToken}
        onChange={e => setSearchToken(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700"
      />
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
        🔍
      </span>
      {searchToken && (
        <button
          onClick={() => setSearchToken('')}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ✕
        </button>
      )}
    </div>
    {searchToken && (
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Found <strong>{filteredPools.length}</strong> matching pools
      </p>
    )}
  </div>
</div>
```

---

## 3. Selected Pool Indicator

```tsx
{/* Selected Pool Indicator */}
{selectedPool && (
  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
    <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></div>
    <p className="text-sm text-blue-900 dark:text-blue-100">
      <strong>Selected Pool:</strong> {selectedPool} - Now view Technical Analysis or Historical tabs
    </p>
    <button
      onClick={() => setSelectedPool(null)}
      className="ml-auto text-sm text-blue-600 dark:text-blue-400 hover:underline"
    >
      Clear Selection
    </button>
  </div>
)}
```

---

## 4. Pool Table with Selection Highlight

```tsx
<tbody>
  {filteredPools.slice(0, 20).map((pool, idx) => (
    <tr
      key={idx}
      onClick={() => setSelectedPool(pool.id)}
      className={`border-b transition-all cursor-pointer ${
        selectedPool === pool.id
          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700'
          : 'border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
      }`}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-gray-900 dark:text-white">
            {pool.token0}/{pool.token1}
          </div>
          <Badge variant="outline" className="text-xs">
            {pool.dex}
          </Badge>
          {selectedPool === pool.id && (
            <Badge className="bg-blue-600 dark:bg-blue-500 text-white text-xs">
              ✓ Selected
            </Badge>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
        {pool.dex}
      </td>
      <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
        ${(pool.liquidity / 1e6).toFixed(1)}M
      </td>
      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
        ${(pool.volume24h / 1e6).toFixed(1)}M
      </td>
      {pool.feeTier && (
        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
          {pool.feeTier}
        </td>
      )}
      {pool.apy !== undefined && (
        <td className="py-3 px-4 text-right font-semibold text-green-600 dark:text-green-400">
          {pool.apy.toFixed(2)}%
        </td>
      )}
    </tr>
  ))}
</tbody>
```

---

## 5. Pool Results Summary

```tsx
{/* Results Summary */}
{!poolsLoading && filteredPools.length > 0 && (
  <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
    Showing {Math.min(20, filteredPools.length)} of {filteredPools.length} pools
  </div>
)}

{!poolsLoading && filteredPools.length === 0 && (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <span className="text-3xl mb-2">🔍</span>
    <p className="text-gray-600 dark:text-gray-400">No pools found matching your criteria</p>
    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Try adjusting your search or filters</p>
  </div>
)}
```

---

## 6. Data Interface & State

```tsx
// Data interface for pool history
interface PoolHistoryData {
  timestamp: number;
  tvl: number;
  volume: number;
  fees: number;
  apy: number;
}

// State management
const [selectedPool, setSelectedPool] = useState<string | null>(null);
const [timeRange, setTimeRange] = useState<string>('30d');
const [searchToken, setSearchToken] = useState<string>('');
```

---

## 7. API Query Hook

```tsx
// Fetch pool history data based on selection and time range
const { data: poolHistory } = useQuery({
  queryKey: ['pool-history', selectedPool, selectedChain, timeRange],
  queryFn: async () => {
    if (!selectedPool) return null;
    const params = new URLSearchParams({
      pool: selectedPool,
      chain: selectedChain,
      timeRange: timeRange,
    });
    return await apiGet<PoolHistoryData[]>(`/api/dex/pools/history?${params}`);
  },
  enabled: !!selectedPool,
});
```

---

## 8. Technical Analysis Tab

```tsx
<TabsContent value="technical" className="space-y-4">
  <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        Technical Analysis
      </CardTitle>
      <CardDescription>
        Technical indicators for selected pool (select a pool from Pools tab first)
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!selectedPool ? (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-900 dark:text-yellow-100">
              Select a pool to view technical analysis
            </p>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Click any row in the Pools tab to begin analyzing
            </p>
          </div>
        </div>
      ) : poolHistory && poolHistory.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><RSIChart data={poolHistory} period={14} /></Card>
            <Card><MACDChart data={poolHistory} /></Card>
            <Card><BollingerBands data={poolHistory} period={20} stdDev={2} /></Card>
            <Card><MovingAverages data={poolHistory} periods={[7, 20, 50]} /></Card>
          </div>
          
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>💡 Tip:</strong> RSI above 70 suggests overbought conditions, below 30 suggests oversold.
                MACD crossovers can indicate trend changes.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

---

## 9. Historical Data Tab

```tsx
<TabsContent value="historical" className="space-y-4">
  <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <BarChart className="w-5 h-5" />
        Historical Data
      </CardTitle>
      <CardDescription>
        Performance metrics for selected pool over time
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!selectedPool ? (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-900 dark:text-yellow-100">
              Select a pool to view historical data
            </p>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Click any row in the Pools tab to begin analyzing
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Time Range Selector */}
          <div className="flex gap-2">
            {['7d', '30d', '90d', '1y'].map(range => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="text-xs"
              >
                {range}
              </Button>
            ))}
          </div>

          {/* Historical Charts */}
          {poolHistory && poolHistory.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><HistoricalChart data={poolHistory} metric="tvl" color="#3b82f6" label="Total Value Locked" /></Card>
              <Card><HistoricalChart data={poolHistory} metric="volume" color="#10b981" label="24h Volume" /></Card>
              <Card><HistoricalChart data={poolHistory} metric="fees" color="#a855f7" label="Fees Collected" /></Card>
              <Card><HistoricalChart data={poolHistory} metric="apy" color="#f59e0b" label="APY %" /></Card>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <p className="text-sm text-green-900 dark:text-green-100">
                <strong>📊 Analysis:</strong> Use these charts to identify trends, volatility, and optimal entry/exit points for liquidity provision.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

---

## 10. Tab List (5 Tabs)

```tsx
<TabsList className="grid w-full grid-cols-5 gap-2">
  <TabsTrigger value="pools">Pools</TabsTrigger>
  <TabsTrigger value="technical">📊 Technical</TabsTrigger>
  <TabsTrigger value="historical">📈 Historical</TabsTrigger>
  <TabsTrigger value="dex-breakdown">DEX Breakdown</TabsTrigger>
  <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
</TabsList>
```

---

## Imports Required

```tsx
import { AlertCircle, TrendingUp, BarChart } from 'lucide-react';
import { RSIChart } from '@/components/RSIChart';
import { MACDChart } from '@/components/MACDChart';
import { BollingerBands } from '@/components/BollingerBands';
import { MovingAverages } from '@/components/MovingAverages';
import { HistoricalChart } from '@/components/HistoricalChart';
```

---

## Summary

This document contains all 10 major code sections added during Week 1:

1. ✅ Enhanced Metrics Cards
2. ✅ Search & Filter Section
3. ✅ Selected Pool Indicator
4. ✅ Pool Table with Highlighting
5. ✅ Results Summary
6. ✅ Data Interface & State
7. ✅ API Query Hook
8. ✅ Technical Analysis Tab
9. ✅ Historical Data Tab
10. ✅ Tab Navigation

All code has been tested and integrated into `DeFiDEXAnalytics.tsx`.

---

**File**: `client/src/pages/DeFiDEXAnalytics.tsx`
**Status**: ✅ Ready for testing and deployment
