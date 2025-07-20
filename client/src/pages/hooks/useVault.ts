// MtaaDAO: useVaultHooks.ts — Unified hooks for Personal and Community Vaults

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useWallet } from "@/pages/hooks/useWallet"
// ...existing code...

// 📦 Fetch Vault Balance
export function useVaultBalance(userAddress: string, currency: string = "cusd") {
  return useQuery({
    queryKey: ["vault-balance", userAddress, currency],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/balance/${currency}?user=${userAddress}`)
      const { balance } = await res.json()
      return balance
    },
    enabled: !!userAddress
  })
}

// 📜 Fetch Vault Transaction History with Filters
export function useVaultTransactions(userAddress: string, options: { startDate?: string, endDate?: string, currency?: string } = {}) {
  const params = new URLSearchParams()
  if (options.startDate) params.append("start", options.startDate)
  if (options.endDate) params.append("end", options.endDate)
  if (options.currency) params.append("currency", options.currency)

  return useQuery({
    queryKey: ["vault-transactions", userAddress, options],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/history?user=${userAddress}&${params.toString()}`)
      return await res.json()
    },
    enabled: !!userAddress
  })
}

// 💸 Send Transaction
export function useVaultSend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ to, amount, currency, otp }: { to: string, amount: string, currency: string, otp?: string }) => {
      const res = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, amount, currency, otp })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Send failed")
      return json
    },
    onSuccess: () => {.3
      queryClient.invalidateQueries({ queryKey: ["vault-balance"] })
    }
  })
}

// 🏛️ Deposit placeholder
export function useVaultDeposit() {
  return useMutation({
    mutationFn: async ({ amount, currency }: { amount: string, currency: string }) => {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Deposit failed")
      return json
    }
  })
}

// 🏦 Withdraw placeholder with Guardian Approval
export function useVaultWithdraw() {
  return useMutation({
    mutationFn: async ({ amount, currency, destination, guardianToken }: { amount: string, currency: string, destination: string, guardianToken?: string }) => {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, destination, guardianToken })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Withdraw failed")
      return json
    }
  })
}
// 🔄 Refresh Vault Data
export function useVaultRefresh() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ["vault-balance"] })
    queryClient.invalidateQueries({ queryKey: ["vault-transactions"] })
    queryClient.invalidateQueries({ queryKey: ["vault-stats"] })
  }
}

