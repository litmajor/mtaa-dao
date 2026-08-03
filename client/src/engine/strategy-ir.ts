import type { StrategyGraph } from '../models/StrategyGraph';
import type { StrategyNode } from '../models/StrategyNode';

export interface IRNode {
  id: string;
  type: StrategyNode['type'];
  label: string;
  config: StrategyNode['config'];
  ports: StrategyNode['ports'];
}

export interface IRGraph {
  id: string;
  name: string;
  nodes: IRNode[];
  edges: Array<{
    sourceId: string;
    sourcePortId?: string;
    targetId: string;
    targetPortId?: string;
  }>;
  metadata: StrategyGraph['metadata'];
}

export function graphToIR(graph: StrategyGraph): IRGraph {
  const nodes: IRNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    config: n.config,
    ports: n.ports || [],
  }));

  const edges = graph.edges.map((e) => ({
    sourceId: e.sourceNodeId || e.source || '',
    sourcePortId: e.sourcePortId,
    targetId: e.targetNodeId || e.target || '',
    targetPortId: e.targetPortId,
  }));

  return { id: graph.id, name: graph.name, nodes, edges, metadata: graph.metadata };
}
