import React, { useState } from 'react';
import PaymentModal from '../components/PaymentModal';
// If PaymentModal is not default export or props are wrong, fix import or usage

export default function PaymentPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Upgrade or Deposit</h1>
      <p className="mb-6">Select a payment provider and complete your payment to upgrade your plan or deposit funds.</p>
      <button
        className="bg-blue-600 text-white px-6 py-2 rounded mb-4"
        onClick={() => setModalOpen(true)}
      >
        Make a Payment
      </button>
  {/* If PaymentModal expects props like open and onOpenChange, ensure correct import and usage. If not, update as needed. */}
  <PaymentModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
