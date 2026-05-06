// components/WithdrawModal.tsx – Withdrawal with 2FA/PIN Security

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { TwoFAVerificationModal } from "./wallet/TwoFAVerificationModal";
import { PINVerificationModal } from "./wallet/PINVerificationModal";

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

  // 2FA/PIN Verification States
  const [withdrawalStep, setWithdrawalStep] = useState<'form' | '2fa' | 'pin'>('form');
  const [otpId, setOtpId] = useState<string>('');
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showPINModal, setShowPINModal] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [requiresPIN, setRequiresPIN] = useState(false);

  // Update selected vault if userVaultId/address props change
  React.useEffect(() => {
    setSelectedVaultId(userVaultId);
    setSelectedAddress(address);
  }, [userVaultId, address]);

  // Generate OTP for 2FA
  const generateOTP = async () => {
    try {
      const res = await fetch("/api/v1/wallets/security/2fa/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      setOtpId(data.otpId);
      setShow2FAModal(true);
      setWithdrawalStep('2fa');
    } catch (err: any) {
      setError(err.message || "Failed to generate OTP");
      toast.error("Failed to generate OTP");
    }
  };

  // Handle 2FA verification
  const handle2FAVerified = (verificationToken: string) => {
    setShow2FAModal(false);
    
    // Check if PIN is required next
    if (requiresPIN) {
      setShowPINModal(true);
      setWithdrawalStep('pin');
    } else {
      // Skip to final withdrawal
      completeWithdrawal(verificationToken);
    }
  };

  // Handle PIN verification
  const handlePINVerified = (verificationToken: string) => {
    setShowPINModal(false);
    completeWithdrawal(verificationToken);
  };

  // Execute the actual withdrawal
  const completeWithdrawal = async (verificationToken?: string) => {
    setLoading(true);
    setError("");
    try {
      // Use the new withdrawal endpoint with 2FA/PIN verification
      const res = await fetch("/api/v1/wallets/withdrawals/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedVaultId,
          toAddress: selectedAddress,
          amount,
          currency,
          otpId: otpId || undefined,
          // Note: PIN and OTP codes are handled by the modals
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");

      toast.success("Withdrawal initiated successfully!");
      onClose();
      setWithdrawalStep('form');
      setAmount("");
    } catch (err: any) {
      setError(err.message || "Withdrawal failed");
      toast.error("Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawClick = async () => {
    setError("");
    
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!selectedAddress) {
      setError("Please select a destination address");
      return;
    }

    // Check 2FA/PIN requirements
    try {
      const configRes = await fetch("/api/v1/wallets/security/2fa/config", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      const config = await configRes.json();
      if (config.success) {
        setRequires2FA(config.config?.twoFA?.enabled || false);
        setRequiresPIN(config.config?.pin?.required || false);
      }

      // Start verification flow
      if (requires2FA) {
        await generateOTP();
      } else if (requiresPIN) {
        setShowPINModal(true);
        setWithdrawalStep('pin');
      } else {
        completeWithdrawal();
      }
    } catch (err: any) {
      setError("Failed to check security settings");
      toast.error("Security check failed");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Vault Selection */}
            {vaults && vaults.length > 1 && (
              <div>
                <label htmlFor="vault-select" className="block text-sm font-medium mb-1">Select Vault</label>
                <select
                  id="vault-select"
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

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <Input 
                type="number" 
                min="1" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="Enter amount"
                disabled={loading}
              />
            </div>

            {/* Currency */}
            <div>
              <label htmlFor="currency-select" className="block text-sm font-medium mb-1">Currency</label>
              <select
                id="currency-select"
                className="w-full p-2 rounded border"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                disabled={loading}
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="cUSD">cUSD</option>
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input 
                type="text" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Purpose or note (optional)"
                disabled={loading}
              />
            </div>

            {/* Provider */}
            <div>
              <label htmlFor="provider-select" className="block text-sm font-medium mb-1">Provider</label>
              <select
                id="provider-select"
                className="w-full p-2 rounded border"
                value={provider}
                onChange={e => setProvider(e.target.value)}
                disabled={loading}
              >
                {WITHDRAW_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Security Status */}
            {(requires2FA || requiresPIN) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  🔒 This withdrawal requires verification
                  {requires2FA && ' (2FA)'}
                  {requires2FA && requiresPIN && ' & '}
                  {requiresPIN && ' (PIN)'}
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleWithdrawClick} 
              disabled={loading || !amount || parseFloat(amount) <= 0}
            >
              {loading ? "Processing..." : "Proceed to Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Verification Modal */}
      <TwoFAVerificationModal
        open={show2FAModal}
        onClose={() => {
          setShow2FAModal(false);
          setWithdrawalStep('form');
        }}
        onVerified={handle2FAVerified}
        otpId={otpId}
        method="EMAIL"
        loading={loading}
      />

      {/* PIN Verification Modal */}
      <PINVerificationModal
        open={showPINModal}
        onClose={() => {
          setShowPINModal(false);
          setWithdrawalStep('form');
        }}
        onVerified={handlePINVerified}
        loading={loading}
      />
    </>
  );
}
