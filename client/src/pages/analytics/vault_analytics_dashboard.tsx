import { useMemo, useState } from "react"
import { BarChart2, AlertTriangle, Download, Calendar, TrendingUp, TrendingDown, DollarSign } from "lucide-react"

export default function VaultAnalyticsDashboard() {
  const [currency, setCurrency] = useState("cusd")
  const [activeTab, setActiveTab] = useState("overview")
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
  })

  // Mock data
  const transactions = [
    { type: "receive", amount: "250.00", currency: "cusd", to: "0x1234...5678", timestamp: "2025-01-15T10:30:00Z" },
    { type: "send", amount: "75.50", currency: "cusd", to: "0x8765...4321", timestamp: "2025-01-14T15:45:00Z" },
    { type: "receive", amount: "1200.00", currency: "cusd", to: "0x9999...1111", timestamp: "2025-01-13T09:20:00Z" },
    { type: "send", amount: "45.25", currency: "cusd", to: "0x2222...3333", timestamp: "2025-01-12T14:15:00Z" },
    { type: "receive", amount: "500.75", currency: "cusd", to: "0x4444...5555", timestamp: "2025-01-11T11:00:00Z" },
    { type: "send", amount: "1500.00", currency: "cusd", to: "0x6666...7777", timestamp: "2025-01-10T16:30:00Z" },
    { type: "receive", amount: "300.00", currency: "cusd", to: "0x8888...9999", timestamp: "2025-01-09T08:45:00Z" },
    { type: "send", amount: "125.75", currency: "cusd", to: "0x1111...2222", timestamp: "2025-01-08T13:20:00Z" },
  ]

  const balance = "2,847.25"

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


  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg">
            <BarChart2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Vault Analytics</h2>
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
                {transactions.map((tx, i) => (
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
                ))}
                {transactions.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No transactions in selected range</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}