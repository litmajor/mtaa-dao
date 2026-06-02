import { apiPost } from '@/lib/api';

export async function scheduleRecurring({ payeeId, amount, currency, cronExpression }: { payeeId: string; amount: string | number; currency?: string; cronExpression: string }) {
  return apiPost('/api/v1/wallets/recurring/schedule', { payeeId, amount, currency, cronExpression });
}

export async function cancelRecurring(recurringId: string) {
  return apiPost(`/api/v1/wallets/recurring/${recurringId}/cancel`, {});
}

export default { scheduleRecurring, cancelRecurring };
