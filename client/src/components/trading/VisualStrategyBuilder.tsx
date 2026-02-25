/**
 * Yuki Visual Strategy Builder
 * 
 * Drag-and-drop interface for non-technical users to build trading strategies
 * without code. Technical users can inspect/export generated strategy JSON.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, Play, RotateCcw, ChevronDown, ChevronUp, Download } from 'lucide-react';
import * as yukiApi from '../../api/yukiApi';

// ============================================================================
// TYPES
// ============================================================================

export type BlockType = 'condition' | 'action' | 'logic' | 'risk' | 'execution';
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
        type: 'hourly' | 'daily' | 'weekly',
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
        amountType: 'fixed' | 'percentage',
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
        orderType: 'market' | 'limit',
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
        orderType: 'market' | 'limit',
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
        provider: 'stargate' | 'layerzero',
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
        channel: 'email' | 'sms' | 'slack' | 'webhook',
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
        type: 'percent' | 'fixed',
      },
    },
    {
      id: 'risk-takeprofit',
      label: 'Take Profit',
      icon: '🎯',
      color: 'bg-red-600',
      config: {
        takeProfit: 10,
        type: 'percent' | 'fixed',
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
  }: {
    block: StrategyBlock;
    isDragging: boolean;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onRemove: (id: string) => void;
  }) => {
    return (
      <div
        draggable
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
            onClick={() => onRemove(block.id)}
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

export default function VisualStrategyBuilder() {
  const [strategy, setStrategy] = useState<Strategy>({
    id: 'strategy-' + Date.now(),
    name: 'New Strategy',
    description: '',
    blocks: [],
    riskControls: { maxLoss: 10, maxDrawdown: 20, dailyTradeLimit: 5 },
    isActive: false,
    createdAt: new Date().toISOString(),
  });

  const [draggedBlockType, setDraggedBlockType] = useState<BlockType | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [expandedPalette, setExpandedPalette] = useState<BlockType | null>('condition');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  const handleBlockDragStart = useCallback(
    (e: React.DragEvent, blockType: BlockType, template: any) => {
      setDraggedBlockType(blockType);
      e.dataTransfer!.effectAllowed = 'copy';
    },
    []
  );

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent, blockType: BlockType, template: any) => {
      e.preventDefault();
      const newBlock: StrategyBlock = {
        id: 'block-' + Date.now(),
        type: blockType,
        label: template.label,
        icon: template.icon,
        color: template.color,
        config: { ...template.config },
        inputs: [],
        outputs: [],
      };
      setStrategy((prev) => ({
        ...prev,
        blocks: [...prev.blocks, newBlock],
      }));
      setDraggedBlockType(null);
    },
    []
  );

  const removeBlock = useCallback((blockId: string) => {
    setStrategy((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== blockId),
    }));
    setSelectedBlock(null);
  }, []);

  const exportJSON = useCallback(() => {
    const json = JSON.stringify(strategy, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategy.name || 'strategy'}-${Date.now()}.json`;
    a.click();
  }, [strategy]);

  const handleDeploy = useCallback(async () => {
    try {
      console.log('Deploying strategy:', strategy);
      const result = await yukiApi.deployStrategy({
        name: strategy.name,
        description: strategy.description,
        blocks: strategy.blocks,
        riskControls: strategy.riskControls,
      });
      alert(`Strategy deployed successfully! ID: ${result.id}`);
    } catch (err) {
      console.error('Failed to deploy strategy:', err);
      alert('Failed to deploy strategy');
    }
  }, [strategy]);

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
              value={strategy.name}
              onChange={(e) =>
                setStrategy((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">
              Description
            </label>
            <textarea
              value={strategy.description}
              onChange={(e) =>
                setStrategy((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
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
        <div
          onDragOver={handleCanvasDragOver}
          className="bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 p-6 min-h-96 space-y-3"
        >
          <h3 className="font-bold text-slate-400 mb-4">Canvas (Drag blocks here)</h3>
          {strategy.blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Plus className="h-12 w-12 opacity-30 mb-2" />
              <p>Drag blocks from the palette to build your strategy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {strategy.blocks.map((block, index) => (
                <div key={block.id}>
                  <BlockCard
                    block={block}
                    isDragging={draggedBlockId === block.id}
                    onDragStart={(e, id) => setDraggedBlockId(id)}
                    onRemove={removeBlock}
                  />
                  {index < strategy.blocks.length - 1 && (
                    <div className="flex justify-center py-1">
                      <div className="text-slate-500 text-lg">↓</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: BLOCK DETAILS */}
      {selectedBlock && (
        <div className="w-full lg:w-72 bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
          <h3 className="font-bold">Block Config</h3>
          <p className="text-xs text-slate-400">Edit selected block settings</p>
          {/* Config editor renders based on block type */}
          <button
            onClick={() => setSelectedBlock(null)}
            className="w-full px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
