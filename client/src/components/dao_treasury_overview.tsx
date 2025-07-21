// components/DaoTreasuryOverview.tsx


import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Optionally accept daoId as prop for multi-DAO support
export function DaoTreasuryOverview({ daoId = "root-dao" }: { daoId?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [treasury, setTreasury] = useState<any>(null);

  useEffect(() => {
    async function fetchTreasury() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/dao/treasury/${daoId}/balance`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setTreasury(data);
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
      <CardContent className="space-y-2 text-sm">
        {loading && <p>Loading treasury...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {treasury && (
          <>
            <p>� Total Treasury: {treasury.nativeBalance?.toLocaleString()} CELO</p>
            {/* Add more fields as backend expands: tokens, last activity, vaults, etc. */}
          </>
        )}
      </CardContent>
    </Card>
  );
}
