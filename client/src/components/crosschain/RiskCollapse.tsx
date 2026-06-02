import React, { useState } from 'react';

export default function RiskCollapse() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button className="text-sm text-red-700" onClick={() => setOpen((s) => !s)}>
        {open ? 'Hide' : '⚠️ Risk & Security'}
      </button>
      {open && (
        <div className="mt-2 p-3 bg-red-50 rounded text-sm text-red-800">
          <ul className="list-disc list-inside">
            <li>Bridges rely on external validators and relayers.</li>
            <li>Transfers can be delayed during congestion.</li>
            <li>Double-check the destination address before confirming.</li>
            <li>Use small amounts first if unsure.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
