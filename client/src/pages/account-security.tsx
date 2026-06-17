import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function AccountSecurityPage() {
  return (
    <div className="p-8">
      <Helmet>
        <title>Account Security — Mtaa DAO</title>
      </Helmet>
      <h1 className="text-2xl font-bold">Account Security</h1>
      <p className="text-sm text-slate-500 mt-2">Manage sessions, enable 2FA, and review login history.</p>
    </div>
  );
}