// 📊 Fetch Vault Stats
export function useVaultStats() {
  const { address } = useWallet()
  const safeAddress = typeof address === "string" ? address : ""
  const { data: balance } = useVaultBalance(safeAddress)
  const { data: transactions } = useVaultTransactions(safeAddress)

  // Calculate stats from transactions
  const stats = transactions ? {
    totalVolume: transactions.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0),
    totalCount: transactions.length,
    lastTransaction: transactions[0]
  } : null

  return {
    balance,
    transactions,
    stats
  }
}
// 🏦 Fetch Vaults for User
export function useUserVaults(userAddress: string) {
  return useQuery({
    queryKey: ["user-vaults", userAddress],
    queryFn: async () => {
      const res = await fetch(`/api/vaults?user=${userAddress}`)
      return await res.json()
    },
    enabled: !!userAddress
  })
}
// 🏛️ Fetch Community Vaults
export function useCommunityVaults() {
  return useQuery({
    queryKey: ["community-vaults"],
    queryFn: async () => {
      const res = await fetch(`/api/vaults?community=true`)
      return await res.json()
    }
  })
}
// 🏦 Fetch Personal Vaults
export function usePersonalVaults(userAddress: string) {
  return useQuery({
    queryKey: ["personal-vaults", userAddress],
    queryFn: async () => {
      const res = await fetch(`/api/vaults?user=${userAddress}&personal=true`)
      return await res.json()
    },
    enabled: !!userAddress
  })
}
// 🏦 Fetch Vault by ID
export function useVaultById(vaultId: string) {
  return useQuery({
    queryKey: ["vault", vaultId],
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}`)
      return await res.json()
    },
    enabled: !!vaultId
  })
}
// 🏦 Create New Vault
export function useCreateVault() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, description, currency }: { name: string, description?: string, currency?: string }) => {
      const res = await fetch("/api/vaults/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, currency })
      })  
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Vault creation failed")
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-vaults"] })
      queryClient.invalidateQueries({ queryKey: ["community-vaults"] })
      queryClient.invalidateQueries({ queryKey: ["personal-vaults"] })
      queryClient.invalidateQueries({ queryKey: ["vaults"] })
      queryClient.invalidateQueries({ queryKey: ["vault"] })
    }
  })
}

export function useVaultContract(vaultAddress: string) {
  const { address } = useWallet()
  const safeAddress = typeof address === "string" ? address : ""

  return useQuery({
    queryKey: ["vault-contract", vaultAddress, safeAddress],
    queryFn: async () => {
      if (!vaultAddress) throw new Error("Vault address is required")
      const res = await fetch(`/api/vaults/contract/${vaultAddress}?user=${safeAddress}`)
      
      if (!res.ok) throw new Error("Failed to fetch vault contract")
      const contractData = await res.json()
      
      return contractData
    },
    enabled: !!vaultAddress && !!safeAddress
  })
}
// 🏦 Fetch Vault Members
export function useVaultMembers(vaultAddress: string) {
  const { address } = useWallet()
  const safeAddress = typeof address === "string" ? address : ""
  return useQuery({
    queryKey: ["vault-members", vaultAddress, safeAddress],
    queryFn: async () => {
      if (!vaultAddress) throw new Error("Vault address is required")
      const res = await fetch(`/api/vaults/members/${vaultAddress}?user=${safeAddress}`)
      if (!res.ok) throw new Error("Failed to fetch vault members")
      const members = await res.json()
      
      return members
    },
    enabled: !!vaultAddress && !!safeAddress
  })
}

export function useTokenBalance(address: string, tokenAddress?: string) {
  return useQuery({
    queryKey: ["token-balance", address, tokenAddress],
    queryFn: async () => {
      if (!address) throw new Error("Address is required")
      const res = await fetch(`/api/tokens/balance?address=${address}${tokenAddress ? `&token=${tokenAddress}` : ""}`)
      if (!res.ok) throw new Error("Failed to fetch token balance")
      const { balance } = await res.json()
      return balance
    }
    ,
    enabled: !!address
  })
}
export function useTokenApproval(address: string, amount: string, tokenAddress?: string) {
  return useQuery({
    queryKey: ["token-approval", address, amount, tokenAddress],
    queryFn: async () => {
      if (!address || !amount) throw new Error("Address and amount are required")
      const res = await fetch(`/api/tokens/approval?address=${address}&amount=${amount}${tokenAddress ? `&token=${tokenAddress}` : ""}`)
      
      if (!res.ok) throw new Error("Failed to check token approval")
      const { needsApproval } = await res.json()
      return needsApproval
    },
    enabled: !!address && !!amount
  })
}



// Types for Mpesa Payment
export interface MpesaPaymentRequest {
  phone: string
  amount: string
  daoId: string
  accountReference?: string
  description?: string
  billingType?: 'premium' | 'upgrade' | 'deposit'
}

export interface MpesaPaymentResponse {
  success: boolean
  transactionId: string
  message: string
  checkoutRequestID?: string
  merchantRequestID?: string
}

export interface MpesaError {
  code: string
  message: string
  details?: any
}

// 📱 Initiate Mpesa Payment
export function useMpesaPayment() {
  const queryClient = useQueryClient()
  return useMutation<MpesaPaymentResponse, MpesaError, MpesaPaymentRequest>({
    mutationFn: async (payload) => {
      try {
        // Validate phone number format (Kenya)
        if (!/^254[17]\d{8}$/.test(payload.phone)) {
          throw { code: 'INVALID_PHONE', message: 'Invalid phone number format. Use 254XXXXXXXXX' }
        }

        // Validate amount
        const numAmount = parseFloat(payload.amount)
        if (isNaN(numAmount) || numAmount <= 0) {
          throw { code: 'INVALID_AMOUNT', message: 'Invalid amount' }
        }

        const res = await fetch("/api/payments/mpesa/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        const json = await res.json()
        
        if (!res.ok) {
          throw {
            code: json.code || 'PAYMENT_FAILED',
            message: json.message || 'Mpesa payment initiation failed',
            details: json.details
          }
        }

        return json
      } catch (error: any) {
        // Format error consistently
        throw {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message || 'An unexpected error occurred',
          details: error.details || error
        }
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries after successful payment initiation
      queryClient.invalidateQueries({ queryKey: ["vault-balance"] })
      queryClient.invalidateQueries({ queryKey: ["vault-transactions"] })
      if (variables.billingType) {
        queryClient.invalidateQueries({ queryKey: ["dao-premium-status"] })
      }
    }
  })
}

// Types for Mpesa Status
export interface MpesaPaymentStatus {
  status: 'pending' | 'completed' | 'failed'
  transactionId: string
  resultCode?: string
  resultDesc?: string
  amount?: string
  receipt?: string
  timestamp?: string
  phoneNumber?: string
  error?: MpesaError
}

// 🔍 Check Mpesa Payment Status
export function useMpesaPaymentStatus(transactionId?: string) {
  return useQuery<MpesaPaymentStatus, MpesaError>({
    queryKey: ["mpesa-payment", transactionId],
    queryFn: async () => {
      try {
        if (!transactionId) {
          throw { code: 'NO_TRANSACTION', message: 'Transaction ID is required' }
        }

        const res = await fetch(`/api/payments/mpesa/status/${transactionId}`)
        const json = await res.json()

        if (!res.ok) {
          throw {
            code: json.code || 'STATUS_CHECK_FAILED',
            message: json.message || 'Failed to check payment status',
            details: json.details
          }
        }

        return json as MpesaPaymentStatus;
      } catch (error: any) {
        throw {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message || 'An unexpected error occurred',
          details: error.details || error
        }
      }
    },
    enabled: !!transactionId,
    refetchInterval: (query) => {
      // query.state.data is MpesaPaymentStatus
      return query.state.data?.status === "pending" ? 5000 : false;
    },
    retry: (failureCount, error) => {
      // Only retry 3 times for certain errors
      return failureCount < 3 && error.code !== 'NO_TRANSACTION'
    }
  })
}
