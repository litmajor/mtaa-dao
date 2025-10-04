// components/vault/WithdrawalModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useVaultContract, useTokenBalance, useVaultWithdraw } from "@/pages/hooks/useVault";
import { parseEther, formatEther } from "viem";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";

export default function WithdrawalModal({
  open,
  onOpenChange,
  vaultAddress
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultAddress: string;
}) {
  const [amount, setAmount] = useState("10");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { address } = useAccount();
  const { data: vault } = useVaultContract(vaultAddress);
  const { data: balance } = useTokenBalance(address ?? "", vaultAddress);
  const withdrawMutation = useVaultWithdraw();

  const handleWithdraw = async () => {
    if (!vault || !address || !amount) return;
    setError("");
    setIsWithdrawing(true);
    try {
      const value = parseEther(amount);
      // Check if user has enough vault balance
      if (balance && value > balance) {
        setError("Insufficient vault balance");
        setIsWithdrawing(false);
        return;
      }
      // Execute withdrawal using mutation
      await withdrawMutation.mutateAsync({
        amount,
        currency: "cusd",
        destination: address
      });
      setSuccess(true);
      // Optionally trigger a refresh here if needed, e.g., by re-calling useTokenBalance or using a state update
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setAmount("10");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Transaction failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const isValidAmount = amount && parseFloat(amount) >= 10;
  const hasEnoughBalance = balance && parseEther(amount || "0") <= balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw from Maono Vault</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Vault Balance Display */}
          <div className="text-sm text-gray-600">
            Vault Balance: {balance ? formatEther(balance) : "0"} cUSD
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
              <p className="text-sm text-red-600">Minimum withdrawal is 10 cUSD</p>
            )}
            {isValidAmount && !hasEnoughBalance && (
              <p className="text-sm text-red-600">Insufficient vault balance</p>
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
                Withdrawal successful! Transaction confirmed.
              </AlertDescription>
            </Alert>
          )}
          {/* Action Button */}
          <Button
            onClick={handleWithdraw}
            disabled={
              !address ||
              !isValidAmount ||
              !hasEnoughBalance ||
              isWithdrawing ||
              success
            }
            className="w-full"
          >
            {isWithdrawing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Withdrawing...
              </>
            ) : (
              "Confirm Withdrawal"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
