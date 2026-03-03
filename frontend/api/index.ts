/**
 * API Integration Layer
 * 
 * This module handles all API calls for SendFlow, ProposalVoting, and SecuritySettings
 * Replace the API_BASE_URL and implement real endpoint calls here
 * 
 * PHASE 1 FIX: Wallet Signature Verification
 * All wallet transactions now require EIP-191 signed messages for security
 * 
 * Mock → Real Transition:
 * 1. Update API_BASE_URL to your backend
 * 2. Replace mock response with real fetch calls
 * 3. Handle real error responses
 * 4. Add auth headers if needed
 */

import { BrowserProvider } from 'ethers';

// Extend Window type for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const AUTH_TOKEN = localStorage.getItem('auth_token'); // Example: get from auth context

// PHASE 1 FIX: Helper to get signer from Ethereum provider
async function getSigner() {
  if (!window.ethereum) {
    throw new Error('Web3 wallet not detected. Please install MetaMask or similar.');
  }
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

// PHASE 1 FIX: Helper to generate nonce for replay protection
function generateNonce(): number {
  return Math.floor(Math.random() * 1000000);
}

// ==================== SENDFLOW API ====================

export interface SendFlowEstimateResponse {
  fee: string;
  estimatedTime: string;
  gasPrice: string;
}

export interface SendFlowSubmitResponse {
  transactionHash: string;
  success: boolean;
  timestamp: string;
  queueId?: string; // PHASE 1 FIX: Queue ID for tracking
}

export async function estimateSendFee(amount: string): Promise<SendFlowEstimateResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/transactions/estimate-fee?amount=${amount}`,
      {
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to estimate fee');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error estimating fee:', error);
    throw new Error((error as Error).message || 'Failed to estimate transaction fee');
  }
}

/**
 * PHASE 1 FIX: Submit wallet transaction with EIP-191 signature
 * Required parameters for security:
 * - walletId: The wallet connection ID from the backend
 * - recipient: The recipient address
 * - amount: The amount to send
 * - tokenSymbol: The token to send (e.g., 'USDC', 'ETH')
 * - walletAddress: User's wallet address (for signature verification)
 */
export async function submitTransaction(
  walletId: string,
  recipient: string,
  amount: string,
  tokenSymbol: string = 'ETH',
  recipientName?: string
): Promise<SendFlowSubmitResponse> {
  try {
    // PHASE 1 FIX: Get wallet signer for signature
    const signer = await getSigner();
    const walletAddress = await signer.getAddress();
    const nonce = generateNonce();

    // PHASE 1 FIX: Create message to sign (includes nonce for replay protection)
    const message = `Send ${amount} ${tokenSymbol} to ${recipient}\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
    
    // PHASE 1 FIX: Sign message with user's wallet
    console.log('[SECURITY] Requesting wallet signature for transaction...');
    const signature = await signer.signMessage(message);
    console.log('[SECURITY] Transaction signed by wallet');

    // Call backend with signature
    const response = await fetch(`${API_BASE_URL}/wallets/${walletId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        toAddress: recipient,
        amount,
        tokenSymbol,
        description: `Payment to ${recipientName || 'user'}`,
        walletAddress,      // PHASE 1 FIX: Required for signature verification
        signature,           // PHASE 1 FIX: EIP-191 signed message
        nonce                // PHASE 1 FIX: Prevents replay attacks
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit transaction');
    }

    const result = await response.json();
    console.log('[SECURITY] Transaction queued:', result.data.queueId);
    
    return {
      transactionHash: result.data.queueId || `tx_${Date.now()}`,
      success: true,
      timestamp: new Date().toISOString(),
      queueId: result.data.queueId
    };
  } catch (error: any) {
    console.error('[ERROR] Transaction submission failed:', error);
    
    // Handle signature rejection
    if (error.message?.includes('User rejected') || error.message?.includes('signature')) {
      throw new Error('You must sign the transaction with your wallet to proceed');
    }
    
    throw new Error(error.message || 'Failed to submit transaction');
  }
}

// ==================== PROPOSAL VOTING API ====================

export interface ProposalImpactResponse {
  proposalId: string;
  impactIfYes: {
    summary: string;
    changes: Array<{ metric: string; current: string; proposed: string; change: string }>;
    benefits: string[];
    risks: string[];
  };
  impactIfNo: {
    summary: string;
    changes: Array<{ metric: string; current: string; proposed: string; change: string }>;
    benefits: string[];
    risks: string[];
  };
}

export async function getProposalImpact(proposalId: string): Promise<ProposalImpactResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/proposals/${proposalId}/impact`,
      {
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch proposal impact');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching proposal impact:', error);
    throw new Error((error as Error).message || 'Failed to fetch proposal impact');
  }
}

