// pages/dao/index.tsx – DAO Home Dashboard

import { DaoTreasuryOverview } from "@/components/dao_treasury_overview"
import { VaultDisbursementAlert } from "@/components/vault_disbursement_alert"
import { CommunityVaultAnalyticsDashboard } from "@/components/community_vault_analytics_dashboard"
import { ContributorList } from "@/components/contributor_list"
import { ProposalLeaderboard } from "@/components/proposal_leaderboard"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { PartyPopper } from "lucide-react"

export default function DaoHomePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PartyPopper className="w-6 h-6 text-mtaa-gold" />
        <h2 className="text-2xl font-bold">Welcome to MtaaDAO</h2>
      </div>

      {/* 🧠 DAO Treasury Overview */}
      <DaoTreasuryOverview />

      {/* 🔔 Optional community-wide disbursement alert feed */}
      <VaultDisbursementAlert vaultId="root-vault" showCommunityView />

      {/* 🪙 Featured Community Vault Section */}
      <CommunityVaultAnalyticsDashboard vaultId="community-vault" />

      {/* 🌟 Contributor Reputation View */}
      <ContributorList />

      {/* 🏆 Proposal Leaderboard */}
      <ProposalLeaderboard />

      {/* 🧭 Future: Governance summary, proposal insights, leaderboards, etc */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Next Features</h3>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Treasury trends, voting leaderboards, active contributors, task bounties...
        </CardContent>
      </Card>
    </div>
  )
}
