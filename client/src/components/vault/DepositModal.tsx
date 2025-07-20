
// components/vault/DepositModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useState } from "react";
import { useAccount } from "wagmi";
import  {useVaultContract, useTokenBalance, useTokenApproval, useVaultDeposit}  from "@/pages/hooks/useVault";
import { parseEther, formatEther } from "viem";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";

export default function DepositModal({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const [amount, setAmount] = useState("10");
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { address } = useAccount();
  const vaultAddress = ""; // TODO: Pass vaultAddress as a prop or context
  const { data: vault } = useVaultContract(vaultAddress);
  const { data: balance, refetch: refetchBalance } = useTokenBalance(address ?? "");
  const { data: needsApproval, refetch: refetchApproval } = useTokenApproval(address ?? "", amount);
  const depositMutation = useVaultDeposit();
  const [isApproving, setIsApproving] = useState(false);

  const handleDeposit = async () => {
    if (!address || !amount) return;
    setError("");
    setIsDepositing(true);
    try {
      const value = parseEther(amount);
      // Check if user has enough balance
      if (balance && value > balance) {
        setError("Insufficient balance");
        setIsDepositing(false);
        return;
      }
      // Check if approval is needed
      if (needsApproval) {
        setIsApproving(true);
        // Simulate approval (replace with actual approval logic if needed)
        await refetchApproval();
        setIsApproving(false);
      }
      // Execute deposit using mutation
      await depositMutation.mutateAsync({ amount, currency: "cusd" });
      setSuccess(true);
      await refetchBalance();
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setAmount("10");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Transaction failed");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleApprove = async () => {
    setError("");
    setIsApproving(true);
    try {
      await refetchApproval();
    } catch (err: any) {
      setError(err.message || "Approval failed");
    } finally {
      setIsApproving(false);
    }
  };

  const isValidAmount = amount && parseFloat(amount) >= 10;
  const hasEnoughBalance = balance && parseEther(amount || "0") <= balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit to Maono Vault</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Balance Display */}
          <div className="text-sm text-gray-600">
            Available Balance: {balance ? formatEther(balance) : "0"} cUSD
          </div>
          
          {/* Amount Input */}
          <div className="space-y-2">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              placeholder="Amount in cUSD"
              min="10"
              step="0.01"
              className={!isValidAmount ? "border-red-300" : ""}
            />
            {!isValidAmount && (
              <p className="text-sm text-red-600">Minimum deposit is 10 cUSD</p>
            )}
            {isValidAmount && !hasEnoughBalance && (
              <p className="text-sm text-red-600">Insufficient balance</p>
            )}
          </div>
          
          {/* Error Alert */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Success Alert */}
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Deposit successful! Transaction confirmed.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Action Buttons */}
          <div className="space-y-2">
            {needsApproval && (
              <Button 
                onClick={handleApprove}
                disabled={!address || isApproving || !isValidAmount}
                className="w-full"
                variant="outline"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Approve cUSD"
                )}
              </Button>
            )}
            
            <Button 
              onClick={handleDeposit}
              disabled={
                !address || 
                !isValidAmount || 
                !hasEnoughBalance || 
                isDepositing || 
                needsApproval ||
                success
              }
              className="w-full"
            >
              {isDepositing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Depositing...
                </>
              ) : (
                "Confirm Deposit"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

