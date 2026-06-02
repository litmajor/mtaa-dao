import React from 'react';

interface MiniGraphProps {
  size?: number;
  graph?: { nodes?: Array<any>; edges?: Array<any> } | null;
}

// Renders a small SVG preview of a strategy graph. If `graph` is not provided,
// falls back to a tiny static three-node flow.
export default function MiniGraph({ size = 200, graph = null }: MiniGraphProps) {
  const w = size;
  const h = 64;
  const nodeRadius = 6;
  const padding = 8;

  // If graph provided, compute bounding box and scale nodes into thumbnail
  let nodesToRender: Array<any> = [];
  let edgesToRender: Array<any> = [];

  if (graph && graph.nodes && graph.nodes.length > 0) {
    // normalize positions if available, otherwise layout linearly
    const hasPos = graph.nodes.every((n: any) => n.position && typeof n.position.x === 'number');
    if (hasPos) {
      const xs = graph.nodes.map((n: any) => n.position.x);
      const ys = graph.nodes.map((n: any) => n.position.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const scaleX = (w - padding * 2) / Math.max(1, maxX - minX);
      const scaleY = (h - padding * 2) / Math.max(1, maxY - minY);
      nodesToRender = graph.nodes.map((n: any) => ({
        id: n.id,
        x: padding + (n.position.x - minX) * scaleX,
        y: padding + (n.position.y - minY) * scaleY,
        label: (n.label || n.type || '●').toString().slice(0, 1),
      }));
    } else {
      // spread nodes horizontally
      const step = (w - padding * 2) / Math.max(1, graph.nodes.length - 1);
      nodesToRender = graph.nodes.map((n: any, i: number) => ({ id: n.id, x: padding + i * step, y: h / 2, label: (n.label || n.type || '●').toString().slice(0, 1) }));
    }

    // edges
    edgesToRender = (graph.edges || []).map((e: any) => {
      const sourceId = e.sourceNodeId || e.source;
      const targetId = e.targetNodeId || e.target;
      return { source: sourceId, target: targetId };
    });
  } else {
    // fallback static nodes
    nodesToRender = [
      { id: 't', x: padding + 12, y: h / 2, label: 'T' },
      { id: 'c', x: w / 2 - 10, y: h / 2, label: 'C' },
      { id: 'a', x: w - padding - 24, y: h / 2, label: 'A' },
    ];
    edgesToRender = [ { source: 't', target: 'c' }, { source: 'c', target: 'a' } ];
  }

  // helper to find node coords
  const findNode = (id: string) => nodesToRender.find((n) => n.id === id) || { x: w/2, y: h/2 };

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="rounded bg-slate-900/20">
      <defs>
        <marker id="mini-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L6,3 L0,6 L2,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      {edgesToRender.map((ed, i) => {
        const s = findNode(ed.source);
        const t = findNode(ed.target);
        return (
          <line key={i} x1={s.x + nodeRadius} y1={s.y} x2={t.x - nodeRadius} y2={t.y} stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#mini-arrow)" />
        );
      })}
      {nodesToRender.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={nodeRadius} fill="#0ea5a6" />
          <text x={n.x} y={n.y + 3} fontSize={8} textAnchor="middle" fill="#0f172a" fontWeight={700}>{n.label}</text>
        </g>
      ))}
    </svg>
  );
}
