import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function WalletIntegrationsPage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>Wallet Integrations — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">Wallet Integrations</h1>
      <p className="text-sm text-slate-500 mt-2">Connect or disconnect wallet providers, view diagnostics.</p>
    </div>
  );
}
