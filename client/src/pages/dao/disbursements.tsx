// pages/dao/disbursements.tsx

import { VaultDisbursementAlert } from "@/components/vault_disbursement_alert";

export default function DisbursementPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Vault Disbursements</h1>
      <VaultDisbursementAlert vaultId="community-vault" showCommunityView={true} />
    </div>
  );
}