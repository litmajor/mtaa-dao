import type { StrategyGraph } from '../models/StrategyGraph';
import type { StrategyEdge } from '../models/StrategyEdge';
import { graphToIR } from './strategy-ir';
import type { IRGraph } from './strategy-ir';
import NodeRegistry from '../state/node-registry';
import type { StrategyNode } from '../models/StrategyNode';

export interface CompiledNode {
  id: string;
  type: string;
  config: StrategyNode['config'];
  // `next` may be a single node or branching map keyed by port/label
  next?: CompiledNode | { branches: Record<string, CompiledNode> } | null;
}

export interface CompiledStrategy {
  id: string;
  name: string;
  execution: CompiledNode;
  riskControls: StrategyGraph['riskControls'];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    compiledAt: string;
  };
}

interface NormalizedNode {
  id: string;
  type: string;
  config: StrategyNode['config'];
  ports: StrategyNode['ports'];
  outputs: Array<{ targetId: string; sourcePortId?: string; targetPortId?: string }>;
}

function topologicalSort(graph: StrategyGraph) {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  graph.nodes.forEach((n) => {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  graph.edges.forEach((e) => {
    const t = e.targetNodeId ?? e.target;
    const s = e.sourceNodeId ?? e.source;
    if (!t || !s) return;

    indeg.set(t, (indeg.get(t) || 0) + 1);
    adj.get(s)?.push(t);
  });

  const q: string[] = [];
  for (const [k, v] of indeg.entries()) if (v === 0) q.push(k);

  const order: string[] = [];
  while (q.length > 0) {
    const n = q.shift()!;
    order.push(n);
    for (const nei of adj.get(n) || []) {
      indeg.set(nei, (indeg.get(nei) || 0) - 1);
      if (indeg.get(nei) === 0) q.push(nei);
    }
  }

  return order
    .map((id) => graph.nodes.find((n) => n.id === id))
    .filter((n): n is StrategyNode => Boolean(n));
}

function buildExecutionTree(entryNode: StrategyNode, graph: StrategyGraph): CompiledNode {
  const visited = new Set<string>();
  function build(nodeId: string): CompiledNode {
    const node = graph.nodes.find((n) => n.id === nodeId)!;
    visited.add(nodeId);
    const outs = graph.edges
      .filter((e) => e.sourceNodeId === nodeId)
      .map((e) => e.targetNodeId);
    const next = outs.length > 0 ? build(outs[0]) : null;
    // Use node-level compiler if available in the registry
    const entry = NodeRegistry[node.type];
    if (entry && entry.compiler) {
      const compiledFragment = entry.compiler(node);
      compiledFragment.next = next;
      return compiledFragment;
    }

    return { id: node.id, type: node.type, config: node.config, next };
  }
  return build(entryNode.id);
}

export function compileGraph(graph: StrategyGraph): CompiledStrategy {
  // Convert to IR first (keeps surface for later IR transformations)
  const ir: IRGraph = graphToIR(graph);

  // Build compiled fragments per node using registry compilers (normalized IR fragments)
  const compiledFragments: Record<string, CompiledNode> = {};
  for (const node of graph.nodes) {
    const entry = NodeRegistry[node.type];
    if (entry && entry.compiler) {
      compiledFragments[node.id] = entry.compiler(node);
    } else {
      compiledFragments[node.id] = { id: node.id, type: node.type, config: node.config };
    }
  }

  const sorted = topologicalSort(graph);

  const incoming = new Set(
    graph.edges
      .map((e) => e.targetNodeId ?? e.target)
      .filter((value): value is string => Boolean(value))
  );
  const entryNode = sorted.find((n) => n.type === 'execution' && !incoming.has(n.id));
  if (!entryNode) throw new Error('No execution entry point found');

  // assemble final compiled strategy by normalizing compiled fragments into a strict IR and linking next pointers
  const normalized = normalizeCompiledFragments(compiledFragments, ir);
  const executionRoot = buildExecutionFromNormalized(entryNode.id, normalized);
  // if executionRoot uses raw nodes produce compiled fragment here (already handled in build)
  return {
    id: graph.id,
    name: graph.name,
    execution: executionRoot,
    riskControls: graph.riskControls,
    metadata: { nodeCount: graph.nodes.length, edgeCount: graph.edges.length, compiledAt: new Date().toISOString() },
  };
}

// Normalize compiled fragments into a strict StrategyIR shape
export function normalizeCompiledFragments(compiledFragments: Record<string, CompiledNode>, ir: IRGraph) {
  const normalized: Record<string, NormalizedNode> = {};

  // initialize nodes
  for (const n of ir.nodes) {
    normalized[n.id] = {
      id: n.id,
      type: n.type,
      config: compiledFragments[n.id]?.config ?? n.config,
      ports: n.ports ?? [],
      outputs: [],
    };
  }

  // populate outputs using IR edges (preserve port info for branching)
  for (const e of ir.edges) {
    const src = e.sourceId;
    const tgt = e.targetId;
    if (normalized[src]) {
      normalized[src].outputs.push({ targetId: tgt, sourcePortId: e.sourcePortId, targetPortId: e.targetPortId });
    }
  }

  return normalized;
}

// Build a compiled execution tree from normalized IR
function buildExecutionFromNormalized(entryId: string, normalized: Record<string, NormalizedNode>, visited = new Set<string>()): CompiledNode {
  if (visited.has(entryId)) return { id: entryId, type: normalized[entryId].type, config: normalized[entryId].config, next: null };
  visited.add(entryId);
  const node = normalized[entryId];

  if (!node.outputs || node.outputs.length === 0) {
    return { id: node.id, type: node.type, config: node.config, next: null };
  }

  if (node.outputs.length === 1) {
    const nextId = node.outputs[0].targetId;
    const next = buildExecutionFromNormalized(nextId, normalized, visited);
    return { id: node.id, type: node.type, config: node.config, next };
  }

  // Branching: group outputs by sourcePortId (fall back to index keys)
  const branches: Record<string, CompiledNode> = {};
  node.outputs.forEach((o, idx) => {
    const key = o.sourcePortId || `out_${idx}`;
    branches[key] = buildExecutionFromNormalized(o.targetId, normalized, visited);
  });

  return { id: node.id, type: node.type, config: node.config, next: { branches } };
}
