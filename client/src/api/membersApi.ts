import { authClient } from '../utils/authClient';

export async function getDaoMembers(daoId: string, options?: { role?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.role) params.append('role', options.role);
  if (options?.limit) params.append('limit', options.limit.toString());
  
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return authClient.get(`/api/v1/daos/${daoId}/members${queryString}`);
}

export async function inviteMember(daoId: string, payload: { email?: string; phone?: string; role?: string }) {
  return authClient.post(`/api/v1/daos/${daoId}/members/invite`, payload);
}

export async function updateMemberRole(daoId: string, userId: string, role: string) {
  return authClient.put(`/api/v1/daos/${daoId}/members/${userId}/role`, { role });
}

export async function removeMember(daoId: string, userId: string) {
  return authClient.delete(`/api/v1/daos/${daoId}/members/${userId}`);
}

export async function getDaoReputation(daoId: string) {
  return authClient.get(`/api/v1/daos/${daoId}/contributions/dao-reputation`);
}
