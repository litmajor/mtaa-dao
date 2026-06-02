import React, { useState } from 'react';

export default function PanelShell({ title, children }: { title?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white rounded-xl shadow p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {title && <h4 className="text-sm font-semibold text-gray-800">{title}</h4>}
        </div>
        <div className="md:hidden">
          <button onClick={() => setOpen(!open)} className="text-sm text-gray-600">
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <div className={`${open ? 'block' : 'hidden'} md:block`}>{children}</div>
    </div>
  );
}
