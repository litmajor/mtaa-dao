import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function DeveloperConsolePage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>Developer Console — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">Developer Console</h1>
      <p className="text-sm text-slate-500 mt-2">Run API tests, inspect webhooks, and manage integrations.</p>
    </div>
  );
}
