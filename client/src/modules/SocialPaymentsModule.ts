import { apiPost } from '@/lib/api';

export async function requestPayment({ toUserId, amount, currency, note }: { toUserId: string; amount: string | number; currency?: string; note?: string }) {
  return apiPost('/api/v1/wallets/payments/request', { toUserId, amount, currency, note });
}

export async function payByPhone({ phone, amount, currency }: { phone: string; amount: string | number; currency?: string }) {
  return apiPost('/api/v1/wallets/payments/phone', { phone, amount, currency });
}

export async function sendPeer({ toAddress, amount, currency }: { toAddress: string; amount: string | number; currency?: string }) {
  return apiPost('/api/v1/wallets/transfers/send-native', { toAddress, amount, currency });
}

export async function splitBill({ title, participants, currency, totalAmount, metadata }: { title?: string; participants: Array<{ userId?: string; address?: string; amount?: number | string }>; currency?: string; totalAmount?: number | string; metadata?: any }) {
  // participants: array of { userId?, address?, amount }
  return apiPost('/api/v1/wallets/payments/split', { title, participants, currency, totalAmount, metadata });
}

export async function generatePaymentLink({ amount, currency, description, expiresAt, metadata }: { amount: number | string; currency?: string; description?: string; expiresAt?: string; metadata?: any }) {
  return apiPost('/api/v1/wallets/payments/link/create', { amount, currency, description, expiresAt, metadata });
}

export async function redeemPaymentLink({ linkId, recipientAddress }: { linkId: string; recipientAddress?: string }) {
  return apiPost('/api/v1/wallets/payments/link/redeem', { linkId, recipientAddress });
}

export default { requestPayment, payByPhone, sendPeer, splitBill, generatePaymentLink, redeemPaymentLink };
