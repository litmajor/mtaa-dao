import React from 'react';
import { useParams } from 'react-router-dom';
import TreasuryPage from '../treasury';

export default function DaoTreasuryPage() {
  const { id: daoId } = useParams<{ id: string }>();

  if (!daoId) {
    return <div className="p-4">Invalid DAO ID</div>;
  }

  return <TreasuryPage />;
}
