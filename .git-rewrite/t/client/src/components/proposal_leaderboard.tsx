// components/ProposalLeaderboard.tsx

import { useProposalStats } from "@/pages/hooks/useProposalStats"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Trophy } from "lucide-react"

export function ProposalLeaderboard() {
  const { data: stats, isLoading } = useProposalStats()

  if (isLoading) return <p className="text-sm">Loading leaderboard...</p>
  if (!stats || !Array.isArray(stats) || !stats.length) return <p className="text-sm text-muted-foreground">No proposal stats found.</p>

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Trophy className="text-mtaa-gold w-4 h-4" />
        <h3 className="text-sm font-semibold">Proposal Leaderboard</h3>
      </CardHeader>
      <CardContent className="overflow-x-auto text-sm">
        <table className="min-w-full text-left">
          <thead>
            <tr className="text-muted-foreground">
              <th className="px-2 py-1">Address</th>
              <th className="px-2 py-1">Proposals</th>
              <th className="px-2 py-1">Passed</th>
              <th className="px-2 py-1">Votes</th>
              <th className="px-2 py-1">Participation</th>
              <th className="px-2 py-1">Reputation</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s: any) => (
              <tr key={s.address} className="border-t border-muted">
                <td className="px-2 py-1 font-mono text-xs">{s.address.slice(0, 6)}...{s.address.slice(-4)}</td>
                <td className="px-2 py-1">{s.proposalsSubmitted}</td>
                <td className="px-2 py-1">{s.proposalsPassed}</td>
                <td className="px-2 py-1">{s.votesCast}</td>
                <td className="px-2 py-1">{Math.round(s.participationRate * 100)}%</td>
                <td className="px-2 py-1 text-mtaa-emerald font-semibold">{s.reputation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
