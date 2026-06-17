import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function BillingPage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>Billing — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">Billing & Subscription</h1>
      <p className="text-sm text-slate-500 mt-2">Manage invoices, subscriptions, and payment methods.</p>
    </div>
  );
}
