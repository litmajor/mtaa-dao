import React from 'react';

type Props = { route?: string[]; speed?: string; reliability?: string };

export default function RouteInfo({ route = [], speed = 'Medium', reliability = 'Medium' }: Props) {
  return (
    <div className="p-3 bg-muted/50 rounded">
      <div className="text-xs text-muted-foreground">Route</div>
      <div className="font-medium">{(route || []).join(' → ') || 'Direct'}</div>
      <div className="mt-2 text-xs flex gap-3">
        <div className="px-2 py-1 bg-slate-100 rounded">Speed: {speed}</div>
        <div className="px-2 py-1 bg-slate-100 rounded">Reliability: {reliability}</div>
      </div>
    </div>
  );
}
