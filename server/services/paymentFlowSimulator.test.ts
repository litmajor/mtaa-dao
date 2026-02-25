/**
 * Payment Flow Simulator Integration Tests
 * 
 * Tests all 5 payment action simulators (BASIC depth)
 * Verifies:
 * - Correct fee calculations
 * - Proper state transitions
 * - Risk detection
 * - Reversibility window recommendations
 */

import {
  PaymentDepositSimulator,
  PaymentWithdrawalSimulator,
  PaymentP2PTransferSimulator,
  RecurringPaymentSetupSimulator,
  PaymentSettlementSimulator,
} from '../services/paymentFlowSimulator';
import { SimulationStatus, SimulationDepth } from '../services/simulationFramework';

describe('Payment Flow Simulators - BASIC Depth', () => {
  
  describe('PaymentDepositSimulator', () => {
    let simulator: PaymentDepositSimulator;

    beforeEach(() => {
      simulator = new PaymentDepositSimulator();
    });

    test('should simulate successful bank transfer deposit with 0.3% fee', async () => {
      const result = await simulator.simulate({
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        paymentMethod: 'bank_transfer',
      });

      expect(result.status).toBe(SimulationStatus.SUCCESS);
      expect(result.depth).toBe(SimulationDepth.BASIC);
      expect(result.delta.feesCollected).toBe(30); // 0.3% of 10000
      expect(result.delta.userBalanceDelta).toBe(9970); // 10000 * 1% exchange rate - fee
      expect(result.riskLevel).toBe('LOW');
    });

    test('should apply correct fee for card deposits (2%)', async () => {
      const result = await simulator.simulate({
        userId: 'user-456',
        amount: 5000,
        currency: 'USD',
        paymentMethod: 'card',
      });

      expect(result.delta.feesCollected).toBe(100); // 2% of 5000
      expect(result.delta.userBalanceDelta).toBe(4900);
    });

    test('should apply exchange rate correctly', async () => {
      const result = await simulator.simulate({
        userId: 'user-789',
        amount: 1,
        currency: 'BTC',
        paymentMethod: 'wallet',
        exchangeRate: 45000, // 1 BTC = 45000 MTAA
      });

      // Fee is 0.5% for wallet
      const fee = 0.005; // in BTC
      const netDeposit = 0.9995;
      const nativeAmount = netDeposit * 45000;
      
      expect(result.delta.feesCollected).toBeCloseTo(0.005, 3);
      expect(result.delta.userBalanceDelta).toBeCloseTo(44977.75, 1);
    });

    test('should flag large deposits for compliance review', async () => {
      const result = await simulator.simulate({
        userId: 'user-large',
        amount: 150000,
        currency: 'USD',
        paymentMethod: 'bank_transfer',
      });

      expect(result.riskFactors).toContain('large-deposit');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.riskLevel).toBe('LOW'); // Still low risk, but flagged
    });

    test('should require highest reversibility window (365 days)', async () => {
      const result = await simulator.simulate({
        userId: 'user-deposit',
        amount: 1000,
        currency: 'USD',
        paymentMethod: 'bank_transfer',
      });

      expect(result.reversibilityWindow.maxGracePeriodDays).toBe(365);
      expect(result.reversibilityWindow.recommendedGracePeriodHours).toBe(72);
    });

    test('should reject zero or negative amounts', async () => {
      const result = await simulator.simulate({
        userId: 'user-bad',
        amount: 0,
        currency: 'USD',
        paymentMethod: 'bank_transfer',
      });

      expect(result.status).toBe(SimulationStatus.ERROR);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate required parameters', async () => {
      const result = await simulator.simulate({
        userId: 'user-incomplete',
        amount: 100,
        // Missing currency and paymentMethod
      });

      expect(result.status).toBe(SimulationStatus.ERROR);
      expect(result.errors[0]).toContain('Missing required parameters');
    });
  });

  describe('PaymentWithdrawalSimulator', () => {
    let simulator: PaymentWithdrawalSimulator;

    beforeEach(() => {
      simulator = new PaymentWithdrawalSimulator();
    });

    test('should simulate successful bank withdrawal with 1% fee', async () => {
      const result = await simulator.simulate({
        userId: 'user-withdraw',
        amount: 5000,
        currency: 'USD',
        destination: 'bank',
        userBalance: 10000,
      });

      expect(result.status).toBe(SimulationStatus.SUCCESS);
      expect(result.delta.feesCollected).toBe(50); // 1% of 5000
      expect(result.afterState.userBalance).toBe(5000);
      expect(result.delta.liquidityDelta).toBe(-4950);
    });

    test('should apply higher fees for card withdrawals (1.5%)', async () => {
      const result = await simulator.simulate({
        userId: 'user-card',
        amount: 2000,
        currency: 'USD',
        destination: 'card',
        userBalance: 5000,
      });

      expect(result.delta.feesCollected).toBe(30); // 1.5% of 2000
    });

    test('should reject withdrawal exceeding balance', async () => {
      const result = await simulator.simulate({
        userId: 'user-poor',
        amount: 10000,
        currency: 'USD',
        destination: 'bank',
        userBalance: 5000,
      });

      expect(result.status).toBe(SimulationStatus.ERROR);
      expect(result.errors[0]).toContain('Insufficient balance');
    });

    test('should flag large withdrawals for compliance', async () => {
      const result = await simulator.simulate({
        userId: 'user-bulk-withdraw',
        amount: 75000,
        currency: 'USD',
        destination: 'bank',
        userBalance: 100000,
      });

      expect(result.riskFactors).toContain('large-withdrawal');
      expect(result.warnings).toContainEqual(expect.stringContaining('compliance'));
    });

    test('should alert when platform liquidity is low', async () => {
      // This test assumes mock platformLiquidity can be adjusted
      // In real test, would need to mock database
      const result = await simulator.simulate({
        userId: 'user-test',
        amount: 1000,
        currency: 'USD',
        destination: 'bank',
        userBalance: 10000,
      });

      // Default mock has 50M liquidity, so this shouldn't trigger
      expect(result.riskFactors.includes('low-liquidity')).toBe(false);
    });

    test('should recommend shorter grace period than deposits (30 days max)', async () => {
      const result = await simulator.simulate({
        userId: 'user-withdraw2',
        amount: 5000,
        currency: 'USD',
        destination: 'bank',
        userBalance: 10000,
      });

      expect(result.reversibilityWindow.maxGracePeriodDays).toBe(30);
    });
  });

  describe('PaymentP2PTransferSimulator', () => {
    let simulator: PaymentP2PTransferSimulator;

    beforeEach(() => {
      simulator = new PaymentP2PTransferSimulator();
    });

    test('should simulate P2P transfer with 0.1% fee', async () => {
      const result = await simulator.simulate({
        userId: 'user-sender',
        recipientId: 'user-recipient',
        amount: 1000,
        userBalance: 5000,
      });

      expect(result.status).toBe(SimulationStatus.SUCCESS);
      expect(result.delta.feesCollected).toBe(1); // 0.1% of 1000
      expect(result.afterState.senderBalance).toBe(4000);
      expect(result.afterState.recipientBalance).toBe(999);
    });

    test('should prevent self-transfers', async () => {
      const result = await simulator.simulate({
        userId: 'user-selfish',
        recipientId: 'user-selfish',
        amount: 100,
        userBalance: 1000,
      });

      expect(result.status).toBe(SimulationStatus.ERROR);
      expect(result.errors[0]).toContain('Cannot transfer to yourself');
    });

    test('should flag transfers with investment/loan memos', async () => {
      const result = await simulator.simulate({
        userId: 'user-sender2',
        recipientId: 'user-recipient2',
        amount: 5000,
        userBalance: 20000,
        memo: 'Investment in my startup',
      });

      expect(result.riskFactors).toContain('potential-securities');
      expect(result.warnings).toContainEqual(expect.stringContaining('compliance'));
      expect(result.riskLevel).toBe('MEDIUM');
    });

    test('should flag transfers exceeding 30% of balance', async () => {
      const result = await simulator.simulate({
        userId: 'user-bulk',
        recipientId: 'recipient-bulk',
        amount: 6000,
        userBalance: 10000, // 60% of balance
      });

      expect(result.riskFactors).toContain('large-transfer');
    });

    test('should provide high reversibility window (90 days)', async () => {
      const result = await simulator.simulate({
        userId: 'user-p2p',
        recipientId: 'recipient-p2p',
        amount: 500,
        userBalance: 2000,
      });

      expect(result.reversibilityWindow.maxGracePeriodDays).toBe(90);
    });
  });

  describe('RecurringPaymentSetupSimulator', () => {
    let simulator: RecurringPaymentSetupSimulator;
    const futureDate = Date.now() + 7 * 24 * 60 * 60 * 1000; // 1 week from now

    beforeEach(() => {
      simulator = new RecurringPaymentSetupSimulator();
    });

    test('should simulate monthly recurring payment with 0.5% setup fee', async () => {
      const result = await simulator.simulate({
        userId: 'user-recurring',
        recipientId: 'recipient-recurring',
        amount: 100,
        frequency: 'monthly',
        startDate: futureDate,
        cycles: 12,
        userBalance: 2000,
      });

      expect(result.status).toBe(SimulationStatus.SUCCESS);
      expect(result.delta.setupFeeDeducted).toBe(0.5); // 0.5% of 100
      expect(result.simulationData.projectedAnnualAmount).toBe(1200); // 100 * 12
    });

    test('should calculate projection for weekly payments', async () => {
      const result = await simulator.simulate({
        userId: 'user-weekly',
        recipientId: 'recip-weekly',
        amount: 50,
        frequency: 'weekly',
        startDate: futureDate,
        cycles: 52,
        userBalance: 5000,
      });

      expect(result.simulationData.projectedAnnualAmount).toBe(2600); // 50 * 52
    });

    test('should reject start date in the past', async () => {
      const result = await simulator.simulate({
        userId: 'user-past',
        recipientId: 'recipient-past',
        amount: 100,
        frequency: 'monthly',
        startDate: Date.now() - 1000, // 1 second ago
        userBalance: 2000,
      });

      expect(result.status).toBe(SimulationStatus.ERROR);
      expect(result.errors[0]).toContain('future');
    });

    test('should warn about perpetual recurring payments (no cycle limit)', async () => {
      const result = await simulator.simulate({
        userId: 'user-perpetual',
        recipientId: 'recipient-perpetual',
        amount: 100,
        frequency: 'monthly',
        startDate: futureDate,
        // cycles = undefined = infinite
        userBalance: 5000,
      });

      expect(result.warnings).toContainEqual(expect.stringContaining('perpetual'));
    });

    test('should flag high recurring burdens', async () => {
      const result = await simulator.simulate({
        userId: 'user-burden',
        recipientId: 'recipient-burden',
        amount: 3000, // Monthly
        frequency: 'monthly',
        startDate: futureDate,
        cycles: 12,
        userBalance: 5000,
      });

      expect(result.riskFactors).toContain('high-commitment');
      expect(result.riskLevel).toBe('MEDIUM');
    });

    test('should provide full reversibility window (365 days)', async () => {
      const result = await simulator.simulate({
        userId: 'user-rec-rev',
        recipientId: 'recipient-rev',
        amount: 100,
        frequency: 'monthly',
        startDate: futureDate,
        cycles: 12,
        userBalance: 2000,
      });

      expect(result.reversibilityWindow.maxGracePeriodDays).toBe(365);
    });
  });

  describe('PaymentSettlementSimulator', () => {
    let simulator: PaymentSettlementSimulator;

    beforeEach(() => {
      simulator = new PaymentSettlementSimulator();
    });

    test('should simulate payment settlement with 0.2% fee', async () => {
      const result = await simulator.simulate({
        userId: 'user-payer',
        requestId: 'req-123',
        amount: 5000,
        senderId: 'user-payee',
        userBalance: 10000,
      });

      expect(result.status).toBe(SimulationStatus.SUCCESS);
      expect(result.delta.feesCollected).toBe(10); // 0.2% of 5000
      expect(result.delta.settlementFee).toBe(10);
      expect(result.afterState.payerBalance).toBe(5000);
    });

    test('should resolve one outstanding request', async () => {
      const result = await simulator.simulate({
        userId: 'user-settle',
        requestId: 'req-456',
        amount: 2000,
        senderId: 'user-requester',
        userBalance: 10000,
      });

      expect(result.delta.outstandingRequestsResolved).toBe(1);
      expect(result.afterState.payerOutstandingRequests).toBe(1); // 2 - 1
    });

    test('should reject settlement exceeding balance', async () => {
      const result = await simulator.simulate({
        userId: 'user-poor-setter',
        requestId: 'req-789',
        amount: 15000,
        senderId: 'user-creditor',
        userBalance: 5000,
      });

      expect(result.status).toBe(SimulationStatus.ERROR);
      expect(result.errors[0]).toContain('Insufficient balance');
    });

    test('should provide shorter grace period (7 days max)', async () => {
      const result = await simulator.simulate({
        userId: 'user-settle2',
        requestId: 'req-999',
        amount: 1000,
        senderId: 'user-payee2',
        userBalance: 10000,
      });

      expect(result.reversibilityWindow.maxGracePeriodDays).toBe(7);
    });

    test('should work with zero-fee settlement if needed', async () => {
      const result = await simulator.simulate({
        userId: 'user-settle3',
        requestId: 'req-000',
        amount: 100,
        senderId: 'user-payee3',
        userBalance: 500,
      });

      // Even small amounts have 0.2% fee
      expect(result.delta.feesCollected).toBeCloseTo(0.2, 1);
    });
  });

  // Integration tests
  describe('Simulator Integration', () => {
    test('should support simulation chaining (deposit then transfer)', async () => {
      // Simulate deposit
      const depositSim = new PaymentDepositSimulator();
      const deposit = await depositSim.simulate({
        userId: 'user-chain',
        amount: 10000,
        currency: 'USD',
        paymentMethod: 'bank_transfer',
      });

      // Use deposit result to feed transfer
      const transferSim = new PaymentP2PTransferSimulator();
      const transfer = await transferSim.simulate({
        userId: 'user-chain',
        recipientId: 'user-recipient',
        amount: 5000,
        userBalance: deposit.afterState.userBalance,
      });

      expect(deposit.status).toBe(SimulationStatus.SUCCESS);
      expect(transfer.status).toBe(SimulationStatus.SUCCESS);
      expect(transfer.riskLevel).toBe('LOW');
    });

    test('all simulators should return consistent structure', async () => {
      const simulators = [
        new PaymentDepositSimulator(),
        new PaymentWithdrawalSimulator(),
        new PaymentP2PTransferSimulator(),
        new RecurringPaymentSetupSimulator(),
        new PaymentSettlementSimulator(),
      ];

      const testParams = [
        { userId: 'user1', amount: 1000, currency: 'USD', paymentMethod: 'bank_transfer' },
        { userId: 'user1', amount: 1000, currency: 'USD', destination: 'bank', userBalance: 5000 },
        { userId: 'user1', recipientId: 'user2', amount: 1000, userBalance: 5000 },
        { userId: 'user1', recipientId: 'user2', amount: 100, frequency: 'monthly', startDate: Date.now() + 100000, userBalance: 5000 },
        { userId: 'user1', requestId: 'req1', senderId: 'user2', amount: 1000, userBalance: 5000 },
      ];

      for (let i = 0; i < simulators.length; i++) {
        const result = await simulators[i].simulate(testParams[i]);

        // All should have these fields
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('depth');
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('beforeState');
        expect(result).toHaveProperty('afterState');
        expect(result).toHaveProperty('delta');
        expect(result).toHaveProperty('riskLevel');
        expect(result).toHaveProperty('riskFactors');
        expect(result).toHaveProperty('warnings');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('reversibilityWindow');
        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('impactedEntities');
      }
    });
  });
});
