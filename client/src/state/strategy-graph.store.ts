import { useCallback, useState } from 'react';
import { StrategyGraph, emptyGraph } from '../models/StrategyGraph';
import { StrategyNode, Port } from '../models/StrategyNode';
import { StrategyEdge } from '../models/StrategyEdge';

type BlockTemplate = any;

function defaultPortsForType(type: string): Port[] {
  switch (type) {
    case 'condition':
      return [
        { id: 'in', name: 'in', direction: 'in' },
        { id: 'true', name: 'true', direction: 'out' },
        { id: 'false', name: 'false', direction: 'out' },
      ];
    case 'execution':
      return [{ id: 'out', name: 'out', direction: 'out' }];
    default:
      return [
        { id: 'in', name: 'in', direction: 'in' },
        { id: 'out', name: 'out', direction: 'out' },
      ];
  }
}

function fromTemplate(template: BlockTemplate): Partial<StrategyNode> {
  const type = template.type || 'condition';
  return {
    type,
    label: template.label || template.id || 'block',
    icon: template.icon || '▪',
    color: template.color || 'bg-slate-600',
    // config left as-is; typed nodes will accept proper shapes
    config: { ...(template.config || {}) },
    ports: template.ports || defaultPortsForType(type),
  } as Partial<StrategyNode>;
}

export function useStrategyGraph() {
  const [graph, setGraph] = useState<StrategyGraph>(emptyGraph());

  const addNode = useCallback((template: BlockTemplate, position?: { x: number; y: number }) => {
    const node: StrategyNode = {
      ...(fromTemplate(template) as StrategyNode),
      id: 'node-' + Date.now(),
      position: position || { x: 0, y: 0 },
    } as StrategyNode;

    setGraph((prev) => {
      const tail = prev.nodes[prev.nodes.length - 1];
      const edge: StrategyEdge | null = tail
        ? {
            id: `edge-${tail.id}-${node.id}`,
            sourceNodeId: tail.id,
            source: tail.id,
            sourcePortId: (tail.ports && tail.ports.find((p) => p.direction === 'out')?.id) || undefined,
            targetNodeId: node.id,
            target: node.id,
            targetPortId: (node.ports && node.ports.find((p) => p.direction === 'in')?.id) || undefined,
          }
        : null;

      return {
        ...prev,
        nodes: [...prev.nodes, node],
        edges: edge ? [...prev.edges, edge] : prev.edges,
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString(), version: prev.metadata.version + 1 },
      };
    });
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString(), version: prev.metadata.version + 1 },
    }));
  }, []);

  const updateNodeConfig = useCallback((nodeId: string, patch: Record<string, any>) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, config: { ...(n as any).config, ...patch } } : n)),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
  }, []);

  const updateNodeLabel = useCallback((nodeId: string, label: string) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, label } : n)),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
  }, []);

  const addEdge = useCallback((sourceNodeId: string, sourcePortId: string | undefined, targetNodeId: string, targetPortId: string | undefined) => {
    const edge: StrategyEdge = {
      id: `edge-${sourceNodeId}-${sourcePortId || 'out'}-${targetNodeId}-${targetPortId || 'in'}`,
      sourceNodeId,
      source: sourceNodeId,
      sourcePortId,
      targetNodeId,
      target: targetNodeId,
      targetPortId,
    };
    setGraph((prev) => ({ ...prev, edges: [...prev.edges, edge], metadata: { ...prev.metadata, updatedAt: new Date().toISOString(), version: prev.metadata.version + 1 } }));
  }, []);

  const updateMeta = useCallback((patch: Partial<StrategyGraph>) => {
    setGraph((prev) => ({ ...prev, ...patch, metadata: { ...prev.metadata, updatedAt: new Date().toISOString(), ...(patch.metadata || {}) } }));
  }, []);

  return { graph, addNode, removeNode, updateNodeConfig, updateNodeLabel, addEdge, updateMeta, setGraph };
}

export default useStrategyGraph;
