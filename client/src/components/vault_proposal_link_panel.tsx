// components/VaultProposalLinkPanel.tsx

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, Link2 } from "lucide-react"

interface Proposal {
  id: string
  title: string
  description: string
  proposer: string
  proposerName?: string
  proposerAvatar?: string
  proposerAddress?: string
  type: "proposal" | "vote"
  voteCount?: number
  voteThreshold?: string
  voteEndTime?: string
  voteStartTime?: string
  voteStatus?: "active" | "ended" | "not_started"
  votingPower?: string
  votingPowerType?: "cUSD" | "MTAA"
  votingPowerAmount?: string
  votingPowerCurrency?: string
  status: "active" | "resolved" | "expired"
  vaultId: string
  amount?: string
  currency?: string
  createdAt: string
}

export function VaultProposalLinkPanel({ vaultId }: { vaultId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [amountThreshold, setAmountThreshold] = useState("0")
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => {
    async function fetchProposals() {
      setLoading(true)
      try {
        const res = await fetch(`/api/vaults/${vaultId}/proposals`)
        const json = await res.json()
        setProposals(json.proposals || [])
      } catch (e) {
        console.error("Failed to fetch proposals:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchProposals()
  }, [vaultId])

  const filtered = proposals.filter((p) => {
    const amountOK = !p.amount || parseFloat(p.amount) >= parseFloat(amountThreshold)
    const statusOK = statusFilter === "all" || p.status === statusFilter
    return amountOK && statusOK
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-mtaa-emerald text-white">Active</Badge>
      case "resolved":
        return <Badge className="bg-mtaa-purple text-white">Resolved</Badge>
      case "expired":
        return <Badge className="bg-gray-500 text-white">Expired</Badge>
      default:
        return <Badge className="bg-mtaa-gold text-white">Draft</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Linked Proposals
          </h3>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min Amount"
              value={amountThreshold}
              onChange={e => setAmountThreshold(e.target.value)}
              className="w-28"
            />
            <select
              aria-label="Filter proposals by status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full rounded" />
        ) : filtered.length === 0 ? (
          <p className="text-muted">No proposals matching filters.</p>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="border rounded p-3 space-y-1">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-gray-900">{p.title}</h4>
                {getStatusBadge(p.status)}
              </div>
              <p className="text-sm text-gray-600">
                {p.description?.substring(0, 100)}{p.description?.length > 100 ? "..." : ""}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {new Date(p.createdAt).toLocaleDateString()}
                </span>
                <a href={`/proposals/${p.id}`} className="underline text-blue-600">View</a>
              </div>
              {p.amount && (
                <p className="text-sm mt-1">Amount: <strong>{p.amount}</strong> {p.currency?.toUpperCase() || "cUSD"}</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
