// MtaaDAO: useVaultHooks.ts — Unified hooks for Personal and Community Vaults

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from "wagmi";
import { parseEther, formatEther, Address } from "viem";
import { toast } from "sonner";
import MaonoVaultABI from "../../../contracts/MaonoVault.json";

// Vault contract addresses (update these with deployed addresses)
const VAULT_ADDRESSES = {
  42220: "0x...", // Celo Mainnet
  44787: "0x...", // Alfajores Testnet
} as const;

export interface VaultInfo {
  tvl: bigint;
  sharePrice: bigint;
  cap: bigint;
  minDeposit: bigint;
  isPaused: boolean;
}

export interface VaultBalance {
  shares: bigint;
  assets: bigint;
  valueUSD: string;
}

// Get vault contract instance
export function useVaultContract(vaultAddress: string) {
  return useQuery({
    queryKey: ["vaultContract", vaultAddress],
    queryFn: async () => {
      if (!vaultAddress) return null;
      return {
        address: vaultAddress as Address,
        abi: MaonoVaultABI.abi,
      };
    },
    enabled: !!vaultAddress,
  });
}

// Get vault information
export function useVaultInfo(vaultAddress: string) {
  const { data: contract } = useVaultContract(vaultAddress);

  return useContractRead({
    ...contract,
    functionName: "getVaultInfo",
    enabled: !!contract,
    select: (data: any) => ({
      tvl: data[0],
      sharePrice: data[1],
      cap: data[2],
      minDeposit: data[3],
      isPaused: data[4],
    }),
  });
}

// Get user's vault balance
export function useVaultBalance(userAddress: string, vaultAddress: string) {
  const { data: contract } = useVaultContract(vaultAddress);

  const { data: shares } = useContractRead({
    ...contract,
    functionName: "balanceOf",
    args: [userAddress as Address],
    enabled: !!contract && !!userAddress,
  });

  const { data: assets } = useContractRead({
    ...contract,
    functionName: "convertToAssets",
    args: [shares || BigInt(0)],
    enabled: !!contract && !!shares,
  });

  return useQuery({
    queryKey: ["vaultBalance", userAddress, vaultAddress, shares, assets],
    queryFn: async () => {
      if (!shares || !assets) return null;

      // Get USD value from API
      const response = await fetch(`/api/vault/balance-usd?shares=${shares}&vault=${vaultAddress}`);
      const { valueUSD } = await response.json();

      return {
        shares,
        assets,
        valueUSD,
      };
    },
    enabled: !!shares && !!assets,
    refetchInterval: 30000,
  });
}

// Get token balance for deposits
export function useTokenBalance(userAddress: string, tokenAddress?: string) {
  return useContractRead({
    address: tokenAddress as Address,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [userAddress as Address],
    enabled: !!userAddress && !!tokenAddress,
  });
}

// Check token approval
export function useTokenApproval(userAddress: string, amount: string, tokenAddress?: string, vaultAddress?: string) {
  const { data: allowance } = useContractRead({
    address: tokenAddress as Address,
    abi: [
      {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" }
        ],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "allowance",
    args: [userAddress as Address, vaultAddress as Address],
    enabled: !!userAddress && !!tokenAddress && !!vaultAddress,
  });

  return useQuery({
    queryKey: ["tokenApproval", userAddress, amount, tokenAddress, vaultAddress, allowance],
    queryFn: () => {
      if (!allowance || !amount) return false;
      return allowance < parseEther(amount);
    },
    enabled: !!allowance && !!amount,
  });
}

// Vault deposit mutation
export function useVaultDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, currency, vaultAddress }: { 
      amount: string; 
      currency: string; 
      vaultAddress: string;
    }) => {
      // Call backend API to handle deposit
      const response = await fetch("/api/vault/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, vaultAddress }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Deposit failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaultBalance"] });
      queryClient.invalidateQueries({ queryKey: ["vaultInfo"] });
      toast.success("Deposit successful!");
    },
    onError: (error: Error) => {
      toast.error(`Deposit failed: ${error.message}`);
    },
  });
}

// Vault withdrawal mutation
export function useVaultWithdraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, currency, destination }: { 
      amount: string; 
      currency: string; 
      destination: string;
    }) => {
      const response = await fetch("/api/vault/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, destination }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Withdrawal failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaultBalance"] });
      queryClient.invalidateQueries({ queryKey: ["vaultInfo"] });
      toast.success("Withdrawal successful!");
    },
    onError: (error: Error) => {
      toast.error(`Withdrawal failed: ${error.message}`);
    },
  });
}

// Get vault performance data
export function useVaultPerformance(vaultAddress: string, period: "24h" | "7d" | "30d" = "7d") {
  return useQuery({
    queryKey: ["vaultPerformance", vaultAddress, period],
    queryFn: async () => {
      const response = await fetch(`/api/vault/performance?vault=${vaultAddress}&period=${period}`);
      return response.json();
    },
    enabled: !!vaultAddress,
    refetchInterval: 300000, // 5 minutes
  });
}

// Get vault transactions
export function useVaultTransactions(vaultAddress: string, page: number = 1) {
  return useQuery({
    queryKey: ["vaultTransactions", vaultAddress, page],
    queryFn: async () => {
      const response = await fetch(`/api/vault/transactions?vault=${vaultAddress}&page=${page}`);
      return response.json();
    },
    enabled: !!vaultAddress,
  });
}