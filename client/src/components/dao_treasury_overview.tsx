// components/DaoTreasuryOverview.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DaoTreasuryOverview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>DAO Treasury Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>📦 Total Treasury: 5,230 cUSD</p>
        <p>🪙 CELO Holdings: 3,000</p>
        <p>💼 Community Vaults: 2</p>
        <p>🔄 Last Activity: 2 hours ago</p>
      </CardContent>
    </Card>
  );
}
