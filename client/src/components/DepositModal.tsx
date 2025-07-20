import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROVIDERS = [
  { id: "stripe", name: "Stripe (Card/Apple Pay)" },
  { id: "mpesa", name: "M-Pesa (Mobile Money)" },
  { id: "paystack", name: "Paystack (Africa)" },
  { id: "flutterwave", name: "Flutterwave (Africa)" },
  { id: "coinbase", name: "Coinbase Commerce (Crypto)" },
  { id: "transak", name: "Transak (Crypto)" },
  { id: "ramp", name: "Ramp Network (Crypto)" },
  { id: "kotanipay", name: "Kotani Pay (Mobile ↔ Crypto)" },
];

export function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("stripe");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDeposit = async () => {
    setLoading(true);
    setError("");
    try {
      // Call backend to create payment session
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create deposit session");
      // Handle provider session URL or ID
      if (data.providerSessionUrl) {
        window.location.href = data.providerSessionUrl;
        return; // Don't close modal until redirect
      } else if (data.providerSessionId) {
        // For providers that require polling or further steps
        alert(`Session started. Please follow provider instructions. Session ID: ${data.providerSessionId}`);
      } else if (data.message) {
        alert(data.message);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deposit Funds</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select className="w-full p-2 rounded border" value={provider} onChange={e => setProvider(e.target.value)}>
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
        <DialogFooter>
          <Button onClick={handleDeposit} disabled={loading || !amount}>{loading ? "Processing..." : "Deposit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
