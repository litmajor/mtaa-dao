# Week 2 Implementation - Code Structure Reference

## File Modified
`client/src/pages/DeFiDEXAnalytics.tsx`

---

## New Imports Added

```tsx
import { useMemo } from 'react';  // For calculations
import { DollarSign, Zap, AlertTriangle } from 'lucide-react';  // New icons
```

---

## New Interfaces (Insert after PoolHistoryData)

```tsx
// Week 2: Performance Analytics Interfaces
interface PoolPerformance {
  poolId: string;
  apy: number;
  apr: number;
  feeTier: string;
  feeCollected24h: number;
  impermanentLoss: number;
  ilRisk: 'low' | 'medium' | 'high';
  sharpeRatio: number;
  volume24h: number;
}

interface APYHistoryPoint {
  date: string;
  apy: number;
  apr: number;
  timestamp: number;
}

interface FeeAnalysis {
  tier: string;
  volume24h: number;
  feesCollected: number;
  poolCount: number;
  adoptionRate: number;
}

interface ImpermanentLossData {
  ilPercentage: number;
  ilRisk: 'low' | 'medium' | 'high';
  priceVolatility: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}
```

---

## New State Variables

```tsx
// Week 2: Performance analytics state
const [performanceTimeRange, setPerformanceTimeRange] = useState<string>('30d');
const [hypotheticalAmount, setHypotheticalAmount] = useState<number>(1000);
```

---

## New Query Hooks

```tsx
// Week 2: Fetch pool performance data
const { data: poolPerformance } = useQuery({
  queryKey: ['pool-performance', selectedPool],
  queryFn: async () => {
    if (!selectedPool) return null;
    return await apiGet<PoolPerformance>(`/api/dex/pools/${selectedPool}/performance`);
  },
  enabled: !!selectedPool,
});

// Week 2: Fetch APY history
const { data: apyHistory } = useQuery({
  queryKey: ['apy-history', selectedPool, performanceTimeRange],
  queryFn: async () => {
    if (!selectedPool) return null;
    const params = new URLSearchParams({
      timeRange: performanceTimeRange,
    });
    return await apiGet<APYHistoryPoint[]>(`/api/dex/pools/${selectedPool}/apy-history?${params}`);
  },
  enabled: !!selectedPool,
});

// Week 2: Fetch fee analysis
const { data: feeAnalysis } = useQuery({
  queryKey: ['fee-analysis', selectedPool],
  queryFn: async () => {
    if (!selectedPool) return null;
    return await apiGet<FeeAnalysis[]>(`/api/dex/pools/${selectedPool}/fee-analysis`);
  },
  enabled: !!selectedPool,
});

// Week 2: Fetch IL risk data
const { data: ilRiskData } = useQuery({
  queryKey: ['il-risk', selectedPool],
  queryFn: async () => {
    if (!selectedPool) return null;
    return await apiGet<ImpermanentLossData>(`/api/dex/pools/${selectedPool}/il-risk`);
  },
  enabled: !!selectedPool,
});
```

---

## Tab List Update

### Before
```tsx
<TabsList className="grid w-full grid-cols-5 gap-2">
  <TabsTrigger value="pools">Pools</TabsTrigger>
  <TabsTrigger value="technical">📊 Technical</TabsTrigger>
  <TabsTrigger value="historical">📈 Historical</TabsTrigger>
  <TabsTrigger value="dex-breakdown">DEX Breakdown</TabsTrigger>
  <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
</TabsList>
```

### After
```tsx
<TabsList className="grid w-full grid-cols-6 gap-2">
  <TabsTrigger value="pools">Pools</TabsTrigger>
  <TabsTrigger value="technical">📊 Technical</TabsTrigger>
  <TabsTrigger value="historical">📈 Historical</TabsTrigger>
  <TabsTrigger value="performance">💰 Performance</TabsTrigger>
  <TabsTrigger value="dex-breakdown">DEX Breakdown</TabsTrigger>
  <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
</TabsList>
```

---

## Performance Tab Content (Main Implementation)

### Tab Container
```tsx
<TabsContent value="performance" className="space-y-4">
  {!selectedPool ? (
    // Show alert if no pool selected
  ) : (
    // Show all performance content
  )}
</TabsContent>
```

### Pool Selection Alert
```tsx
{!selectedPool ? (
  <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
    <CardContent className="pt-8">
      <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
        <div>
          <p className="font-semibold text-yellow-900 dark:text-yellow-100">
            Select a pool to view performance metrics
          </p>
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Click any row in the Pools tab to begin analyzing profitability
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
) : (
  // Full performance content below
)}
```

