import React, { useMemo } from 'react';

interface ExchangeData {
  name: string;
  symbol: string;
  price: number;
  volume24h: number;
  liquidity: number;
  spread: number;
  fees: { maker: number; taker: number };
  uptime: number;
  region: string;
  rating: number;
}

interface ViewComponentProps {
  exchanges: ExchangeData[];
  bestPrice?: number;
  avgPrice?: number;
}

/**
 * Network View: Visualize exchange liquidity flows and arbitrage routes
 */
export const NetworkView: React.FC<ViewComponentProps> = ({ exchanges, bestPrice = 0 }) => {
  const arbitrageRoutes = useMemo(() => {
    const sorted = [...exchanges].sort((a, b) => a.price - b.price);
    const routes = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const buy = sorted[i];
      const sell = sorted[i + 1];
      const spread = ((sell.price - buy.price) / buy.price) * 100;

      if (spread > 0.2) {
        routes.push({
          from: buy.name,
          to: sell.name,
          spread,
          volume: Math.min(buy.liquidity, sell.liquidity),
          efficiency: Math.min(spread - (buy.fees.taker + sell.fees.maker) * 100, 0) > 0,
        });
      }
    }

    return routes;
  }, [exchanges]);

  const liquidityMap = useMemo(() => {
    const total = exchanges.reduce((sum, e) => sum + e.liquidity, 0);
    return exchanges.map((e) => ({
      name: e.name,
      liquidity: e.liquidity,
      percentage: (e.liquidity / total) * 100,
      size: Math.sqrt(e.liquidity),
    }));
  }, [exchanges]);

  return (
    <div className="space-y-6">
      {/* Liquidity Network */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="font-bold mb-4">🌐 Liquidity Network</h3>
        
        {/* Simple network visualization */}
        <div className="mb-6 p-4 bg-slate-900 rounded border border-slate-700 min-h-48">
          <svg viewBox="0 0 800 300" className="w-full h-auto">
            {/* Draw connections between exchanges proportional to arbitrage opportunity */}
            {arbitrageRoutes.map((route, idx) => {
              const fromIdx = exchanges.findIndex((e) => e.name === route.from);
              const toIdx = exchanges.findIndex((e) => e.name === route.to);
              const cols = 3;
              
              const fromX = ((fromIdx % cols) * 250) + 100;
              const fromY = (Math.floor(fromIdx / cols) * 150) + 100;
              const toX = ((toIdx % cols) * 250) + 100;
              const toY = (Math.floor(toIdx / cols) * 150) + 100;

              return (
                <g key={idx}>
                  {/* Line */}
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke={route.efficiency ? '#10b981' : '#f59e0b'}
                    strokeWidth={Math.max(1, route.spread / 5)}
                    opacity={0.6}
                  />
                  {/* Label */}
                  <text
                    x={(fromX + toX) / 2}
                    y={(fromY + toY) / 2 - 5}
                    fontSize="12"
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {route.spread.toFixed(2)}%
                  </text>
                </g>
              );
            })}

            {/* Exchange nodes */}
            {liquidityMap.map((ex, idx) => {
              const cols = 3;
              const x = ((idx % cols) * 250) + 100;
              const y = (Math.floor(idx / cols) * 150) + 100;
              const radius = Math.max(15, Math.min(40, ex.size / 50000));

              return (
                <g key={ex.name}>
                  {/* Circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill="#0ea5e9"
                    opacity={0.3}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                  />
                  {/* Label */}
                  <text
                    x={x}
                    y={y + 5}
                    fontSize="11"
                    fontWeight="bold"
                    fill="#fff"
                    textAnchor="middle"
                  >
                    {ex.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="text-xs text-slate-400">
          Node size = liquidity depth • Line thickness = arbitrage spread
        </p>
      </div>

      {/* Arbitrage Routes */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="font-bold mb-4">🔄 Active Arbitrage Routes</h3>
        {arbitrageRoutes.length === 0 ? (
          <p className="text-slate-400 text-sm">No profitable arbitrage routes detected</p>
        ) : (
          <div className="space-y-2">
            {arbitrageRoutes.slice(0, 10).map((route, idx) => (
              <div
                key={idx}
                className={`p-3 rounded border flex items-center justify-between ${
                  route.efficiency
                    ? 'bg-green-900/20 border-green-700/50'
                    : 'bg-amber-900/20 border-amber-700/50'
                }`}
              >
                <div>
                  <p className="font-semibold text-sm">
                    {route.from} → {route.to}
                  </p>
                  <p className="text-xs text-slate-400">
                    Liquidity: ${(route.volume / 1000000).toFixed(1)}M
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-bold text-sm ${
                      route.efficiency ? 'text-green-400' : 'text-yellow-400'
                    }`}
                  >
                    {route.spread.toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-400">
                    {route.efficiency ? 'Profitable' : 'Requires low fees'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liquidity Distribution */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="font-bold mb-4">💧 Liquidity Distribution</h3>
        <div className="space-y-3">
          {liquidityMap
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 8)
            .map((ex) => (
              <div key={ex.name} className="flex items-center gap-3">
                <div className="w-24 text-sm font-semibold">{ex.name}</div>
                <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full"
                    style={{ width: `${ex.percentage}%` }}
                  />
                </div>
                <div className="w-20 text-right text-sm text-slate-300">
                  {ex.percentage.toFixed(1)}%
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
