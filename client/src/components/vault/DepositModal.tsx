
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useVaultContract, useTokenBalance, useTokenApproval, useVaultDeposit } from "@/pages/hooks/useVault";
import { parseEther, formatEther } from "viem";
import { AlertCircle, CheckCircle, Loader2, Info, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { currentNetwork } from "@/lib/blockchain";

// Token addresses on Celo networks
const TOKEN_ADDRESSES = {
  42220: { // Celo Mainnet
    cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    CELO: "0x471EcE3750Da237f93B8E339c536989b8978a438",
  },
  44787: { // Alfajores Testnet
    cUSD: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
    CELO: "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9",
  },
};

const DEMO_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890";

export default function DepositModal({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const [amount, setAmount] = useState("10");
  const [currency, setCurrency] = useState<"cUSD" | "CELO">("cUSD");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState("");

  const { address } = useAccount();
  const { data: vault } = useVaultContract(DEMO_VAULT_ADDRESS);
  
  // Get token address for current network
  const tokenAddress = TOKEN_ADDRESSES[currentNetwork.id as keyof typeof TOKEN_ADDRESSES]?.[currency];
  
  const { data: balance, refetch: refetchBalance } = useTokenBalance(address ?? "", tokenAddress);
  const { data: needsApproval, refetch: refetchApproval } = useTokenApproval(
    address ?? "", 
    amount, 
    tokenAddress, 
    DEMO_VAULT_ADDRESS
  );
  
  const depositMutation = useVaultDeposit();

  const handleApprove = async () => {
    if (!address || !tokenAddress) return;
    setError("");
    setIsApproving(true);

    try {
      // Call approval API endpoint
      const response = await fetch("/api/vault/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress,
          spender: DEMO_VAULT_ADDRESS,
          amount: parseEther(amount).toString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Approval failed");
      }

      const { txHash } = await response.json();
      setTxHash(txHash);
      
      // Wait for transaction and refresh approval status
      setTimeout(async () => {
        await refetchApproval();
      }, 3000);

    } catch (err: any) {
      setError(err.message || "Approval failed");
    } finally {
      setIsApproving(false);
    }
  };

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

      // Check minimum deposit (10 for demo)
      if (parseFloat(amount) < 10) {
        setError("Minimum deposit is 10 tokens");
        setIsDepositing(false);
        return;
      }

      // Execute deposit using mutation
      const result = await depositMutation.mutateAsync({
        amount,
        currency,
        vaultAddress: DEMO_VAULT_ADDRESS,
      });

      setTxHash(result.txHash);
      setSuccess(true);
      await refetchBalance();
      
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setAmount("10");
        setTxHash("");
      }, 3000);

    } catch (err: any) {
      setError(err.message || "Transaction failed");
    } finally {
      setIsDepositing(false);
    }
  };

  const isValidAmount = amount && parseFloat(amount) >= 10;
  const hasEnoughBalance = balance && parseEther(amount || "0") <= balance;
  const canDeposit = isValidAmount && hasEnoughBalance && !needsApproval;

  const explorerUrl = `${currentNetwork.blockExplorers?.default.url}/tx/${txHash}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit to Maono Vault</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Currency Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "cUSD" | "CELO")}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cUSD">cUSD (Celo Dollar)</option>
              <option value="CELO">CELO (Native Token)</option>
            </select>
          </div>

          {/* Balance Display */}
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <div className="flex justify-between">
              <span>Available Balance:</span>
              <span className="font-medium">
                {balance ? `${parseFloat(formatEther(balance)).toFixed(4)} ${currency}` : `0 ${currency}`}
              </span>
            </div>
          </div>
          
          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount to Deposit</label>
            <div className="relative">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                placeholder="Amount"
                min="10"
                step="0.01"
                className={!isValidAmount ? "border-red-300" : ""}
              />
              <span className="absolute right-3 top-2.5 text-sm text-gray-500">{currency}</span>
            </div>
            {!isValidAmount && (
              <p className="text-sm text-red-600">Minimum deposit is 10 {currency}</p>
            )}
            {isValidAmount && !hasEnoughBalance && (
              <p className="text-sm text-red-600">Insufficient balance</p>
            )}
          </div>

          {/* Vault Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Deposits earn rewards automatically. You'll receive vault shares representing your portion of the pool.
            </AlertDescription>
          </Alert>
          
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
                <div className="space-y-2">
                  <p>Deposit successful! Transaction confirmed.</p>
                  {txHash && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 underline"
                    >
                      View on Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
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
                    Approving {currency}...
                  </>
                ) : (
                  `Approve ${currency} Spending`
                )}
              </Button>
            )}
            
            <Button 
              onClick={handleDeposit}
              disabled={
                !address || 
                !canDeposit || 
                isDepositing || 
                success ||
                isApproving
              }
              className="w-full"
            >
              {isDepositing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Depositing...
                </>
              ) : (
                `Deposit ${amount} ${currency}`
              )}
            </Button>
          </div>

          {/* Transaction Hash */}
          {txHash && !success && (
            <div className="text-xs text-gray-500 break-all">
              <p>Transaction: {txHash}</p>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline flex items-center gap-1 mt-1"
              >
                View on Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
