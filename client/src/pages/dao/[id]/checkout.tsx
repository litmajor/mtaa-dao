import React from 'react';
import { useParams } from 'react-router-dom';

export default function DaoCheckoutPage() {
  const { id: daoId } = useParams<{ id: string }>();

  if (!daoId) {
    return <div className="p-4">Invalid DAO ID</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Checkout</h1>
      <p className="text-gray-600">DAO Checkout Page</p>
    </div>
  );
}
