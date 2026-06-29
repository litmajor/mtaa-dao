import React, { useState, useEffect } from 'react';

export default function RecordPaymentModal({ isOpen, onClose, daoId, onSuccess }: any) {
  const [members, setMembers] = useState<any[]>([]);
  const [memberId, setMemberId] = useState<string>('');
  const [amountKES, setAmountKES] = useState<string>('');
  const [method, setMethod] = useState<string>('M-Pesa');
  const [mpesaCode, setMpesaCode] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [contributorName, setContributorName] = useState<string>('');
  const [contributorPhone, setContributorPhone] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('monthly');
  const [cycle, setCycle] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await fetch(`/api/v1/daos/${daoId}/members`);
        if (res.ok) {
          const j = await res.json();
          setMembers(j.data || []);
          if ((j.data || []).length) setMemberId((j.data || [])[0].userId || '');
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [isOpen, daoId]);

  if (!isOpen) return null;

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!memberId) { setError('Select a member'); setLoading(false); return; }
      if (!amountKES || Number(amountKES) <= 0) { setError('Enter amount'); setLoading(false); return; }

      const payload = { 
        memberId, 
        amountKES: Number(amountKES), 
        method, 
        mpesaCode: mpesaCode || undefined, 
        note,
        contributorName: contributorName || undefined,
        contributorPhone: contributorPhone || undefined,
        purpose,
        cycle: cycle || undefined
      };
      const res = await fetch(`/api/v1/daos/${daoId}/payments/record`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const j = await res.json();
        setError(j?.error || 'Failed to record payment');
        setLoading(false);
        return;
      }
      const j = await res.json();
      onSuccess?.(j);
      // if user attached a receipt file, upload it
      if (receiptFile && j?.paymentId) {
        try {
          const form = new FormData();
          form.append('receipt', receiptFile);
          const up = await fetch(`/api/v1/daos/${daoId}/payments/${j.paymentId}/receipt`, { method: 'POST', body: form });
          if (!up.ok) {
            const uj = await up.json().catch(() => ({}));
            console.warn('Receipt upload failed', uj);
          }
        } catch (e) {
          console.warn('Receipt upload network error', e);
        }
      }
      const sel = members.find(m => m.userId === memberId);
      const name = sel?.userName || sel?.userEmail || 'member';
      setSuccessMsg(`✓ Payment recorded. Waiting for ${name} to confirm.`);
      // keep modal open briefly so user sees confirmation
      setLoading(false);
      setTimeout(() => {
        onClose?.();
      }, 2000);
    } catch (e) {
      setError('Network error');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Record Payment</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="memberSelect" className="text-xs text-slate-400">Member</label>
            <select id="memberSelect" aria-label="Select member" value={memberId} onChange={(e) => setMemberId(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 rounded text-white">
              {members.map(m => (
                <option key={m.userId} value={m.userId}>{m.userName || m.userEmail || m.userId}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="amountInput" className="text-xs text-slate-400">Amount (KES)</label>
            <input id="amountInput" type="number" inputMode="numeric" min="1" placeholder="0"
              value={amountKES} onChange={(e) => setAmountKES(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 rounded text-white" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400">Contributor Name (Optional)</label>
              <input value={contributorName} onChange={(e) => setContributorName(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 rounded text-white" placeholder="e.g. John Doe" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Phone (Optional)</label>
              <input value={contributorPhone} onChange={(e) => setContributorPhone(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 rounded text-white" placeholder="e.g. 254..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400">Purpose</label>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 rounded text-white">
                <option value="monthly">Monthly Contribution</option>
                <option value="fine">Late Fine</option>
                <option value="loan_repayment">Loan Repayment</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Cycle (Optional)</label>
              <input value={cycle} onChange={(e) => setCycle(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 rounded text-white" placeholder="e.g. 2026-06" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">Method</label>
            <div className="mt-1 flex gap-2" role="radiogroup" aria-label="Payment method">
              <label className="inline-flex items-center gap-2"><input name="paymentMethod" type="radio" checked={method==='M-Pesa'} onChange={() => setMethod('M-Pesa')} /> M-Pesa</label>
              <label className="inline-flex items-center gap-2"><input name="paymentMethod" type="radio" checked={method==='Cash'} onChange={() => setMethod('Cash')} /> Cash</label>
              <label className="inline-flex items-center gap-2"><input name="paymentMethod" type="radio" checked={method==='Bank'} onChange={() => setMethod('Bank')} /> Bank</label>
            </div>
          </div>

          {method === 'M-Pesa' && (
            <div>
              <label className="text-xs text-slate-400">M-Pesa Code (KES till / STK code)</label>
              <input value={mpesaCode} onChange={(e) => setMpesaCode(e.target.value.toUpperCase())} className="w-full mt-1 p-2 bg-slate-800 rounded text-white" placeholder="e.g., ABC123XYZ" />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 rounded text-white" maxLength={100} />
          </div>

          <div>
            <label className="text-xs text-slate-400">Receipt (optional)</label>
            <input id="receiptFileInput" type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)} className="w-full mt-1 text-sm text-slate-400" />
            {receiptFile && <div className="text-xs text-slate-300 mt-1">Selected: {receiptFile.name}</div>}
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}
          {successMsg && <div className="text-green-400 text-sm">{successMsg}</div>}

          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-3 py-2 bg-slate-700 rounded">Cancel</button>
            <button onClick={submit} className="px-3 py-2 bg-blue-600 rounded" disabled={loading}>{loading ? 'Recording...' : 'Record Payment'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