export interface VoteSubmitResponse {
  proposalId: string;
  vote: 'yes' | 'no' | 'abstain';
  transactionHash: string;
  success: boolean;
}

export async function submitVote(
  proposalId: string,
  vote: 'yes' | 'no' | 'abstain'
): Promise<VoteSubmitResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/proposals/${proposalId}/vote`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({ vote })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit vote');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error submitting vote:', error);
    throw new Error((error as Error).message || 'Failed to submit vote');
  }
}

// ==================== SECURITY SETTINGS API ====================

export interface SecurityStatusResponse {
  overallRisk: 'low' | 'medium' | 'high';
  accountAge: string;
  lastLogin: string;
  lastPasswordChange?: string;
  features: Array<{
    id: string;
    name: string;
    enabled: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    lastUpdated?: string;
  }>;
}

export async function getSecurityStatus(): Promise<SecurityStatusResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/security/status`,
      {
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch security status');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching security status:', error);
    throw new Error((error as Error).message || 'Failed to fetch security status');
  }
}

export interface TwoFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export async function setupTwoFA(): Promise<TwoFASetupResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/security/2fa/setup`,
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to setup 2FA');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    throw new Error((error as Error).message || 'Failed to setup 2FA');
  }
}

export interface TwoFAVerifyResponse {
  success: boolean;
  message: string;
}

export async function verifyTwoFA(code: string): Promise<TwoFAVerifyResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/security/2fa/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({ code })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify 2FA code');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    throw new Error((error as Error).message || 'Failed to verify 2FA code');
  }
}

export interface ChangePINResponse {
  success: boolean;
  message: string;
}

export async function changePIN(currentPIN: string, newPIN: string): Promise<ChangePINResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/security/pin/change`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({ currentPIN, newPIN })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to change PIN');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error changing PIN:', error);
    throw new Error((error as Error).message || 'Failed to change PIN');
  }
}

export interface ExportKeysResponse {
  success: boolean;
  downloadUrl: string;
}

export async function exportKeys(password: string): Promise<ExportKeysResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/security/keys/export`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({ password })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to export keys');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error exporting keys:', error);
    throw new Error((error as Error).message || 'Failed to export keys');
  }
}

export interface SocialRecoveryResponse {
  success: boolean;
  guardians: Array<{ address: string; name?: string; confirmed: boolean }>;
}

export async function enableSocialRecovery(
  guardianAddresses: string[]
): Promise<SocialRecoveryResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/user/security/social-recovery/enable`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({ guardianAddresses })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to enable social recovery');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error enabling social recovery:', error);
    throw new Error((error as Error).message || 'Failed to enable social recovery');
  }
}

// ==================== ERROR HANDLING ====================

export class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export async function handleAPIError(error: any): Promise<never> {
  if (error instanceof APIError) {
    throw error;
  }

  if (error.response) {
    throw new APIError(
      error.response.status,
      error.response.data?.message || error.message,
      error.response.data
    );
  }

  throw new APIError(500, error.message || 'Unknown error occurred');
}
