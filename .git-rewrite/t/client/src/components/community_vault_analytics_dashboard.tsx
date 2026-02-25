// components/CommunityVaultAnalyticsDashboard.tsx

import { useEffect, useState } from "react"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react"
import { formatNumber } from "@/lib/formatters"

interface CommunityVaultAnalyticsDashboardProps {
  vaultId: string
}

export function CommunityVaultAnalyticsDashboard({ vaultId }: CommunityVaultAnalyticsDashboardProps) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/vaults/${vaultId}/analytics`)
        const json = await res.json()
        setData(json)
      } catch (e) {
        console.error("Failed to load vault analytics:", e)
      }
    }
    fetchData()
  }, [vaultId])

  if (!data) return <p className="text-sm">Loading community vault...</p>

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Wallet className="text-mtaa-terra w-5 h-5" />
        <h3 className="text-lg font-semibold">Community Vault: {data.name}</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 border rounded bg-yellow-50">
            <p className="text-xs text-yellow-800">Balance (cUSD)</p>
            <h4 className="text-lg font-bold text-yellow-900">{formatNumber(data.balance.cusd)}</h4>
          </div>
          <div className="p-3 border rounded bg-gray-100">
            <p className="text-xs text-gray-600">Balance (CELO)</p>
            <h4 className="text-lg font-semibold text-gray-800">{formatNumber(data.balance.celo)}</h4>
          </div>
          <div className="p-3 border rounded bg-blue-50">
            <p className="text-xs text-blue-800 flex items-center gap-1"><ArrowDownCircle className="w-3 h-3" /> Inflows</p>
            <h4 className="text-lg font-semibold text-blue-900">+{formatNumber(data.inflow)} cUSD</h4>
          </div>
          <div className="p-3 border rounded bg-red-50">
            <p className="text-xs text-red-800 flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" /> Outflows</p>
            <h4 className="text-lg font-semibold text-red-900">-{formatNumber(data.outflow)} cUSD</h4>
          </div>
        </div>

        {data.latestProposal && (
          <div className="text-sm border-t pt-4">
            <p className="text-muted-foreground text-xs mb-1">Latest Proposal</p>
            <p className="font-medium">{data.latestProposal.title}</p>
            <p className="text-xs text-gray-500">{data.latestProposal.status} • {new Date(data.latestProposal.createdAt).toLocaleDateString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
