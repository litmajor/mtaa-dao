import { apiPost } from '@/lib/api';

export async function initiateEscrow(payload: {
  recipient: string;
  amount: string | number;
  currency?: string;
  description?: string;
  milestones?: Array<{ description: string; amount: string | number }>;
  daoId?: string;
  mediatorId?: string;
}) {
  return apiPost('/api/escrow/initiate', payload);
}

export async function getEscrowDetails(escrowId: string) {
  return fetch(`/api/escrow/${escrowId}`).then(r => r.json());
}

export default { initiateEscrow, getEscrowDetails };
