// MtaaDAO Community Vault Analytics Dashboard — Phase 4.4: Elder Awareness + Earnings Graph

import { useMemo, useState } from "react"
import { useVaultTransactions, useVaultBalance, usePendingDisbursements, useVaultEarningsGraph } from "@/hooks/useVaultHooks"
import { format } from "date-fns"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/DateRangePicker"
import { Button } from "@/components/ui/button"
import { BarChart2, AlertTriangle, Download, Clock, Info } from "lucide-react"
import { VaultSelector } from "@/components/VaultSelector"
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis } from "recharts"

export default function CommunityVaultAnalyticsDashboard({ vaultId: initialVaultId, isElder = false }) {
  const [currency, setCurrency] = useState("cusd")
  const [vaultId, setVaultId] = useState(initialVaultId)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
  })

  const { data: transactions = [] } = useVaultTransactions(vaultId, {
    startDate: format(dateRange.startDate, "yyyy-MM-dd"),
    endDate: format(dateRange.endDate, "yyyy-MM-dd"),
    currency,
  })

  const { data: balance = "0" } = useVaultBalance(vaultId, currency)
  const { data: pendingDisbursements = [] } = usePendingDisbursements(vaultId)
  const { data: earningsData = [] } = useVaultEarningsGraph(vaultId, currency)

  const inflow = useMemo(() => transactions
    .filter(tx => tx.type === "receive")
    .reduce((acc, tx) => acc + parseFloat(tx.amount), 0), [transactions])

  const outflow = useMemo(() => transactions
    .filter(tx => tx.type === "send")
    .reduce((acc, tx) => acc + parseFloat(tx.amount), 0), [transactions])

  const anomalies = useMemo(() => transactions.filter(tx => parseFloat(tx.amount) > 1000), [transactions])

  const downloadCSV = () => {
    const headers = ["Type", "Amount", "Currency", "To", "Timestamp"]
    const rows = transactions.map(tx => [tx.type, tx.amount, tx.currency, tx.to, tx.timestamp])
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `community-vault-${vaultId}-${currency}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-mtaa-purple" /> Community Vault Analytics
        </h2>
        <VaultSelector value={vaultId} onChange={setVaultId} />
      </div>

      {anomalies.length > 0 && (
        <div className="p-4 border border-red-300 bg-red-50 rounded-md text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {anomalies.length} anomaly{anomalies.length > 1 ? "ies" : ""} detected (transactions {'>'} 1000 {currency.toUpperCase()})
        </div>
      )}

      {isElder && pendingDisbursements.length > 0 && (
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" /> <span className="font-semibold">Recent Auto-Disbursements (Proposal Resolved)</span>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pendingDisbursements.map(d => (
              <div key={d.id} className="border-b py-2 flex justify-between items-center">
                <span>{d.amount} {d.currency.toUpperCase()} sent to {d.to.slice(0, 6)}...{d.to.slice(-4)}</span>
                <a href={`/proposals/${d.proposalId}`} className="text-xs text-blue-600 underline">View Proposal</a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <p className="text-sm">Vault Balance ({currency.toUpperCase()})</p>
                <h3 className="text-xl font-bold">{balance}</h3>
              </div>
              <div className="flex flex-col items-end">
                <label className="text-xs">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="text-sm border rounded px-2 py-1">
                  <option value="cusd">cUSD</option>
                  <option value="celo">CELO</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-300 rounded p-3">
                <p className="text-xs text-green-700">Total Inflow</p>
                <h4 className="text-lg font-semibold text-green-900">+{inflow.toFixed(2)} {currency.toUpperCase()}</h4>
              </div>
              <div className="bg-red-50 border border-red-300 rounded p-3">
                <p className="text-xs text-red-700">Total Outflow</p>
                <h4 className="text-lg font-semibold text-red-900">-{outflow.toFixed(2)} {currency.toUpperCase()}</h4>
              </div>
              <div className="bg-blue-50 border border-blue-300 rounded p-3">
                <p className="text-xs text-blue-700">Net Flow</p>
                <h4 className="text-lg font-semibold text-blue-900">{(inflow - outflow).toFixed(2)} {currency.toUpperCase()}</h4>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Button size="sm" onClick={downloadCSV} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {transactions.map((tx, i) => (
                <div key={i} className={`border-b py-2 flex justify-between ${parseFloat(tx.amount) > 1000 ? "text-red-700 font-semibold" : ""}`}>
                  <span>
                    {tx.type.toUpperCase()} to {tx.to?.slice(0, 6)}...{tx.to?.slice(-4)}
                    {tx.proposalId && (
                      <a href={`/proposals/${tx.proposalId}`} className="ml-2 text-xs text-blue-600 underline">(Proposal)</a>
                    )}
                  </span>
                  <span className="text-right">{tx.amount} {tx.currency.toUpperCase()}</span>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-muted">No transactions in range</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings">
          <Card>
            <CardHeader className="text-sm">Staking / Earnings (30d)</CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={earningsData}>
                  <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="earnings" stroke="#22c55e" fill="#bbf7d0" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
