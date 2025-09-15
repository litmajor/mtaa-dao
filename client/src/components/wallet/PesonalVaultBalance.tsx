// MtaaDAO Phase 3.1+ Personal Vault Section (Send, Receive, Deposit, Withdraw)

import { useState } from "react"
import { useWallet } from "@/pages/hooks/useWallet"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import BigNumber from "bignumber.js"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LockedSavingsSection } from "./LockedSavingsSection"
import { motion } from "framer-motion"
import { Wallet, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import { currentNetwork } from "@/lib/blockchain"
// import QRCode from "react-qr-code" // Uncomment if installed

const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr)
const isValidAmount = (value: string) => {
  try {
    const bn = new BigNumber(value)
    return bn.isGreaterThan(0) && bn.isFinite()
  } catch {
    return false
  }
}


// Example: In a real app, fetch these from API or context
const useVaultCounts = () => {
  // Demo: 1 personal, 1 DAO, 2 multisig vaults
  return {
    personal: 1,
    dao: 1,
    multisig: 2,
    total: 4
  };
};

export function PersonalVaultSection() {
  const vaultCounts = useVaultCounts();
  // Get user ID from auth context or props
  const userId = "current-user-id"; // Replace with actual user ID from auth context
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Your Personal Vault</h2>
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Vaults: {vaultCounts.total}</span>
        <span>Personal: {vaultCounts.personal}</span>
        <span>DAO: {vaultCounts.dao}</span>
        <span>Multisig: {vaultCounts.multisig}</span>
      </div>
      <VaultBalanceCard />
      <VaultReceiveCard />
      <VaultSendCard />
      <VaultDepositCard />
      <VaultWithdrawCard />
      
      {/* Enhanced: Locked Savings and Goals */}
      <LockedSavingsSection userId={userId} />
    </div>
  );
}

function VaultBalanceCard() {
  const { address, refreshBalances, isRefreshingBalances } = useWallet();
  const queryClient = useQueryClient();
  
  const { data: celo = "0", isLoading: celoLoading } = useQuery({
    queryKey: ["celo", address],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/balance/celo?user=${address}`);
      const { balance } = await res.json();
      return balance;
    },
    enabled: !!address,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const { data: cusd = "0", isLoading: cusdLoading } = useQuery({
    queryKey: ["cusd", address],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/balance/cusd?user=${address}`);
      const { balance } = await res.json();
      return balance;
    },
    enabled: !!address,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  const isLoading = celoLoading || cusdLoading;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 border rounded-xl space-y-4"
    >
      <div className="flex items-center justify-between">
        <motion.div variants={itemVariants} className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Wallet Balance</h3>
        </motion.div>
        <motion.button
          variants={itemVariants}
          onClick={async () => {
            await refreshBalances();
            // Also refresh React Query data
            if (address) {
              queryClient.invalidateQueries({ queryKey: ["celo", address] });
              queryClient.invalidateQueries({ queryKey: ["cusd", address] });
            }
          }}
          disabled={isRefreshingBalances}
          className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshingBalances ? 'animate-spin' : ''} text-gray-600 dark:text-gray-400`} />
        </motion.button>
      </div>

      <motion.div variants={itemVariants} className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <p className="break-all">
          <span className="font-medium">Address:</span> {address || 'Not connected'}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          variants={itemVariants}
          className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-lg backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CELO</span>
          </div>
          <motion.p 
            className="text-xl font-bold text-gray-900 dark:text-gray-100"
            key={celo} // Re-animate when value changes
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            {isLoading ? (
              <span className="animate-pulse bg-gray-300 dark:bg-gray-600 rounded h-6 w-16 block"></span>
            ) : (
              parseFloat(celo).toFixed(4)
            )}
          </motion.p>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-lg backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">cUSD</span>
          </div>
          <motion.p 
            className="text-xl font-bold text-gray-900 dark:text-gray-100"
            key={cusd} // Re-animate when value changes
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            {isLoading ? (
              <span className="animate-pulse bg-gray-300 dark:bg-gray-600 rounded h-6 w-16 block"></span>
            ) : (
              `$${parseFloat(cusd).toFixed(2)}`
            )}
          </motion.p>
        </motion.div>
      </div>

      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/10 to-indigo-400/10 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full translate-y-12 -translate-x-12"></div>
    </motion.div>
  );
}

function VaultReceiveCard() {
  const { address } = useWallet();
  return (
    <div className="p-4 border rounded-xl space-y-2">
      <h3 className="text-lg font-semibold">Receive</h3>
      <p className="text-sm">Your Address:</p>
      <code className="block text-xs break-all">{address}</code>
      {/* Uncomment below if QRCode is installed */}
      {/* <QRCode value={address || ""} size={128} className="mx-auto" /> */}
    </div>
  );
}

function VaultSendCard() {
  const { address, sendTransaction, isConnected } = useWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"cUSD" | "CELO">("cUSD");

  const handleSend = async () => {
    if (!isConnected) return toast.error("Wallet not connected");
    if (!isValidAddress(to)) return toast.error("Invalid address format");
    if (!isValidAmount(amount)) return toast.error("Invalid amount");

    try {
      toast.loading("Sending transaction...");
      // sendTransaction expects (to, amount, tokenAddress?) parameters  
      // Use correct cUSD address based on current network
      const cUSDAddresses: Record<number, string> = {
        42220: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // Mainnet
        44787: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"  // Alfajores testnet
      };
      const tokenAddress = currency === "cUSD" ? 
        cUSDAddresses[currentNetwork.id as number] || cUSDAddresses[44787] // Default to testnet
        : undefined;
      const txHash = await sendTransaction(to, amount, tokenAddress);
      toast.success("Transaction sent", {
        action: {
          label: "Explorer",
          onClick: () => window.open(`${currentNetwork.blockExplorers?.default.url}/tx/${txHash}`, "_blank"),
        },
      });
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
  };

  return (
    <div className="p-4 border rounded-xl space-y-2">
      <h3 className="text-lg font-semibold">Send</h3>
      <Input placeholder="Recipient address" value={to} onChange={e => setTo(e.target.value)} />
      <Input placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
      <label htmlFor="currency-select" className="text-sm font-medium">
        Currency
      </label>
      <select
        id="currency-select"
        value={currency}
        onChange={e => setCurrency(e.target.value as "cUSD" | "CELO")}
        className="w-full border rounded p-2 text-sm"
      >
        <option value="cUSD">cUSD</option>
        <option value="CELO">CELO</option>
      </select>
      <Button onClick={handleSend}>Send</Button>
    </div>
  );
}

function VaultDepositCard() {
  return (
    <div className="p-4 border rounded-xl">
      <h3 className="text-lg font-semibold">Deposit</h3>
      <p className="text-sm text-muted">Coming soon: link to bank, M-Pesa, or exchange onramp.</p>
    </div>
  )
}

function VaultWithdrawCard() {
  return (
    <div className="p-4 border rounded-xl">
      <h3 className="text-lg font-semibold">Withdraw</h3>
      <p className="text-sm text-muted">Coming soon: withdraw to bank, M-Pesa, or external wallet.</p>
    </div>
  )
}
