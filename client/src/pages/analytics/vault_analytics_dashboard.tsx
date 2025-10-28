import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BarChart2, AlertTriangle, Download, Calendar, TrendingUp, TrendingDown, DollarSign, Loader2 } from "lucide-react"

interface Transaction {
  id: string;
  type: "receive" | "send";
  amount: string;
  currency: string;
  to: string;
  timestamp: string;
  status?: string;
  valueUSD?: string;
}

export default function VaultAnalyticsDashboard() {
  const [currency, setCurrency] = useState("cusd")
  const [activeTab, setActiveTab] = useState("overview")
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
  })

  // Fetch real transaction data
  const { data: transactionsData, isLoading, error } = useQuery<{ transactions: Transaction[]; count: number }>({
    queryKey: ["/api/vault/transactions", currency, dateRange],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        currency: currency.toLowerCase(),
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        limit: '100',
      });
      
      const response = await fetch(`/api/vault/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }
      
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  const transactions = transactionsData?.transactions || []

  const inflow = useMemo(() => transactions
    .filter(tx => tx.type === "receive")
    .reduce((acc, tx) => acc + parseFloat(tx.amount), 0), [transactions])

  const outflow = useMemo(() => transactions
    .filter(tx => tx.type === "send")
    .reduce((acc, tx) => acc + parseFloat(tx.amount), 0), [transactions])

  const balance = useMemo(() => {
    const total = inflow - outflow;
    return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [inflow, outflow])

  const anomalies = useMemo(() => transactions.filter(tx => parseFloat(tx.amount) > 1000), [transactions])

  const downloadCSV = () => {
    const headers = ["Type", "Amount", "Currency", "To", "Timestamp"]
    const rows = transactions.map(tx => [tx.type, tx.amount, tx.currency, tx.to, tx.timestamp])
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `vault-transactions-${currency}.csv`
    link.click()
  }

  function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading vault analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg text-red-600 mb-4">Failed to load analytics</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg">
            <BarChart2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Vault Analytics</h2>
          {!isLoading && transactionsData && (
            <span className="text-sm text-gray-500">
              ({transactionsData.count} transactions)
            </span>
          )}
        </div>

        {/* Anomaly Alert */}
        {anomalies.length > 0 && (
          <div className="p-4 border border-red-300 bg-red-50 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {anomalies.length} potential anomaly{anomalies.length > 1 ? "ies" : ""} detected 
              {transactions.length > 1000 && currency.toUpperCase()}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === "overview"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === "history"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                History
              </button>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="p-6">
              {/* Balance Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Vault Balance ({currency.toUpperCase()})</p>
                  <h3 className="text-3xl font-bold text-gray-900">{balance}</h3>
                </div>
                <div className="flex flex-col items-end">
                  <label htmlFor="currency-select" className="text-xs text-gray-600 mb-1">Currency</label>
                  <select 
                    id="currency-select"
                    value={currency} 
                    onChange={e => setCurrency(e.target.value)} 
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="cusd">cUSD</option>
                    <option value="celo">CELO</option>
                  </select>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-green-700">Total Inflow</p>
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-green-900">+{inflow.toFixed(2)}</h4>
                  <p className="text-xs text-green-600 mt-1">{currency.toUpperCase()}</p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-red-700">Total Outflow</p>
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-red-900">-{outflow.toFixed(2)}</h4>
                  <p className="text-xs text-red-600 mt-1">{currency.toUpperCase()}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-blue-700">Net Flow</p>
                    <DollarSign className="w-4 h-4 text-blue-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-blue-900">{(inflow - outflow).toFixed(2)}</h4>
                  <p className="text-xs text-blue-600 mt-1">{currency.toUpperCase()}</p>
                </div>
              </div>

              {/* Transaction Summary */}
              <div className="mt-8">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h4>
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          tx.type === "receive" ? "bg-green-500" : "bg-red-500"
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {tx.type === "receive" ? "Received from" : "Sent to"} {tx.to?.slice(0, 6)}...{tx.to?.slice(-4)}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(tx.timestamp)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${
                          tx.type === "receive" ? "text-green-600" : "text-red-600"
                        }`}>
                          {tx.type === "receive" ? "+" : "-"}{tx.amount}
                        </p>
                        <p className="text-xs text-gray-500">{tx.currency.toUpperCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="p-6">
              {/* Header with Date Range and Export */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center space-x-4">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>From: {dateRange.startDate.toLocaleDateString()}</span>
                    <span>To: {dateRange.endDate.toLocaleDateString()}</span>
                  </div>
                </div>
                <button 
                  onClick={downloadCSV}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              {/* Transaction List */}
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Transactions Found</h3>
                    <p className="text-sm text-gray-500">
                      No vault transactions found for the selected period and currency.
                    </p>
                  </div>
                ) : (
                  transactions.map((tx, i) => (
                  <div 
                    key={i} 
                    className={`border-b border-gray-100 py-3 flex justify-between items-center ${
                      parseFloat(tx.amount) > 1000 ? "bg-red-50 border-red-200 rounded-lg px-3" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        tx.type === "receive" ? "bg-green-500" : "bg-red-500"
                      }`} />
                      <div>
                        <p className={`text-sm font-medium ${
                          parseFloat(tx.amount) > 1000 ? "text-red-700" : "text-gray-900"
                        }`}>
                          {tx.type.toUpperCase()} to {tx.to?.slice(0, 6)}...{tx.to?.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(tx.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        parseFloat(tx.amount) > 1000 ? "text-red-700" : 
                        tx.type === "receive" ? "text-green-600" : "text-red-600"
                      }`}>
                        {tx.type === "receive" ? "+" : "-"}{tx.amount}
                      </p>
                      <p className="text-xs text-gray-500">{tx.currency.toUpperCase()}</p>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}