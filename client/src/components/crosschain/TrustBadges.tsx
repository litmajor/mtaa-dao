import React from 'react';

export default function TrustBadges() {
  return (
    <div className="flex gap-3 flex-wrap text-xs">
      <div className="px-2 py-1 bg-slate-100 rounded">🔒 Route secure</div>
      <div className="px-2 py-1 bg-slate-100 rounded">⛓ Bridge reliable</div>
      <div className="px-2 py-1 bg-slate-100 rounded">⚡ Fast</div>
      <div className="px-2 py-1 bg-slate-100 rounded">⭐ Best route</div>
    </div>
  );
}
