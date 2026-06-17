import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function NotificationsPage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>Notifications — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">Notifications & Preferences</h1>
      <p className="text-sm text-slate-500 mt-2">Configure alerts, channels, and notification frequency.</p>
    </div>
  );
}
