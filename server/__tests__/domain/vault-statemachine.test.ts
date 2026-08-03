import { describe, expect, it } from 'vitest';
import { VaultStateMachine, VaultStatus, VaultTransactionStatus } from '../../domain/vaults/VaultStateMachine';
import { VaultStateTransitionError } from '../../domain/vaults/VaultErrors';

describe('VaultStateMachine', () => {
  describe('Vault Status Transitions', () => {
    it('allows transition ACTIVE → PAUSED', () => {
      expect(() => VaultStateMachine.validateVaultStatusTransition('ACTIVE', 'PAUSED')).not.toThrow();
    });

    it('allows transition PAUSED → CLOSED', () => {
      expect(() => VaultStateMachine.validateVaultStatusTransition('PAUSED', 'CLOSED')).not.toThrow();
    });

    it('blocks transition CLOSED → ACTIVE', () => {
      expect(() => VaultStateMachine.validateVaultStatusTransition('CLOSED', 'ACTIVE'))
        .toThrow(VaultStateTransitionError);
    });

    it('allows transition PAUSED → ACTIVE', () => {
      expect(() => VaultStateMachine.validateVaultStatusTransition('PAUSED', 'ACTIVE')).not.toThrow();
    });

    it('blocks transition ACTIVE → CLOSED directly (must PAUSE first)', () => {
      expect(() => VaultStateMachine.validateVaultStatusTransition('ACTIVE', 'CLOSED'))
        .toThrow(VaultStateTransitionError);
    });
  });

  describe('Deposit Flow Transitions', () => {
    it('allows transition REQUESTED → CONFIRMING', () => {
      expect(() => VaultStateMachine.validateTransactionTransition('REQUESTED', 'CONFIRMING')).not.toThrow();
    });

    it('allows transition CONFIRMING → CONFIRMED', () => {
      expect(() => VaultStateMachine.validateTransactionTransition('CONFIRMING', 'CONFIRMED')).not.toThrow();
    });

    it('allows transition CONFIRMED → ACCOUNTED', () => {
      expect(() => VaultStateMachine.validateTransactionTransition('CONFIRMED', 'ACCOUNTED')).not.toThrow();
    });

    it('allows transition ACCOUNTED → COMPLETED', () => {
      expect(() => VaultStateMachine.validateTransactionTransition('ACCOUNTED', 'COMPLETED')).not.toThrow();
    });

    it('blocks skip from REQUESTED to COMPLETED', () => {
      expect(() => VaultStateMachine.validateTransactionTransition('REQUESTED', 'COMPLETED'))
        .toThrow(VaultStateTransitionError);
    });
  });

  describe('Vault Activity Guards', () => {
    it('allows deposit if ACTIVE', () => {
      expect(() => VaultStateMachine.guardCanDeposit('ACTIVE')).not.toThrow();
    });

    it('blocks deposit if PAUSED', () => {
      expect(() => VaultStateMachine.guardCanDeposit('PAUSED')).toThrow(VaultStateTransitionError);
    });

    it('blocks deposit if CLOSED', () => {
      expect(() => VaultStateMachine.guardCanDeposit('CLOSED')).toThrow(VaultStateTransitionError);
    });

    it('allows withdraw if ACTIVE', () => {
      expect(() => VaultStateMachine.guardCanWithdraw('ACTIVE')).not.toThrow();
    });

    it('blocks withdraw if PAUSED', () => {
      expect(() => VaultStateMachine.guardCanWithdraw('PAUSED')).toThrow(VaultStateTransitionError);
    });

    it('allows withdraw if CLOSED (users must be able to exit)', () => {
      // Often, a closed vault still permits withdrawals for users to retrieve funds.
      expect(() => VaultStateMachine.guardCanWithdraw('CLOSED')).not.toThrow();
    });
  });
});
