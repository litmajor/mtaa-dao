import { authClient } from '../utils/authClient';

export interface ContributionPayload {
  amountKES?: number;
  amount?: number;
  currency: string;
  contributorId?: string;
  memberId?: string;
  mpesaRef?: string;
  purpose?: string;
  cycle?: string;
  paymentMethod?: string;
  contributorName?: string;
  contributorPhone?: string;
}

export async function getContributionLedger(daoId: string, options?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return authClient.get(`/api/v1/daos/${daoId}/contributions/ledger${queryString}`);
}

export async function recordContribution(daoId: string, payload: ContributionPayload) {
  return authClient.post(`/api/v1/daos/${daoId}/contributions`, payload);
}

export async function exportContributionLedger(daoId: string): Promise<Blob> {
  // Use authClient.fetch so auth/CSRF and retry logic is reused.
  const response = await authClient.fetch(`/api/v1/daos/${daoId}/contributions/ledger/export`, {
    method: 'GET',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to export ledger: ${text}`);
  }

  return response.blob();
}

export async function getMemberReputation(daoId: string, userId: string) {
  return authClient.get(`/api/v1/daos/${daoId}/contributions/reputation/${userId}`);
}

export async function confirmContribution(daoId: string, contributionId: string) {
  // We'll hit the mpesa-status endpoint or a specific confirm endpoint.
  // The system says admin/manual paths are possible.
  return authClient.post(`/api/v1/daos/${daoId}/contributions/${contributionId}/confirm`, {});
}
