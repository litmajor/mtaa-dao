/**
 * API Integration Layer
 * 
 * This module handles all API calls for SendFlow, ProposalVoting, and SecuritySettings
 * Replace the API_BASE_URL and implement real endpoint calls here
 * 
 * Mock → Real Transition:
 * 1. Update API_BASE_URL to your backend
 * 2. Replace mock response with real fetch calls
 * 3. Handle real error responses
 * 4. Add auth headers if needed
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const AUTH_TOKEN = localStorage.getItem('auth_token'); // Example: get from auth context

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
}

export async function estimateSendFee(amount: string): Promise<SendFlowEstimateResponse> {
  try {
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/transactions/estimate-fee?amount=${amount}`, {
    //   headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          fee: (parseFloat(amount) * 0.002).toString(),
          estimatedTime: '15-30 seconds',
          gasPrice: '25 gwei'
        });
      }, 500);
    });
  } catch (error) {
    console.error('Error estimating fee:', error);
    throw new Error('Failed to estimate transaction fee');
  }
}

export async function submitTransaction(
  recipient: string,
  amount: string,
  recipientName?: string
): Promise<SendFlowSubmitResponse> {
  try {
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/transactions/send`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${AUTH_TOKEN}`
    //   },
    //   body: JSON.stringify({ recipient, amount, recipientName })
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          transactionHash: '0x' + Math.random().toString(16).slice(2),
          success: true,
          timestamp: new Date().toISOString()
        });
      }, 2000);
    });
  } catch (error) {
    console.error('Error submitting transaction:', error);
    throw new Error('Failed to submit transaction');
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
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/proposals/${proposalId}/impact`, {
    //   headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          proposalId,
          impactIfYes: {
            summary: 'If this proposal passes, the DAO will increase treasury allocation.',
            changes: [
              {
                metric: 'Treasury Allocation',
                current: '60% Operations, 40% Reserve',
                proposed: '60% Operations, 35% Reserve, 25% Sustainability',
                change: '+25% Sustainability'
              }
            ],
            benefits: [
              'Stronger long-term sustainability positioning',
              'Attracts environmental-conscious partners',
              'Competitive advantage in market'
            ],
            risks: ['Requires compliance approval', 'May impact short-term funds']
          },
          impactIfNo: {
            summary: 'Current resource allocation will remain unchanged.',
            changes: [
              {
                metric: 'Treasury Allocation',
                current: '60% Operations, 40% Reserve',
                proposed: '60% Operations, 40% Reserve (unchanged)',
                change: 'No change'
              }
            ],
            benefits: ['Maintains operational stability', 'Preserves contingency reserves'],
            risks: ['Missed opportunity for growth', 'Competitors may capture share']
          }
        });
      }, 800);
    });
  } catch (error) {
    console.error('Error fetching proposal impact:', error);
    throw new Error('Failed to fetch proposal impact');
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
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/proposals/${proposalId}/vote`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${AUTH_TOKEN}`
    //   },
    //   body: JSON.stringify({ vote })
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          proposalId,
          vote,
          transactionHash: '0x' + Math.random().toString(16).slice(2),
          success: true
        });
      }, 1500);
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    throw new Error('Failed to submit vote');
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
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/user/security/status`, {
    //   headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          overallRisk: 'medium',
          accountAge: '1 year, 3 months',
          lastLogin: '2 hours ago',
          lastPasswordChange: '6 months ago',
          features: [
            {
              id: 'two-fa',
              name: 'Two-Factor Authentication',
              enabled: false,
              riskLevel: 'high',
              lastUpdated: undefined
            },
            {
              id: 'password',
              name: 'Strong Password',
              enabled: true,
              riskLevel: 'low',
              lastUpdated: '6 months ago'
            }
          ]
        });
      }, 800);
    });
  } catch (error) {
    console.error('Error fetching security status:', error);
    throw new Error('Failed to fetch security status');
  }
}

export interface TwoFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export async function setupTwoFA(): Promise<TwoFASetupResponse> {
  try {
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/user/security/2fa/setup`, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          secret: 'JBSWY3DPEBLW64TMMQ======',
          qrCode: 'data:image/png;base64,...',
          backupCodes: ['ABCD-1234', 'EFGH-5678', 'IJKL-9012', 'MNOP-3456', 'QRST-7890']
        });
      }, 1000);
    });
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    throw new Error('Failed to setup 2FA');
  }
}

export interface TwoFAVerifyResponse {
  success: boolean;
  message: string;
}

export async function verifyTwoFA(code: string): Promise<TwoFAVerifyResponse> {
  try {
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/user/security/2fa/verify`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${AUTH_TOKEN}`
    //   },
    //   body: JSON.stringify({ code })
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        const isValid = code.length === 6 && /^\d+$/.test(code);
        resolve({
          success: isValid,
          message: isValid ? '2FA enabled successfully' : 'Invalid code'
        });
      }, 500);
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    throw new Error('Failed to verify 2FA code');
  }
}

export interface ChangePINResponse {
  success: boolean;
  message: string;
}

export async function changePIN(currentPIN: string, newPIN: string): Promise<ChangePINResponse> {
  try {
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/user/security/pin/change`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${AUTH_TOKEN}`
    //   },
    //   body: JSON.stringify({ currentPIN, newPIN })
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: 'PIN changed successfully'
        });
      }, 1200);
    });
  } catch (error) {
    console.error('Error changing PIN:', error);
    throw new Error('Failed to change PIN');
  }
}

export interface ExportKeysResponse {
  success: boolean;
  downloadUrl: string;
}

export async function exportKeys(password: string): Promise<ExportKeysResponse> {
  try {
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/user/security/keys/export`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${AUTH_TOKEN}`
    //   },
    //   body: JSON.stringify({ password })
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          downloadUrl: 'blob:http://localhost:3000/abc123'
        });
      }, 1500);
    });
  } catch (error) {
    console.error('Error exporting keys:', error);
    throw new Error('Failed to export keys');
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
    // Real implementation:
    // const response = await fetch(`${API_BASE_URL}/user/security/social-recovery/enable`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${AUTH_TOKEN}`
    //   },
    //   body: JSON.stringify({ guardianAddresses })
    // });
    // return response.json();

    // Mock implementation:
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          guardians: guardianAddresses.map((addr) => ({
            address: addr,
            confirmed: false
          }))
        });
      }, 1500);
    });
  } catch (error) {
    console.error('Error enabling social recovery:', error);
    throw new Error('Failed to enable social recovery');
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
