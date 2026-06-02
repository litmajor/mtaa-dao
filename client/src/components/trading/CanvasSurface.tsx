import React, { useCallback, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, addEdge, Connection, Edge, Node, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import useStrategyGraph from '../../state/strategy-graph.store';
import * as yukiApi from '../../api/yukiApi';
import { validateGraph, ValidationSeverity } from '../../engine/strategy-validator';

export default function CanvasSurface({ onNodeSelect, selectedId }: { onNodeSelect?: (id: string, focus?: any) => void; selectedId?: string | null }) {
  const { graph, updateNodeConfig, updateNodeLabel, addEdge, setGraph, addNode } = useStrategyGraph();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rfInstance, setRfInstance] = useState<any>(null);

  const nodes: Node[] = useMemo(() => {
    // run validation and map issues to nodes
    const validation = validateGraph(graph);
    const issues = validation.issues || [];
    const issuesByNode: Record<string, { highest: any; list: any[] }> = {};
    for (const it of issues) {
      if (!it.nodeId) continue;
      if (!issuesByNode[it.nodeId]) issuesByNode[it.nodeId] = { highest: it, list: [it] };
      else {
        issuesByNode[it.nodeId].list.push(it);
        // decide highest severity
        const order = [ValidationSeverity.INFO, ValidationSeverity.WARNING, ValidationSeverity.ERROR, ValidationSeverity.BLOCKER];
        const currIdx = order.indexOf(issuesByNode[it.nodeId].highest.severity);
        const newIdx = order.indexOf(it.severity);
        if (newIdx > currIdx) issuesByNode[it.nodeId].highest = it;
      }
    }

    return graph.nodes.map((n: any) => {
      const isSelected = (selectedId && selectedId === n.id) || false;
      const nodeIssues = issuesByNode[n.id];
      // determine badge
      let badge = null;
      let tooltip = '';
      if (nodeIssues) {
        const sev = nodeIssues.highest.severity;
        tooltip = nodeIssues.list.map((x: any) => x.message).join('\n');
        if (sev === ValidationSeverity.BLOCKER || sev === ValidationSeverity.ERROR) badge = '🔴';
        else if (sev === ValidationSeverity.WARNING) badge = '🟡';
        else badge = '🟢';
      } else {
        badge = '🟢';
      }

      const labelEl = (
        <div title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              // clicking badge should open inspector focused on first issue field when available
              if (nodeIssues && onNodeSelect) {
                const first = nodeIssues.list[0];
                onNodeSelect(n.id, { field: first?.field, issueIndex: 0 });
                return;
              }
              if (onNodeSelect) onNodeSelect(n.id);
            }}
            style={{ fontSize: 14, cursor: 'pointer' }}
            role="button"
            aria-label={`Open inspector for ${n.label}`}
          >
            {badge}
          </span>
          <div style={{ display: 'inline-block', fontSize: 13 }}>{n.label}</div>
        </div>
      );

      return {
        id: n.id,
        position: n.position || { x: Math.random() * 400, y: Math.random() * 400 },
        data: { label: labelEl, node: n },
        style: {
          background: isSelected ? '#071133' : '#0f172a',
          color: '#fff',
          border: nodeIssues ? (nodeIssues.highest.severity === ValidationSeverity.ERROR || nodeIssues.highest.severity === ValidationSeverity.BLOCKER ? '2px solid #f43f5e' : '2px solid #f59e0b') : (isSelected ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.06)'),
          padding: 10,
          boxShadow: isSelected ? '0 8px 20px rgba(96,165,250,0.12)' : undefined,
        },
      } as Node;
    });
  }, [graph.nodes]);

  // global validation summary for banner
  const globalValidation = useMemo(() => validateGraph(graph), [graph]);
  const blockerCount = (globalValidation.issues || []).filter((i: any) => i.severity === ValidationSeverity.BLOCKER).length;
  const errorCount = (globalValidation.issues || []).filter((i: any) => i.severity === ValidationSeverity.ERROR).length;
  const warningCount = (globalValidation.issues || []).filter((i: any) => i.severity === ValidationSeverity.WARNING).length;

  const edges: Edge[] = useMemo(() => {
    return graph.edges.map((e: any) => {
      const source = e.sourceNodeId || e.source;
      const target = e.targetNodeId || e.target;
      let label = e.label;
      // If no explicit label, try to use the source port name for human-readable branch labels
      if (!label && e.sourcePortId) {
        const srcNode = graph.nodes.find((n: any) => n.id === source);
        const port = srcNode?.ports?.find((p: any) => p.id === e.sourcePortId);
        if (port && port.name) label = port.name;
      }

      return {
        id: e.id,
         source,
        target,
        label,
      };
    });
  }, [graph.edges]);

  const onConnect = useCallback((connection: Connection) => {
    const sourceNodeId = connection.source!;
    const targetNodeId = connection.target!;
    const sourcePortId = connection.sourceHandle || undefined;
    const targetPortId = connection.targetHandle || undefined;
    addEdge(sourceNodeId, sourcePortId, targetNodeId, targetPortId);
  }, [addEdge]);

  const onNodesChange = useCallback((changes: any[]) => {
    // apply react-flow changes and sync back to graph store
    const currentNodes: Node[] = nodes;
    const updated = applyNodeChanges(changes as any, currentNodes as any);
    // map updated positions back into graph
    const newNodes = graph.nodes.map((n) => {
      const updatedNode = updated.find((un) => un.id === n.id);
      if (!updatedNode) return n;
      return { ...n, position: updatedNode.position || n.position };
    });

    const newGraph = { ...graph, nodes: newNodes };
    setGraph(newGraph);

    // debounce save of graph layout
    if ((CanvasSurface as any)._saveTimeout) clearTimeout((CanvasSurface as any)._saveTimeout);
    (CanvasSurface as any)._saveTimeout = setTimeout(async () => {
      try {
        await yukiApi.saveGraph(newGraph);
      } catch (err) {
        console.error('Failed to persist graph layout:', err);
      }
    }, 1000);
  }, [graph, setGraph, nodes]);

  const onInit = useCallback((instance: any) => {
    setRfInstance(instance);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!rfInstance) return;
    let payload = null as null | { blockType: string; template: any };
    try {
      const raw = e.dataTransfer!.getData('application/yuki-template');
      if (raw) payload = JSON.parse(raw);
    } catch (err) {
      const raw = e.dataTransfer!.getData('text/plain');
      if (raw) payload = { blockType: 'condition', template: { id: raw, label: raw, icon: '▪', color: 'bg-slate-600', config: {} } };
    }
    if (!payload) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const flowPos = rfInstance.project(pos);
    addNode({ ...payload.template, type: payload.blockType }, flowPos);
  }, [rfInstance, addNode]);

  const onNodeClick = useCallback((event: any, node: Node) => {
    if (onNodeSelect) onNodeSelect(node.id as string);
  }, [onNodeSelect]);

  const firstCritical = (globalValidation.issues || []).find((i: any) => i.severity === ValidationSeverity.BLOCKER || i.severity === ValidationSeverity.ERROR || i.severity === ValidationSeverity.WARNING);

  return (
    <div ref={containerRef} onDrop={handleDrop} onDragOver={handleDragOver} className="w-full h-[600px] rounded-lg border border-slate-700 overflow-hidden">
      {/* Global validation banner */}
      {(blockerCount > 0 || errorCount > 0 || warningCount > 0) && (
        <div
          onClick={() => {
            if (firstCritical && onNodeSelect && firstCritical.nodeId) onNodeSelect(firstCritical.nodeId, { field: firstCritical.field });
          }}
          className={`w-full p-2 text-sm font-semibold cursor-pointer ${blockerCount > 0 ? 'bg-red-700 text-white' : errorCount > 0 ? 'bg-rose-600 text-white' : 'bg-yellow-600 text-black'}`}
          title={`${blockerCount} blockers, ${errorCount} errors, ${warningCount} warnings`}
        >
          {blockerCount > 0 ? `🛑 ${blockerCount} blocking issues` : errorCount > 0 ? `❗ ${errorCount} errors` : `⚠️ ${warningCount} warnings`}
        </div>
      )}

      <ReactFlow nodes={nodes} edges={edges} onConnect={onConnect} onNodesChange={onNodesChange} onInit={onInit} onNodeClick={onNodeClick} fitView>
        <Background gap={16} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
