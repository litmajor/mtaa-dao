import { StrategyNode } from './StrategyNode';
import { StrategyEdge } from './StrategyEdge';

export interface RiskControls {
  maxLoss: number;
  maxDrawdown: number;
  dailyTradeLimit: number;
}

export interface GraphMetadata {
  version: number;
  createdAt: string;
  updatedAt: string;
  authorId?: string;
  compilerVersion?: string;
}

export interface StrategyGraph {
  id: string;
  name: string;
  description: string;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  riskControls: RiskControls;
  isActive: boolean;
  metadata: GraphMetadata;
}

export function emptyGraph(): StrategyGraph {
  const now = new Date().toISOString();
  return {
    id: 'graph-' + Date.now(),
    name: 'New Strategy',
    description: '',
    nodes: [],
    edges: [],
    riskControls: { maxLoss: 10, maxDrawdown: 20, dailyTradeLimit: 5 },
    isActive: false,
    metadata: { version: 1, createdAt: now, updatedAt: now, compilerVersion: '0.0.1' },
  };
}

export default StrategyGraph;
