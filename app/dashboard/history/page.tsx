/**
 * /app/dashboard/history/page.tsx
 * Trading history and order history page (Placeholder)
 * URL: /dashboard/history
 */

export const metadata = {
  title: 'Trading History - MTAA Protocol',
  description: 'View your complete trading history and past orders',
};

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Trading History</h1>
        <p className="text-slate-400 mt-2">View your complete order history and past trades</p>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <div className="text-6xl mb-4">📝</div>
        <h2 className="text-2xl font-bold text-white mb-2">No Trades Yet</h2>
        <p className="text-slate-400 mb-6">Your trading history will appear here</p>
        <div className="max-w-4xl mx-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-slate-400 font-semibold">Date</th>
                <th className="px-4 py-3 text-slate-400 font-semibold">Pair</th>
                <th className="px-4 py-3 text-slate-400 font-semibold">Type</th>
                <th className="px-4 py-3 text-slate-400 font-semibold">Size</th>
                <th className="px-4 py-3 text-slate-400 font-semibold">Price</th>
                <th className="px-4 py-3 text-slate-400 font-semibold">P&L</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700/50">
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No trades to display
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
