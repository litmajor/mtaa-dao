import React from 'react';
import { DaoTreasuryOverview } from '../dao_treasury_overview';

export default function TreasuryWorkspace({ daoId }: { daoId: string }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white mb-2">💳 Treasury Command Center</h2>
        <p className="text-slate-400 text-sm">
          Manage your DAO's finances, review pending transactions, and execute approved payments.
        </p>
      </div>
      
      {/* 
        DaoTreasuryOverview expects daoId as a prop and internally handles 
        fetching the treasury snapshot, vaults, and execution queue.
      */}
      <DaoTreasuryOverview daoId={daoId} />
    </div>
  );
}
