
// pages/dao/community-vault.tsx

import { CommunityVaultAnalyticsDashboard } from "@/components/community_vault_analytics_dashboard";

export default function CommunityVaultPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Community Vault Analytics</h1>
      <CommunityVaultAnalyticsDashboard vaultId="community-vault" />
    </div>
  );
}