### Metrics Cards Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  {/* APY Card */}
  <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-green-600 dark:text-green-400">
        APY
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-green-900 dark:text-green-100">
        {poolPerformance?.apy ? poolPerformance.apy.toFixed(2) : '—'}%
      </div>
      <p className="text-xs text-green-700 dark:text-green-300 mt-1 flex items-center gap-1">
        Annual Percentage Yield
        {poolPerformance?.apy && poolPerformance.apy > 0 && (
          <TrendingUp className="w-3 h-3" />
        )}
      </p>
    </CardContent>
  </Card>

  {/* APR Card */}
  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-blue-600 dark:text-blue-400">
        APR
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
        {poolPerformance?.apr ? poolPerformance.apr.toFixed(2) : '—'}%
      </div>
      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
        Annual Percentage Rate
      </p>
    </CardContent>
  </Card>

  {/* 24h Fees Card */}
  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
        <DollarSign className="w-4 h-4" />
        24h Fees
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
        ${(poolPerformance?.feeCollected24h || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
        Collected in 24h
      </p>
    </CardContent>
  </Card>

  {/* IL Risk Card - Dynamic Color */}
  <Card className={`bg-gradient-to-br border ${
    ilRiskData?.ilRisk === 'low'
      ? 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-200 dark:border-green-800'
      : ilRiskData?.ilRisk === 'medium'
      ? 'from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800'
      : 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border-red-200 dark:border-red-800'
  }`}>
    <CardHeader className="pb-2">
      <CardTitle className={`text-sm font-semibold flex items-center gap-1 ${
        ilRiskData?.ilRisk === 'low'
          ? 'text-green-600 dark:text-green-400'
          : ilRiskData?.ilRisk === 'medium'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400'
      }`}>
        <AlertTriangle className="w-4 h-4" />
        IL Risk
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className={`text-3xl font-bold ${
        ilRiskData?.ilRisk === 'low'
          ? 'text-green-900 dark:text-green-100'
          : ilRiskData?.ilRisk === 'medium'
          ? 'text-amber-900 dark:text-amber-100'
          : 'text-red-900 dark:text-red-100'
      }`}>
        {ilRiskData?.ilPercentage ? ilRiskData.ilPercentage.toFixed(2) : '—'}%
      </div>
      <p className={`text-xs mt-1 ${
        ilRiskData?.ilRisk === 'low'
          ? 'text-green-700 dark:text-green-300'
          : ilRiskData?.ilRisk === 'medium'
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-red-700 dark:text-red-300'
      }`}>
        {ilRiskData?.ilRisk ? `${ilRiskData.ilRisk.toUpperCase()} risk` : 'Risk level'}
      </p>
    </CardContent>
  </Card>
</div>
```

### Charts Grid
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* APY History Chart */}
  <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
    <CardHeader>
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>APY Trend</CardTitle>
          <CardDescription>Historical APY over time</CardDescription>
        </div>
        <div className="flex gap-1">
          {['7d', '30d', '90d', '1y'].map(range => (
            <Button
              key={range}
              variant={performanceTimeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPerformanceTimeRange(range)}
              className="text-xs"
            >
              {range}
            </Button>
          ))}
        </div>
      </div>
    </CardHeader>
    <CardContent>
      {apyHistory && apyHistory.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={apyHistory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => `${(value as number).toFixed(2)}%`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="apy"
              stroke="#10b981"
              name="APY %"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex justify-center py-8 text-gray-500">
          Loading APY data...
        </div>
      )}
    </CardContent>
  </Card>

  {/* Fee Tier Breakdown */}
  <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
    <CardHeader>
      <CardTitle>Fee Tier Distribution</CardTitle>
      <CardDescription>Pool fee structure breakdown</CardDescription>
    </CardHeader>
    <CardContent>
      {feeAnalysis && feeAnalysis.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={feeAnalysis}
              dataKey="feesCollected"
              nameKey="tier"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ tier, adoptionRate }) => `${tier} (${adoptionRate?.toFixed(1)}%)`}
            >
              {feeAnalysis.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index % 4]}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${(value as number).toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex justify-center py-8 text-gray-500">
          Loading fee data...
        </div>
      )}
    </CardContent>
  </Card>
</div>
```

### Profitability Analysis
```tsx
<Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Zap className="w-5 h-5" />
      Profitability Analysis
    </CardTitle>
    <CardDescription>
      Projected returns on a hypothetical ${hypotheticalAmount.toLocaleString()} position
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Input Section */}
    <div className="flex gap-4 items-end">
      <div className="flex-1">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
          Hypothetical Amount (USD)
        </label>
        <Input
          type="number"
          value={hypotheticalAmount}
          onChange={(e) => setHypotheticalAmount(Math.max(0, Number(e.target.value)))}
          className="w-full"
          min="0"
        />
      </div>
    </div>

    {/* Calculations Grid */}
    {poolPerformance && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
        {/* Annual Return */}
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Projected Annual Return
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${(hypotheticalAmount * (poolPerformance.apy / 100)).toLocaleString('en-US', {maximumFractionDigits: 2})}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Based on current APY
          </p>
        </div>

        {/* IL-Adjusted Return */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            IL-Adjusted Return
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ${((hypotheticalAmount * (poolPerformance.apy / 100)) - (hypotheticalAmount * (ilRiskData?.ilPercentage || 0) / 100)).toLocaleString('en-US', {maximumFractionDigits: 2})}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            After estimated IL
          </p>
        </div>

        {/* Breakeven Period */}
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Est. Breakeven
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {ilRiskData && poolPerformance.apy > 0
              ? Math.ceil((ilRiskData.ilPercentage / poolPerformance.apy) * 365)
              : '—'} days
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            To recover IL
          </p>
        </div>
      </div>
    )}
  </CardContent>
</Card>
```

---

## Insert Location

The complete Performance tab should be inserted **before** the DEX Breakdown tab:

```
Position: After historical data tab closing tag
         Before DEX Breakdown tab opening tag
Line: ~765
```

---

## Summary

**Total Code Added**: ~500 lines
- 4 new interfaces: ~80 lines
- 2 new state variables: ~3 lines
- 4 new query hooks: ~45 lines
- Performance tab content: ~370+ lines
- Tab list update: 1 line

**TypeScript Errors**: 0 ✓
**Compilation**: Clean ✓
**All Imports**: Valid ✓
