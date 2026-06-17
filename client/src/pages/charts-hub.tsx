import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function ChartsHubPage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>Charts — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">Charts & Visualizations</h1>
      <p className="text-sm text-slate-500 mt-2">Centralized charts viewer (loads heavy charting libs lazily).</p>
    </div>
  );
}
