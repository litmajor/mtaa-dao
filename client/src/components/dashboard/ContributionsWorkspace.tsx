import React, { useState, useEffect } from 'react';
import { getContributionLedger, exportContributionLedger, confirmContribution } from '../../api/contributionsApi';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle, Clock, AlertTriangle, Plus } from 'lucide-react';
import RecordPaymentModal from '../modals/RecordPaymentModal';

export default function ContributionsWorkspace({ daoId }: { daoId: string }) {
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getContributionLedger(daoId);
      if (res && res.ledger) {
        setLedger(res.ledger);
        setSummary(res.summary || {});
      } else if (res && Array.isArray(res)) {
        setLedger(res);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [daoId]);

  const handleExport = async () => {
    try {
      const blob = await exportContributionLedger(daoId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dao_${daoId}_contributions.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export CSV');
    }
  };

  const handleConfirm = async (contributionId: string) => {
    try {
      await confirmContribution(daoId, contributionId);
      loadData();
    } catch (e) {
      alert('Failed to confirm contribution');
    }
  };

  if (loading && ledger.length === 0) {
    return (
      <div className="bg-slate-900/70 rounded-xl p-4 md:p-6 border border-slate-800 animate-pulse">
        <div className="h-6 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-slate-700 rounded w-full"></div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 rounded-xl p-4 md:p-6 border border-slate-800">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            💰 Contributions
          </h3>
          <p className="text-slate-400 mt-1">
            {summary.cycleName || 'Current Cycle'} • {summary.membersPaid || 0}/{summary.totalMembers || 0} members paid • KES {(summary.totalCollected || 0).toLocaleString()} collected
          </p>
        </div>
        
        {/* Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setShowRecordModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" className="bg-slate-800 hover:bg-slate-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Ledger Table */}
      <div className="overflow-x-auto bg-slate-800/50 rounded-lg border border-slate-700">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700 text-xs uppercase text-slate-400">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Amount (KES)</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Ref / Method</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No contributions found for this Chama.
                </td>
              </tr>
            ) : (
              ledger.map((entry) => {
                const statusColor = 
                  entry.status === 'confirmed' || entry.status === 'paid' ? 'text-green-400 bg-green-400/10' :
                  entry.status === 'pending' || entry.status === 'recorded' ? 'text-amber-400 bg-amber-400/10' :
                  'text-red-400 bg-red-400/10';

                return (
                  <tr key={entry.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white text-sm">
                        {entry.contributorName || entry.userName || entry.userId?.substring(0,8) || 'Unknown'}
                      </div>
                      {entry.contributorPhone && (
                        <div className="text-xs text-slate-400">{entry.contributorPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      {(Number(entry.amount || 0)).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {new Date(entry.timestamp || entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-slate-300">{entry.mpesaRef || entry.transactionHash?.substring(0,8) || '—'}</div>
                      <div className="text-xs text-slate-500">{entry.paymentMethod || entry.method || 'M-Pesa'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor}`}>
                        {entry.status === 'confirmed' || entry.status === 'paid' ? <CheckCircle className="w-3 h-3 mr-1" /> :
                         entry.status === 'pending' || entry.status === 'recorded' ? <Clock className="w-3 h-3 mr-1" /> :
                         <AlertTriangle className="w-3 h-3 mr-1" />}
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(entry.status === 'pending' || entry.status === 'recorded') && (
                        <Button onClick={() => handleConfirm(entry.id)} variant="outline" size="sm" className="h-7 text-xs px-2 py-0 border-slate-600">
                          Confirm
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="mt-4 flex justify-between items-center text-sm text-slate-400 border-t border-slate-700 pt-4">
        <div>
          Outstanding: <span className="text-white">KES {(summary.totalOutstanding || 0).toLocaleString()}</span>
        </div>
        <div>
          Next Cycle: <span className="text-white">{summary.nextCycleDate || 'Not set'}</span>
        </div>
      </div>

      {showRecordModal && (
        <RecordPaymentModal
          isOpen={showRecordModal}
          daoId={daoId}
          onClose={() => setShowRecordModal(false)}
          onSuccess={() => {
            setShowRecordModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
