// components/ContributorList.tsx

import { useContributors } from "../pages/hooks/useContributors";
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User } from "lucide-react"

type Contributor = {
  address: string;
  proposalCount: number;
  voteCount: number;
  totalFunding: number;
  reputation: number;
  referredBy?: string;
};

export function ContributorList() {
  const { data: contributors = [], isLoading } = useContributors()

  if (isLoading) return <p className="text-sm">Loading contributors...</p>

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <User className="text-mtaa-emerald w-4 h-4" />
        <h3 className="text-sm font-semibold">Top Contributors</h3>
      </CardHeader>
      <CardContent className="divide-y divide-muted text-sm">
        {contributors.map((c: Contributor) => (
          <div key={c.address} className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-gradient-to-br from-mtaa-purple to-mtaa-gold text-white text-xs">
                  {c.address.slice(2, 4).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{c.address.slice(0, 6)}...{c.address.slice(-4)}</p>
                <p className="text-xs text-muted-foreground">
                  {c.proposalCount} proposals • {c.voteCount} votes • {c.totalFunding} cUSD funded
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-mtaa-emerald">{c.reputation} pts</span>
              {c.referredBy && (
                <p className="text-[10px] text-muted-foreground">ref: {c.referredBy.slice(0, 6)}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
