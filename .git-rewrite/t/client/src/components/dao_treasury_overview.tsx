// components/DaoTreasuryOverview.tsx


import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Optionally accept daoId as prop for multi-DAO support
export function DaoTreasuryOverview({ daoId = "root-dao" }: { daoId?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [treasury, setTreasury] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [vaults, setVaults] = useState<any[]>([]);

  useEffect(() => {
    async function fetchTreasury() {
      setLoading(true);
      setError("");
      try {
        // Expanded API: fetch treasury snapshot, vaults, and recent activity
        const res = await fetch(`/api/dao/treasury/${daoId}/snapshot`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setTreasury(data);

        // Optionally fetch vaults
        if (data.vaults) {
          setVaults(data.vaults);
        } else {
          // fallback: fetch vaults separately
          try {
            const vaultRes = await fetch(`/api/dao/${daoId}/vaults`);
            if (vaultRes.ok) setVaults(await vaultRes.json());
          } catch {}
        }

        // Optionally fetch recent activity
        if (data.activity) {
          setActivity(data.activity);
        } else {
          // fallback: fetch activity separately
          try {
            const actRes = await fetch(`/api/dao/${daoId}/activity?limit=5`);
            if (actRes.ok) setActivity(await actRes.json());
          } catch {}
        }
      } catch (e: any) {
        setError(e.message || "Failed to load treasury");
      } finally {
        setLoading(false);
      }
    }
    fetchTreasury();
  }, [daoId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>DAO Treasury Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading && <p>Loading treasury...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {treasury && (
          <>
            <div className="space-y-2">
              <p className="font-semibold text-lg">Total Treasury: {treasury.nativeBalance?.toLocaleString()} CELO</p>
              {treasury.totalValueUsd && (
                <p className="font-semibold">Total Value (USD): ${treasury.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              )}
              <p className="text-xs text-muted-foreground">Last Updated: {treasury.lastUpdated ? new Date(treasury.lastUpdated).toLocaleString() : "-"}</p>
            </div>

            {/* Token Holdings */}
            {treasury.tokenBalances && Object.keys(treasury.tokenBalances).length > 0 && (
              <div>
                <h4 className="font-semibold mt-4 mb-2">Token Holdings</h4>
                <ul className="space-y-1">
                  {Object.entries(treasury.tokenBalances).map(([address, token]: [string, any]) => (
                    <li key={address} className="flex justify-between">
                      <span>{token.symbol} ({token.name})</span>
                      <span>{token.balanceFormatted?.toLocaleString()} {token.symbol}</span>
                      {token.priceUsd && (
                        <span className="ml-2 text-muted-foreground">${(token.balanceFormatted * token.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Vaults */}
            {vaults.length > 0 && (
              <div>
                <h4 className="font-semibold mt-4 mb-2">Vaults</h4>
                <ul className="space-y-1">
                  {vaults.map((vault: any) => (
                    <li key={vault.id} className="flex justify-between">
                      <span>{vault.name || vault.currency || "Vault"}</span>
                      <span>{vault.balance?.toLocaleString()} {vault.currency || ""}</span>
                      {vault.monthlyGoal && (
                        <span className="ml-2 text-muted-foreground">Goal: {vault.monthlyGoal.toLocaleString()}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {treasury.recommendations && treasury.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold mt-4 mb-2">Recommendations</h4>
                <ul className="list-disc pl-5">
                  {treasury.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recent Activity */}
            {activity.length > 0 && (
              <div>
                <h4 className="font-semibold mt-4 mb-2">Recent Activity</h4>
                <ul className="space-y-1">
                  {activity.map((act: any, i: number) => (
                    <li key={i} className="flex justify-between">
                      <span>{act.type || act.event}</span>
                      <span>{act.amount ? act.amount.toLocaleString() : "-"} {act.currency || act.token || ""}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{act.timestamp ? new Date(act.timestamp).toLocaleString() : "-"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
