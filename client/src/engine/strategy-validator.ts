import { StrategyGraph } from '../models/StrategyGraph';

export enum ValidationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  BLOCKER = 'BLOCKER',
}

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  nodeId?: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[]; // legacy
  warnings: string[]; // legacy
  issues?: ValidationIssue[];
}

export function validateGraph(graph: StrategyGraph): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: ValidationIssue[] = [];

  const types = new Set(graph.nodes.map((n) => n.type));
  if (!types.has('execution')) {
    errors.push('Strategy needs a trigger (when does it run?)');
    issues.push({ severity: ValidationSeverity.BLOCKER, message: 'Missing execution/trigger node' });
  }
  if (!types.has('action')) {
    errors.push('Strategy needs an action (what does it do?)');
    issues.push({ severity: ValidationSeverity.BLOCKER, message: 'Missing action node' });
  }
  if (!types.has('risk')) {
    warnings.push('No risk controls — consider adding stop loss');
    issues.push({ severity: ValidationSeverity.WARNING, message: 'No risk controls configured' });
  }

  if (graph.nodes.length > 1) {
    const connected = new Set([
      ...graph.edges.map((e) => (e as any).sourceNodeId || (e as any).source),
      ...graph.edges.map((e) => (e as any).targetNodeId || (e as any).target),
    ]);
    const dangling = graph.nodes.filter((n) => !connected.has(n.id));
    if (dangling.length > 0) {
      const msg = `Disconnected blocks: ${dangling.map((n) => n.label).join(', ')}`;
      errors.push(msg);
      // create per-node issues so the UI can highlight each disconnected node
      for (const n of dangling) {
        issues.push({ severity: ValidationSeverity.ERROR, message: `Disconnected block: ${n.label}`, nodeId: n.id });
      }
    }
  }

  if (hasCycle(graph)) {
    const msg = 'Strategy contains a loop — execution would never terminate';
    errors.push(msg);
    issues.push({ severity: ValidationSeverity.BLOCKER, message: msg });
  }

  return { valid: errors.length === 0, errors, warnings, issues };
}

function hasCycle(graph: StrategyGraph): boolean {
  const adj = new Map<string, string[]>();
  graph.nodes.forEach((n) => adj.set(n.id, []));
  graph.edges.forEach((e) => adj.get((e as any).sourceNodeId || (e as any).source)?.push((e as any).targetNodeId || (e as any).target));

  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    stack.add(nodeId);
    for (const neighbor of adj.get(nodeId) || []) {
      if (!visited.has(neighbor) && dfs(neighbor)) return true;
      if (stack.has(neighbor)) return true;
    }
    stack.delete(nodeId);
    return false;
  }

  return graph.nodes.some((n) => !visited.has(n.id) && dfs(n.id));
}
