import { StrategyGraph } from '../models/StrategyGraph';
import { StrategyNode } from '../models/StrategyNode';

export interface IRNode {
  id: string;
  type: string;
  label: string;
  config: any;
  ports: { id: string; name?: string; direction: 'in' | 'out' }[];
}

export interface IRGraph {
  id: string;
  name: string;
  nodes: IRNode[];
  edges: { sourceId: string; sourcePortId?: string; targetId: string; targetPortId?: string }[];
  metadata: any;
}

export function graphToIR(graph: StrategyGraph): IRGraph {
  const nodes: IRNode[] = graph.nodes.map((n: StrategyNode) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    config: (n as any).config,
    ports: (n as any).ports || [],
  }));

  const edges = graph.edges.map((e) => ({
    sourceId: (e as any).sourceNodeId || (e as any).source,
    sourcePortId: (e as any).sourcePortId,
    targetId: (e as any).targetNodeId || (e as any).target,
    targetPortId: (e as any).targetPortId,
  }));

  return { id: graph.id, name: graph.name, nodes, edges, metadata: graph.metadata };
}
