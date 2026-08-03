export const VaultCommandTypes = {
  CreateVault: 'CreateVault',
  DepositVault: 'DepositVault',
  WithdrawVault: 'WithdrawVault',
} as const;

export interface CreateVaultPayload {
  name: string;
  currency: string;
  riskLevel?: string;
  minDeposit?: string;
  metadata?: Record<string, any>;
  ownerType: 'user' | 'dao';
  ownerId: string;
}

export interface DepositVaultPayload {
  vaultId: string;
  vaultAddress: string; // The blockchain address of the vault
  userId: string; // The user making the deposit
  senderAddress: string; // The blockchain address of the sender
  tokenSymbol: string; // The token symbol being deposited
  amount: string; // The amount being deposited
  metadata?: Record<string, any>; // Optional metadata for the deposit
  transactionHash: string; // The blockchain transaction hash for the deposit
}

export interface WithdrawVaultPayload {
  vaultId: string;
  userId: string;
  shares: string; // The amount of shares to burn
  transactionHash: string;
  metadata?: Record<string, any>;
  vaultAddress: string; // The blockchain address of the vault
  recipientAddress: string; // The blockchain address of the recipient  
}
