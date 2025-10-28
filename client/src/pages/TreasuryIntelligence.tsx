
import React from 'react';
import TreasuryIntelligenceDashboard from '../components/TreasuryIntelligenceDashboard';
import { useParams } from 'react-router-dom';

export default function TreasuryIntelligencePage() {
  const { daoId } = useParams();
  
  if (!daoId) {
    return <div className="p-4">DAO ID required</div>;
  }

  return <TreasuryIntelligenceDashboard daoId={daoId} />;
}
