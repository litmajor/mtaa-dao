import { authClient } from '../utils/authClient';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await authClient.fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
  return body as T;
}

export interface ContributionPayload {
  amountKES?: number;
  amount?: number;
  currency?: string;
  contributorId?: string;
  memberId?: string;
  mpesaRef?: string;
  purpose?: string;
  cycle?: string;
  paymentMethod?: string;
  contributorName?: string;
  contributorPhone?: string;
  note?: string;
}

export async function getContributionLedger(daoId: string, options?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await requestJson<any>(`/api/v1/daos/${daoId}/treasury/contributions${queryString}`);
  const contributions = response?.contributions || [];
  return {
    ...response,
    ledger: contributions.map((contribution: any) => ({
      ...contribution,
      userId: contribution.contributorId,
      timestamp: contribution.createdAt,
      transactionHash: contribution.mpesaRef,
      paymentMethod: contribution.method,
    })),
    summary: {
      totalCollected: contributions
        .filter((entry: any) => ['approved', 'completed', 'rotation_pending'].includes(entry.status))
        .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0),
      totalOutstanding: contributions
        .filter((entry: any) => entry.status === 'pending')
        .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0),
    },
  };
}

export async function recordContribution(daoId: string, payload: ContributionPayload) {
  const amount = payload.amountKES ?? payload.amount;
  const response = await requestJson<any>(`/api/v1/daos/${daoId}/treasury/contributions`, {
    method: 'POST',
    body: JSON.stringify({
      amount,
      currency: payload.currency || 'KES',
      memberId: payload.memberId || payload.contributorId,
      description: payload.note || payload.purpose,
      method: payload.paymentMethod,
      mpesaCode: payload.mpesaRef,
      purpose: payload.purpose,
      cycle: payload.cycle,
      contributorName: payload.contributorName,
      contributorPhone: payload.contributorPhone,
    }),
  });
  return { ...response, paymentId: response?.contribution?.id };
}

export async function initiateMpesaContribution(daoId: string, payload: ContributionPayload) {
  const amount = payload.amountKES ?? payload.amount;
  return requestJson<any>(`/api/v1/daos/${daoId}/treasury/contributions/mpesa`, {
    method: 'POST',
    body: JSON.stringify({
      amount,
      memberId: payload.memberId || payload.contributorId,
      description: payload.note || payload.purpose,
      purpose: payload.purpose,
      cycle: payload.cycle,
    }),
  });
}

export async function exportContributionLedger(daoId: string): Promise<Blob> {
  // Use authClient.fetch so auth/CSRF and retry logic is reused.
  const response = await authClient.fetch(`/api/v1/daos/${daoId}/treasury/contributions/export`, {
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
  return requestJson<any>(`/api/v1/daos/${daoId}/treasury/contributions/${contributionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approved: true }),
  });
}
