// components/WithdrawModal.tsx – Withdrawal with Provider Options

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WITHDRAW_PROVIDERS = [
  { id: 'mpesa', name: 'M-Pesa' },
  { id: 'crypto', name: 'Crypto' },
  { id: 'stripe', name: 'Stripe' },
  { id: 'paystack', name: 'Paystack' },
  { id: 'flutterwave', name: 'Flutterwave' },
  { id: 'coinbase', name: 'Coinbase Commerce' },
  { id: 'transak', name: 'Transak' },
  { id: 'ramp', name: 'Ramp' },
  { id: 'kotanipay', name: 'Kotani Pay' },
  { id: 'bank', name: 'Bank Transfer' },
];

// Enhanced: Accepts vaults array and allows selection if multiple personal vaults
export function WithdrawModal({ open, onClose, userVaultId, address, vaults }: { open: boolean; onClose: () => void; userVaultId: string; address: string; vaults?: any[] }) {
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("mpesa");
  const [currency, setCurrency] = useState("KES");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVaultId, setSelectedVaultId] = useState(userVaultId);
  const [selectedAddress, setSelectedAddress] = useState(address);

  // Update selected vault if userVaultId/address props change
  React.useEffect(() => {
    setSelectedVaultId(userVaultId);
    setSelectedAddress(address);
  }, [userVaultId, address]);

  const handleWithdraw = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userVaultId: selectedVaultId,
          address: selectedAddress,
          provider,
          amount,
          currency,
          description
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Withdrawal failed");

      if (data.providerSessionUrl) {
        window.location.href = data.providerSessionUrl;
        return;
      } else if (data.providerSessionId) {
        alert(`Session started. Follow provider instructions. Session ID: ${data.providerSessionId}`);
      } else if (data.message) {
        alert(data.message);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {vaults && vaults.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-1">Select Vault</label>
              <select
                className="w-full p-2 rounded border"
                value={selectedVaultId}
                onChange={e => {
                  setSelectedVaultId(e.target.value);
                  const v = vaults.find(v => v.id === e.target.value);
                  setSelectedAddress(v?.address || "");
                }}
              >
                {vaults.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name || v.currency || v.id} ({v.type})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select className="w-full p-2 rounded border" value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="KES">KES</option>
              <option value="USD">USD</option>
              <option value="cUSD">cUSD</option>
              <option value="USDC">USDC</option>
              <option value="ETH">ETH</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Purpose or note (optional)" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select className="w-full p-2 rounded border" value={provider} onChange={e => setProvider(e.target.value)}>
              {WITHDRAW_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
        <DialogFooter>
          <Button onClick={handleWithdraw} disabled={loading || !amount}>{loading ? "Processing..." : "Withdraw"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
