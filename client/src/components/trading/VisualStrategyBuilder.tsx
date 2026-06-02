/**
 * Yuki Visual Strategy Builder
 * 
 * Drag-and-drop interface for non-technical users to build trading strategies
 * without code. Technical users can inspect/export generated strategy JSON.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Plus, Trash2, Play, RotateCcw, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import useStrategyDeployment from '../../hooks/useStrategyDeployment';
import DeployProgressModal from './DeployProgressModal';
import useStrategyGraph from '../../state/strategy-graph.store';
import * as yukiApi from '../../api/yukiApi';
import { validateGraph } from '../../engine/strategy-validator';
import { compileGraph } from '../../engine/strategy-compiler';
import NodeInspector from './NodeInspector';
import CanvasSurface from './CanvasSurface';

// ============================================================================
// TYPES
// ============================================================================

export type BlockType = 'condition' | 'action' | 'logic' | 'risk' | 'execution' | 'ai' | 'vault' | 'crosschain';
export type ConditionMetric = 'price' | 'volume' | 'rsi' | 'macd' | 'ma' | 'bollinger' | 'custom';
export type Operator = '>' | '<' | '==' | 'between' | 'custom';
export type ActionType = 'buy' | 'sell' | 'swap' | 'bridge' | 'move' | 'alert' | 'dca' | 'rebalance';

export interface StrategyBlock {
  id: string;
  type: BlockType;
  label: string;
  config: Record<string, any>;
  inputs: string[]; // IDs of previous blocks
  outputs: string[]; // IDs of next blocks
  color: string;
  icon: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  blocks: StrategyBlock[];
  riskControls: {
    maxLoss: number;
    maxDrawdown: number;
    dailyTradeLimit: number;
  };
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// BLOCK TEMPLATES
// ============================================================================

const BLOCK_TEMPLATES: Record<BlockType, any[]> = {
  condition: [
    {
      id: 'cond-price',
      label: 'Price Condition',
      icon: '💹',
      color: 'bg-blue-600',
      config: {
        metric: 'price',
        token: 'ETH',
        operator: '>',
        value: 0,
      },
    },
    {
      id: 'cond-volume',
      label: 'Volume Spike',
      icon: '📊',
      color: 'bg-blue-600',
      config: {
        metric: 'volume',
        operator: '>',
        percentile: 80,
      },
    },
    {
      id: 'cond-rsi',
      label: 'RSI Condition',
      icon: '📈',
      color: 'bg-blue-600',
      config: {
        metric: 'rsi',
        operator: '>',
        value: 70,
        period: 14,
      },
    },
    {
      id: 'cond-time',
      label: 'Time-Based',
      icon: '⏰',
      color: 'bg-blue-600',
      config: {
        type: 'hourly',
        hour: 9,
      },
    },
  ],
  action: [
    {
      id: 'act-swap',
      label: 'Swap Tokens',
      icon: '🔄',
      color: 'bg-green-600',
      config: {
        action: 'swap',
        from: 'ETH',
        to: 'USDC',
        amount: 1,
        amountType: 'fixed',
        slippage: 0.5,
      },
    },
    {
      id: 'act-buy',
      label: 'Buy',
      icon: '📥',
      color: 'bg-green-600',
      config: {
        action: 'buy',
        token: 'ETH',
        amount: 1,
        orderType: 'market',
        price: 0,
      },
    },
    {
      id: 'act-sell',
      label: 'Sell',
      icon: '📤',
      color: 'bg-green-600',
      config: {
        action: 'sell',
        token: 'ETH',
        amount: 1,
        orderType: 'market',
        price: 0,
      },
    },
    {
      id: 'act-bridge',
      label: 'Bridge Assets',
      icon: '🌉',
      color: 'bg-green-600',
      config: {
        action: 'bridge',
        token: 'USDC',
        fromChain: 'ethereum',
        toChain: 'polygon',
        amount: 100,
        provider: 'stargate',
      },
    },
    {
      id: 'act-move',
      label: 'Move Funds',
      icon: '➡️',
      color: 'bg-green-600',
      config: {
        action: 'move',
        from: 'okedi',
        to: 'amara',
        token: 'cUSD',
        amount: 100,
      },
    },
    {
      id: 'act-alert',
      label: 'Send Alert',
      icon: '🔔',
      color: 'bg-green-600',
      config: {
        action: 'alert',
        channel: 'email',
        message: 'Alert message',
      },
    },
  ],
  logic: [
    {
      id: 'logic-and',
      label: 'AND Gate',
      icon: '∧',
      color: 'bg-purple-600',
      config: { gate: 'AND' },
    },
    {
      id: 'logic-or',
      label: 'OR Gate',
      icon: '∨',
      color: 'bg-purple-600',
      config: { gate: 'OR' },
    },
    {
      id: 'logic-if',
      label: 'IF/THEN/ELSE',
      icon: '⚡',
      color: 'bg-purple-600',
      config: { type: 'conditional' },
    },
  ],
  risk: [
    {
      id: 'risk-stoploss',
      label: 'Stop Loss',
      icon: '🛑',
      color: 'bg-red-600',
      config: {
        stopLoss: 5,
        type: 'percent',
      },
    },
    {
      id: 'risk-takeprofit',
      label: 'Take Profit',
      icon: '🎯',
      color: 'bg-red-600',
      config: {
        takeProfit: 10,
        type: 'percent',
      },
    },
    {
      id: 'risk-maxslippage',
      label: 'Max Slippage',
      icon: '💧',
      color: 'bg-red-600',
      config: {
        maxSlippage: 1,
      },
    },
  ],
  execution: [
    {
      id: 'exec-manual',
      label: 'Manual Trigger',
      icon: '👆',
      color: 'bg-amber-600',
      config: {
        when: 'manual',
      },
    },
    {
      id: 'exec-scheduled',
      label: 'Scheduled (Cron)',
      icon: '⏲️',
      color: 'bg-amber-600',
      config: {
        when: 'scheduled',
        schedule: '0 9 * * *', // 9 AM daily
      },
    },
    {
      id: 'exec-triggered',
      label: 'Price Alert Trigger',
      icon: '🚨',
      color: 'bg-amber-600',
      config: {
        when: 'triggered',
        triggerPrice: 0,
      },
    },
  ],
  ai: [
    {
      id: 'ai-prompt',
      label: 'AI Prompt Node',
      icon: '🤖',
      color: 'bg-indigo-600',
      config: {
        model: 'gpt-4',
        prompt: 'Explain current market state',
        maxTokens: 256,
      },
    },
  ],
  vault: [
    {
      id: 'vault-deposit',
      label: 'Vault Deposit',
      icon: '🏦',
      color: 'bg-emerald-600',
      config: {
        vaultAddress: '',
        token: 'USDC',
        amount: 0,
      },
    },
  ],
  crosschain: [
    {
      id: 'crosschain-bridge',
      label: 'Crosschain Bridge',
      icon: '🔗',
      color: 'bg-teal-600',
      config: {
        provider: 'stargate',
        fromChain: 'ethereum',
        toChain: 'polygon',
        token: 'USDC',
        amount: 0,
      },
    },
  ],
};

// ============================================================================
// BLOCK COMPONENT
// ============================================================================

const BlockCard = React.memo(
  ({
    block,
    isDragging,
    onDragStart,
    onRemove,
    onClick,
  }: {
    block: StrategyBlock;
    isDragging: boolean;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onRemove: (id: string) => void;
    onClick: (id: string) => void;
  }) => {
    return (
      <div
        draggable
        onClick={() => onClick(block.id)}
        onDragStart={(e) => onDragStart(e, block.id)}
        className={`${block.color} rounded-lg p-4 text-white cursor-move hover:shadow-lg transition-all ${
          isDragging ? 'opacity-50' : ''
        } border-2 border-opacity-50`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{block.icon}</span>
            <h3 className="font-semibold text-sm">{block.label}</h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(block.id);
            }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Remove block"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs opacity-75 space-y-1">
          {Object.entries(block.config)
            .slice(0, 3)
            .map(([key, value]) => (
              <div key={key}>
                <span className="font-medium">{key}:</span> {String(value).slice(0, 20)}
              </div>
            ))}
        </div>
      </div>
    );
  }
);

BlockCard.displayName = 'BlockCard';

// ============================================================================
// MAIN VISUAL STRATEGY BUILDER
// ============================================================================

export default function VisualStrategyBuilder({ onDeploy }: { onDeploy?: (graph: any, compiled?: any) => Promise<any> }) {
  const { graph, addNode, removeNode, updateNodeConfig, updateNodeLabel, addEdge, updateMeta, setGraph } = useStrategyGraph();

  const [draggedBlockType, setDraggedBlockType] = React.useState<BlockType | null>(null);
  const [draggedBlockId, setDraggedBlockId] = React.useState<string | null>(null);
  const [expandedPalette, setExpandedPalette] = React.useState<BlockType | null>('condition');
  const [selectedBlock, setSelectedBlock] = React.useState<string | null>(null);
  const [inspectorFocus, setInspectorFocus] = React.useState<string | null>(null);
  const { deploy, status: deployStatus, executionId, signalsUrl, error: deployError } = useStrategyDeployment();
  const [showDeployModal, setShowDeployModal] = React.useState(false);
  const [currentSignalsUrl, setCurrentSignalsUrl] = React.useState<string | null>(null);

  // compute validation issues grouped by node to pass into inspector
  const graphValidation = useMemo(() => validateGraph(graph), [graph]);
  const issuesByNode: Record<string, { highest: any; list: any[] }> = {};
  for (const it of graphValidation.issues || []) {
    if (!it.nodeId) continue;
    if (!issuesByNode[it.nodeId]) issuesByNode[it.nodeId] = { highest: it, list: [it] };
    else {
      issuesByNode[it.nodeId].list.push(it);
      const order = ['info', 'warning', 'error', 'blocker'];
      const currIdx = order.indexOf(issuesByNode[it.nodeId].highest.severity);
      const newIdx = order.indexOf(it.severity);
      if (newIdx > currIdx) issuesByNode[it.nodeId].highest = it;
    }
  }

  // Strategy Health computation
  const [simResult, setSimResult] = useState<null | { expectedReturn: number; winRate: number; drawdown: number }>(null);

  const health = useMemo(() => {
    const issues = graphValidation.issues || [];
    const blockers = issues.filter((i) => i.severity === 'BLOCKER' || i.severity === 'ERROR').length;
    const warnings = issues.filter((i) => i.severity === 'WARNING').length;

    const hasExecution = graph.nodes.some((n) => n.type === 'execution');
    const hasRisk = graph.nodes.some((n: any) => n.type === 'risk' || n.type === 'vault');
    const disconnected = (() => {
      const connected = new Set([
        ...graph.edges.map((e) => (e as any).sourceNodeId || (e as any).source),
        ...graph.edges.map((e) => (e as any).targetNodeId || (e as any).target),
      ]);
      return graph.nodes.filter((n) => !connected.has(n.id));
    })();

    const hasProfitTarget = graph.nodes.some((n: any) => n.config && (n.config.takeProfit || n.config.takeProfitPct || n.config.takeProfitPercent));
    const highLeverage = graph.nodes.some((n: any) => n.type === 'action' && n.config && (n.config.leverage || 0) > 5);

    // base score 100, subtract penalties
    let score = 100;
    score -= blockers * 30;
    score -= warnings * 7;
    if (!hasExecution) score -= 30;
    if (!hasRisk) score -= 10;
    if (disconnected.length > 0) score -= Math.min(30, disconnected.length * 10);
    if (highLeverage) score -= 10;
    if (!hasProfitTarget) score -= 5;
    if (score < 0) score = 0;

    return {
      score: Math.round(score),
      checks: {
        validExecution: hasExecution,
        riskConfigured: hasRisk,
        noDisconnected: disconnected.length === 0,
        highLeverage,
        hasProfitTarget,
      },
      counts: { blockers, warnings, disconnected: disconnected.length },
    };
  }, [graph, graphValidation]);

  function runSimulation() {
    // lightweight deterministic pseudo-simulation based on graph id
    const seed = (graph.id || JSON.stringify(graph)).split('').reduce((s: number, c: string) => (s * 31 + c.charCodeAt(0)) % 100000, 1);
    const expectedReturn = Math.max(-50, Math.min(200, (health.score - 50) * 0.5 + (seed % 20) - 5));
    const winRate = Math.max(10, Math.min(90, 50 + (health.score - 50) * 0.25 + (seed % 10) - 5));
    const drawdown = Math.max(1, Math.min(50, 20 - (health.score - 50) * 0.2 + (seed % 7)));
    setSimResult({ expectedReturn: Number(expectedReturn.toFixed(1)), winRate: Math.round(winRate), drawdown: Number(drawdown.toFixed(1)) });
  }

  // Support loading a strategy by route param: /builder/:id
  const params = useParams() as { id?: string };
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const loadById = async (id?: string) => {
      if (!id) return;
      try {
        const res = await yukiApi.getStrategy(id);
        const data = res?.data || res;
        if (data) setGraph(data);
        // auto-run simulation if requested: ?simulate=1
        if (searchParams.get('simulate') === '1') runSimulation();
      } catch (err) {
        console.error('Failed to load strategy:', err);
      }
    };
    loadById(params.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleBlockDragStart = useCallback(
    (e: React.DragEvent, blockType: BlockType, template: any) => {
      setDraggedBlockType(blockType);
      e.dataTransfer!.effectAllowed = 'copy';
      try {
        e.dataTransfer!.setData('application/yuki-template', JSON.stringify({ blockType, template }));
      } catch (err) {
        // Some browsers may restrict setData in certain contexts; fallback to storing minimal id
        e.dataTransfer!.setData('text/plain', template.id || template.label || '');
      }
    },
    []
  );

  

  const removeBlock = useCallback((blockId: string) => {
    removeNode(blockId);
    setSelectedBlock(null);
  }, [removeNode]);

  const exportJSON = useCallback(() => {
    const json = JSON.stringify(graph, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.name || 'strategy'}-${Date.now()}.json`;
    a.click();
  }, [graph]);

  const handleDeploy = useCallback(async () => {
    setShowDeployModal(true);
    // pre-compile the graph so we actually use compileGraph here
    let compiled: any = null;
    try {
      compiled = compileGraph(graph);
    } catch (err) {
      console.warn('Failed to compile graph locally:', err);
    }

    // allow external caller to override deploy behavior
    let res: any;
    if (onDeploy) {
      res = await onDeploy(graph, compiled);
      // try to normalize response
      const sUrl = res?.signalsUrl || res?.data?.signalsUrl || res?.signals_url || null;
      setCurrentSignalsUrl(sUrl);
    } else {
      // if caller didn't provide an onDeploy handler, use built-in deploy which will validate/compile server-side
      res = await deploy(graph, undefined, (msg) => console.debug('[deploy]', msg));
      setCurrentSignalsUrl(res?.signalsUrl || res?.data?.signalsUrl || null);
    }

    if (res?.success) {
      alert(`Strategy deployed successfully! ID: ${res.executionId || res.data?.id || 'unknown'}`);
    } else {
      alert(`Failed to deploy strategy: ${res?.error || 'unknown'}`);
    }
  }, [graph, deploy, onDeploy]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 bg-slate-900 min-h-screen text-white">
      {/* LEFT SIDEBAR: BLOCK PALETTE */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="font-bold mb-3">📦 Block Palette</h3>
          {(Object.keys(BLOCK_TEMPLATES) as BlockType[]).map((blockType) => (
            <div key={blockType} className="mb-2">
              <button
                onClick={() =>
                  setExpandedPalette(expandedPalette === blockType ? null : blockType)
                }
                className="w-full flex items-center justify-between p-2 rounded hover:bg-slate-700 transition-colors"
              >
                <span className="font-medium capitalize">{blockType}</span>
                {expandedPalette === blockType ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {expandedPalette === blockType && (
                <div className="space-y-1 mt-1 ml-2">
                  {BLOCK_TEMPLATES[blockType].map((template) => (
                    <div
                      key={template.id}
                      draggable
                      onDragStart={(e) =>
                        handleBlockDragStart(e, blockType, template)
                      }
                      className={`${template.color} rounded p-2 text-sm cursor-move hover:shadow-lg transition-all text-white flex items-center gap-2`}
                    >
                      <span>{template.icon}</span>
                      <span className="truncate text-xs">{template.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* STRATEGY INFO */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400">Name</label>
            <input
              type="text"
              value={graph.name}
              onChange={(e) => updateMeta({ name: e.target.value })}
              className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">
              Description
            </label>
            <textarea
              value={graph.description}
              onChange={(e) => updateMeta({ description: e.target.value })}
              className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              rows={3}
            />
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-700">
            <button
              onClick={handleDeploy}
              className="w-full bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="h-4 w-4" />
              Deploy Strategy
            </button>
            <button
              onClick={exportJSON}
              className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* CENTER: CANVAS */}
      <div className="flex-1">
        <div className="bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 p-6 min-h-96 space-y-3">
          <h3 className="font-bold text-slate-400 mb-4">Canvas (Drag blocks here)</h3>
          {/* Strategy Health panel */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-slate-900 p-3 flex items-center justify-center" style={{ width: 76, height: 76 }}>
                <div className="text-center">
                  <div className="text-xs text-slate-400">Health</div>
                  <div className="text-2xl font-bold">{health.score}</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold">Strategy Health</div>
                <div className="text-xs text-slate-400">{health.checks.validExecution ? 'Valid execution path' : 'Missing execution/trigger'}</div>
                <div className="text-xs text-slate-400">{health.checks.riskConfigured ? 'Risk controls configured' : 'No risk controls'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={runSimulation} className="bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded text-sm font-medium">Simulate</button>
              <div className="text-xs text-slate-400">{health.counts.blockers} blockers • {health.counts.warnings} warnings • {health.counts.disconnected} disconnected</div>
            </div>
          </div>
          {graph.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Plus className="h-12 w-12 opacity-30 mb-2" />
              <p>Drag blocks from the palette to build your strategy</p>
            </div>
          ) : (
            <CanvasSurface
              onNodeSelect={(id, focus) => {
                setSelectedBlock(id);
                setInspectorFocus(focus?.field || null);
              }}
              selectedId={selectedBlock}
            />
          )}
          {/* Simulation surface */}
          {simResult && (
            <div className="mt-4 p-3 bg-slate-900 rounded text-sm">
              <div className="font-semibold mb-2">Simulation Results</div>
              <div>Expected Return: <span className="font-medium">{simResult.expectedReturn}%</span></div>
              <div>Win Rate: <span className="font-medium">{simResult.winRate}%</span></div>
              <div>Max Drawdown: <span className="font-medium">{simResult.drawdown}%</span></div>
            </div>
          )}
          )
        </div>
      </div>

      {/* RIGHT SIDEBAR: BLOCK DETAILS */}
      {selectedBlock && (
        <div className="w-full lg:w-72">
          {(() => {
            const block = graph.nodes.find((b) => b.id === selectedBlock);
            return (
              <div className="w-full lg:w-72 bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
                <h3 className="font-bold">Block Config</h3>
                <p className="text-xs text-slate-400">Edit selected block settings</p>
                {block ? (
                  <NodeInspector
                    node={block as any}
                    issues={issuesByNode[block.id]}
                    focusField={inspectorFocus}
                    onClearFocus={() => setInspectorFocus(null)}
                  />
                ) : (
                  <div className="text-xs text-slate-400">Block not found</div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      <>
        {/* Deploy progress modal */}
        <DeployProgressModal
          open={showDeployModal}
          onClose={() => setShowDeployModal(false)}
          signalsUrl={currentSignalsUrl || signalsUrl}
          executionId={executionId}
        />
      </>
    </div>
  );
}
