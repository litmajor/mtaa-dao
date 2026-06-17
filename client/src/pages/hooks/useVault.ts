// MtaaDAO: useVaultHooks.ts — Unified hooks for Personal and Community Vaults

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
// ethers is imported dynamically in query functions to reduce initial bundle size
import { toast } from "sonner";

// Temporarily disable the contract import to fix loading issues
// import MaonoVaultABI from "../../../../contracts/MaonoVault.json";
const MaonoVaultABI = { abi: [] }; // Fallback for now

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
        address: vaultAddress as string,
        abi: MaonoVaultABI.abi,
      };
    },
    enabled: !!vaultAddress,
  });
}

// Get vault information
export function useVaultInfo(vaultAddress: string) {
  const { data: contract } = useVaultContract(vaultAddress);
  if (!contract) return { data: undefined };
  const queryKey = ["vaultInfo", String(contract?.address)];
  const contractRead = useQuery({
    queryKey,
    queryFn: async () => {
      if (!contract) return undefined;
      const { ethers } = await import('ethers');
      const provider = ethers.getDefaultProvider();
      const c = new ethers.Contract(contract.address as string, contract.abi as any, provider);
      return await c['getVaultInfo']();
    },
    enabled: !!contract,
  }) as unknown as {
    data?: [bigint, bigint, bigint, bigint, boolean];
    isLoading?: boolean;
    isError?: boolean;
    error?: Error;
  };

  const data = contractRead.data
    ? {
        tvl: contractRead.data[0] ?? BigInt(0),
        sharePrice: contractRead.data[1] ?? BigInt(0),
        cap: contractRead.data[2] ?? BigInt(0),
        minDeposit: contractRead.data[3] ?? BigInt(0),
        isPaused: contractRead.data[4] ?? false,
      }
    : undefined;

  return { ...contractRead, data };
}

// Get user's vault balance
export function useVaultBalance(userAddress: string, vaultAddress: string) {
  const { data: contract } = useVaultContract(vaultAddress);
  const sharesQuery = useQuery({
    queryKey: ["vaultShares", String(contract?.address), String(userAddress)],
    queryFn: async () => {
      if (!contract || !userAddress) return undefined;
      const { ethers } = await import('ethers');
      const provider = ethers.getDefaultProvider();
      const c = new ethers.Contract(contract.address as string, contract.abi as any, provider);
      return (await c['balanceOf'](userAddress as string)) as bigint;
    },
    enabled: !!contract && !!userAddress,
  });

  const assetsQuery = useQuery({
    queryKey: ["vaultAssets", String(contract?.address), String(sharesQuery.data ?? '')],
    queryFn: async () => {
      if (!contract || !sharesQuery.data) return undefined;
      const { ethers } = await import('ethers');
      const provider = ethers.getDefaultProvider();
      const c = new ethers.Contract(contract.address as string, contract.abi as any, provider);
      return (await c['convertToAssets'](sharesQuery.data || BigInt(0))) as bigint;
    },
    enabled: !!contract && !!sharesQuery.data,
  });

  return useQuery({
    queryKey: ["vaultBalance", String(userAddress), String(vaultAddress), String(sharesQuery.data ?? ''), String(assetsQuery.data ?? '')],
    queryFn: async () => {
      if (!sharesQuery.data || !assetsQuery.data) return null;
      const response = await fetch(`/api/v1/wallets/vaults/balance-usd?shares=${sharesQuery.data}&vault=${vaultAddress}`);
      const { valueUSD } = await response.json();
      return { shares: sharesQuery.data, assets: assetsQuery.data, valueUSD };
    },
    enabled: !!sharesQuery.data && !!assetsQuery.data,
    refetchInterval: 30000,
  });
}

// Get token balance for deposits
export function useTokenBalance(userAddress: string, tokenAddress?: string) {
  if (!userAddress || !tokenAddress) return { data: undefined };
    return useQuery({
      queryKey: ["tokenBalance", String(tokenAddress), String(userAddress)],
      queryFn: async () => {
        const { ethers } = await import('ethers');
        const provider = ethers.getDefaultProvider();
        const c = new ethers.Contract(tokenAddress as string, [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ], provider);
        return (await c['balanceOf'](userAddress as string)) as bigint;
      },
      enabled: !!userAddress && !!tokenAddress,
    });
}

// Check token approval
export function useTokenApproval(userAddress: string, amount: string, tokenAddress?: string, vaultAddress?: string) {
  const allowance = userAddress && tokenAddress && vaultAddress
      ? useQuery({
          queryKey: ["tokenAllowance", String(tokenAddress), String(userAddress), String(vaultAddress)],
          queryFn: async () => {
            const { ethers } = await import('ethers');
            const provider = ethers.getDefaultProvider();
            const c = new ethers.Contract(tokenAddress as string, [
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
            ], provider);
            return (await c['allowance'](userAddress as string, vaultAddress as string)) as bigint;
        },
        enabled: !!userAddress && !!tokenAddress && !!vaultAddress,
      }).data
    : undefined;

  return useQuery({
    queryKey: [
      "tokenApproval",
      String(userAddress ?? ''),
      String(amount ?? ''),
      String(tokenAddress ?? ''),
      String(vaultAddress ?? ''),
      String(allowance ?? ''),
    ],
    queryFn: async () => {
      if (!allowance || !amount) return false;
      const { parseEther } = await import('ethers');
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
      const response = await fetch("/api/v1/wallets/vaults/deposit", {
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
      const response = await fetch("/api/v1/wallets/vaults/withdraw", {
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
      const response = await fetch(`/api/v1/wallets/vaults/performance?vault=${vaultAddress}&period=${period}`);
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
      const response = await fetch(`/api/v1/wallets/vaults/transactions?vault=${vaultAddress}&page=${page}`);
      return response.json();
    },
    enabled: !!vaultAddress,
  });
}