import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function SystemStatusPage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>System Status — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">System Status</h1>
      <p className="text-sm text-slate-500 mt-2">View service health and recent incidents.</p>
    </div>
  );
}
