import { useCallback } from 'react';
import { apiPost } from '@/lib/api';
import useWalletOperatingStore from '@/stores/wallet-operating-store';
import * as SocialPaymentsModule from '@/modules/SocialPaymentsModule';
import * as EscrowModule from '@/modules/EscrowModule';
import * as RecurringModule from '@/modules/RecurringModule';

// Basic action payloads used by this hook. Keep in-sync with the store's expectations.
type SendPayload = { toAddress: string; amount: string; currency?: string };
type WithdrawPayload = { to: string; amount: string; currency?: string };
type SwapPayload = { fromToken: string; toToken: string; amount: string };
type StakePayload = { vaultId: string; amount: string };
type ReceivePayload = { currency?: string };
type SplitParticipant = { id: string; address?: string }
type SplitBillPayload = { title?: string; participants: Array<SplitParticipant>; currency?: string; totalAmount?: number | string; metadata?: Record<string, unknown> };
type CreatePaymentLinkPayload = { amount: string; currency?: string; description?: string; expiresAt?: string; metadata?: Record<string, unknown> };

type ActionPayload =
  | { type: 'send'; status: 'in-progress'; payload: SendPayload }
  | { type: 'receive'; status: 'open' | 'in-progress'; payload: ReceivePayload }
  | { type: 'withdraw'; status: 'in-progress'; payload: WithdrawPayload }
  | { type: 'swap'; status: 'in-progress'; payload: SwapPayload }
  | { type: 'stake'; status: 'in-progress'; payload: StakePayload }
  | { type: 'splitBill'; status: 'in-progress'; payload: Omit<SplitBillPayload, 'metadata'> }
  | { type: 'createPaymentLink'; status: 'in-progress'; payload: Omit<CreatePaymentLinkPayload, 'metadata'> };

/**
 * Hook: useWalletActions
 * Centralized collection of user-facing wallet actions (send/receive/withdraw/swap/stake)
 * These methods open/close the store action panel and call the backend modules.
 */
export function useWalletActions() {
  const store = useWalletOperatingStore();

  // Prefer exposing the store methods directly — avoid unnecessary useCallback wrappers.
  const openAction = store.openAction as (payload: ActionPayload) => void;
  const closeAction = store.closeAction as () => void;

  // Helper to reduce duplication: open panel, run async fn, close panel and return a consistent shape.
  const withActionPanel = useCallback(<TArgs extends unknown[], R>(
    type: ActionPayload['type'],
    payload: object,
    fn: (...args: TArgs) => Promise<R>
  ) => async (...args: TArgs): Promise<{ success: boolean; res?: R; error?: string; originalError?: unknown }> => {
    openAction({ type: type as any, status: 'in-progress', payload } as ActionPayload);
    try {
      const res = await fn(...args);
      closeAction();
      return { success: true, res };
    } catch (err: unknown) {
      closeAction();
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg, originalError: err };
    }
  }, [openAction, closeAction]);

  const send = useCallback(async ({ toAddress, amount, currency }: { toAddress: string; amount: string | number; currency?: string }) => {
    const amt = String(amount);
    return withActionPanel('send', { toAddress, amount: amt, currency }, () => apiPost('/api/v1/wallets/transfers/send-native', { toAddress, amount: amt, currency }))();
  }, [withActionPanel]);

  const receive = useCallback(({ currency }:{currency?:string}) => {
    // `receive` intentionally opens the receive panel and returns a consistent result.
    openAction({ type: 'receive', status: 'open', payload: { currency } });
    return { success: true, close: () => closeAction() };
  }, [openAction, closeAction]);

  const withdraw = useCallback(async ({ to, amount, currency }: { to: string; amount: string | number; currency?: string }) => {
    const amt = String(amount);
    return withActionPanel('withdraw', { to, amount: amt, currency }, () => apiPost('/api/v1/wallets/transfers/withdraw', { to, amount: amt, currency }))();
  }, [withActionPanel]);

  const swap = useCallback(async ({ fromToken, toToken, amount }: { fromToken: string; toToken: string; amount: string | number }) => {
    const amt = String(amount);
    return withActionPanel('swap', { fromToken, toToken, amount: amt }, () => apiPost('/api/v1/wallets/swaps', { fromToken, toToken, amount: amt }))();
  }, [withActionPanel]);

  const stake = useCallback(async ({ vaultId, amount }: { vaultId: string; amount: string | number }) => {
    const amt = String(amount);
    return withActionPanel('stake', { vaultId, amount: amt }, () => apiPost('/api/v1/wallets/stake', { vaultId, amount: amt }))();
  }, [withActionPanel]);

  // Create small facades for external modules to avoid exposing internals.
  const createFacade = (mod: Record<string, unknown>) => {
    const out: Record<string, (...args: unknown[]) => unknown> = {};
    Object.keys(mod).forEach((k) => {
      const v = mod[k];
      if (typeof v === 'function' && !k.startsWith('_')) out[k] = (...args: unknown[]) => (v as Function)(...args);
    });
    return out;
  };

  const social = createFacade(SocialPaymentsModule);
  const escrow = createFacade(EscrowModule);
  const recurring = createFacade(RecurringModule);

  const splitBill = useCallback(async ({ title, participants, currency, totalAmount, metadata }: { title?: string; participants: Array<SplitParticipant>; currency?: string; totalAmount?: number | string; metadata?: Record<string, unknown> }) => {
    const amt = totalAmount == null ? undefined : String(totalAmount);
    return withActionPanel('splitBill', { title, participants, currency, totalAmount: amt }, () => SocialPaymentsModule.splitBill({ title, participants, currency, totalAmount: amt, metadata }))();
  }, [withActionPanel]);

  const createPaymentLink = useCallback(async ({ amount, currency, description, expiresAt, metadata }: { amount: number | string; currency?: string; description?: string; expiresAt?: string; metadata?: Record<string, unknown> }) => {
    const amt = String(amount);
    return withActionPanel('createPaymentLink', { amount: amt, currency, description }, () => SocialPaymentsModule.generatePaymentLink({ amount: amt, currency, description, expiresAt, metadata }))();
  }, [withActionPanel]);

  return {
    openAction,
    closeAction,
    send,
    receive,
    withdraw,
    swap,
    stake,
    social,
    escrow,
    recurring,
    splitBill,
    createPaymentLink
  };
}

export default useWalletActions;
