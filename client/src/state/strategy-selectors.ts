import { StrategyGraph } from '../models/StrategyGraph';

export function getRootNodes(graph: StrategyGraph) {
  const targets = new Set(graph.edges.map((e) => e.targetNodeId || (e as any).target));
  return graph.nodes.filter((n) => !targets.has(n.id));
}

export function getLeafNodes(graph: StrategyGraph) {
  const sources = new Set(graph.edges.map((e) => e.sourceNodeId || (e as any).source));
  return graph.nodes.filter((n) => !sources.has(n.id));
}

export function getExecutionNodes(graph: StrategyGraph) {
  return graph.nodes.filter((n) => n.type === 'execution');
}

export function getDisconnectedNodes(graph: StrategyGraph) {
  const connected = new Set([...graph.edges.map((e) => e.sourceNodeId || (e as any).source), ...graph.edges.map((e) => e.targetNodeId || (e as any).target)]);
  return graph.nodes.filter((n) => !connected.has(n.id));
}

export function getRiskNodes(graph: StrategyGraph) {
  return graph.nodes.filter((n) => n.type === 'risk');
}
