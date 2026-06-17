import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function ApiDocsPage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>API Docs — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">API Documentation</h1>
      <p className="text-sm text-slate-500 mt-2">Reference for REST/webhook endpoints and examples.</p>
    </div>
  );
}
