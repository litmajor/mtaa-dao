import { VaultStateTransitionError } from './VaultErrors';

export type VaultStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED';
export type VaultTransactionStatus = 'REQUESTED' | 'CONFIRMING' | 'CONFIRMED' | 'ACCOUNTED' | 'COMPLETED';

export class VaultStateMachine {
  private static readonly VALID_STATUS_TRANSITIONS: Record<VaultStatus, VaultStatus[]> = {
    ACTIVE: ['PAUSED'],
    PAUSED: ['ACTIVE', 'CLOSED'],
    CLOSED: [], // terminal
  };

  private static readonly VALID_TX_TRANSITIONS: Record<VaultTransactionStatus, VaultTransactionStatus[]> = {
    REQUESTED: ['CONFIRMING'],
    CONFIRMING: ['CONFIRMED'],
    CONFIRMED: ['ACCOUNTED'],
    ACCOUNTED: ['COMPLETED'],
    COMPLETED: [], // terminal
  };

  static validateVaultStatusTransition(current: VaultStatus, next: VaultStatus): void {
    const allowed = this.VALID_STATUS_TRANSITIONS[current];
    if (!allowed.includes(next)) {
      throw new VaultStateTransitionError(
        `Invalid vault status transition from ${current} to ${next}`
      );
    }
  }

  static validateTransactionTransition(current: VaultTransactionStatus, next: VaultTransactionStatus): void {
    const allowed = this.VALID_TX_TRANSITIONS[current];
    if (!allowed.includes(next)) {
      throw new VaultStateTransitionError(
        `Invalid vault transaction transition from ${current} to ${next}`
      );
    }
  }

  static guardCanDeposit(status: VaultStatus): void {
    if (status !== 'ACTIVE') {
      throw new VaultStateTransitionError(`Cannot deposit into a ${status} vault`);
    }
  }

  static guardCanWithdraw(status: VaultStatus): void {
    if (status === 'PAUSED') {
      throw new VaultStateTransitionError(`Cannot withdraw from a PAUSED vault`);
    }
    // ACTIVE and CLOSED allow withdrawals (users can exit closed vaults)
  }
}
