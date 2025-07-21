// MtaaDAO Phase 3.1+ Personal Vault Section (Send, Receive, Deposit, Withdraw)

import { useState } from "react"
import { useWallet } from "@/pages/hooks/useWallet"
import { useQuery } from "@tanstack/react-query"
import BigNumber from "bignumber.js"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
    </div>
  );
}

function VaultBalanceCard() {
  const { address } = useWallet();
  const { data: celo = "0" } = useQuery({
    queryKey: ["celo", address],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/balance/celo?user=${address}`);
      const { balance } = await res.json();
      return balance;
    },
    enabled: !!address
  });

  const { data: cusd = "0" } = useQuery({
    queryKey: ["cusd", address],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/balance/cusd?user=${address}`);
      const { balance } = await res.json();
      return balance;
    },
    enabled: !!address
  });

  return (
    <div className="p-4 border rounded-xl space-y-1 text-sm">
      <p><strong>Address:</strong> {address}</p>
      <p><strong>CELO:</strong> {String(celo)}</p>
      <p><strong>cUSD:</strong> {String(cusd)}</p>
    </div>
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
      const txHash = await sendTransaction({ to, amount, currency });
      toast.success("Transaction sent", {
        action: {
          label: "Explorer",
          onClick: () => window.open(`https://celoscan.io/tx/${txHash}`, "_blank"),
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
      <select
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
