// pages/dao/treasury.tsx

import { DaoTreasuryOverview } from "@/components/dao_treasury_overview"
export default function TreasuryPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">DAO Treasury</h1>
      <DaoTreasuryOverview />
    </div>
  );
}


