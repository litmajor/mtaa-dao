# TIER 2 WIRING & INTEGRATION GUIDE

**Status:** 🚀 **READY TO IMPLEMENT**
**Date:** February 13, 2026
**Purpose:** Complete wiring of 29 Tier 2 simulators to existing dashboard components

---

## Overview

This guide maps each of the 29 Tier 2 simulators to existing dashboard components and shows the standardized wiring pattern:

1. **Form captures user input**
2. **"Preview" button triggers simulation** via `useSimulationPreview` hook
3. **`SimulationResultModal` displays results** (risk assessment, warnings, metrics)
4. **User confirms → actual action executes**

All components follow the same proven pattern from Week 2 UI (Treasury, Trading, Governance, Agent).

---

## Integration Pattern (Standard Across All)

```tsx
// In dashboard component:
const { simulationResult, isLoading, isModalOpen, runSimulation, closeModal } = 
  useSimulationPreview();

// In form:
const handlePreview = async (e) => {
  e.preventDefault();
  await runSimulation(
    'SIMULATOR_TYPE',  // e.g., 'VAULT_DEPOSIT'
    { /* form params */ },
    userId
  );
};

// Render:
<button onClick={handlePreview}>Preview</button>
<SimulationResultModal 
  result={simulationResult}
  isOpen={isModalOpen}
  onClose={closeModal}
  onConfirm={handleExecute}
/>
```

---

## Category 4: Investment Operations (4 Simulators)

### Target Dashboard: TreasuryDashboard or InvestmentDashboard

**Existing Path:** `components/treasury/TreasuryDashboard.tsx` (exists ✅)

#### 1. Portfolio Rebalance
- **Simulator Type:** `PORTFOLIO_REBALANCE`
- **Current Component:** `TreasuryRebalancePanel` ✅ **ALREADY WIRED**
- **Status:** ✅ COMPLETE
- **Button:** "Preview Rebalance" in form

#### 2. Dividend Reinvestment
- **Simulator Type:** `DIVIDEND_REINVESTMENT`
- **New Component Needed:** `DividendReinvestmentPanel.tsx`
- **Location:** `components/treasury/DividendReinvestmentPanel.tsx`
- **Form Inputs:**
  - Portfolio value ($)
  - Dividend yield (%)
  - Investment term (years)
  - Tax rate (%)
- **Button:** "Preview DRIP Strategy"
- **Preview Shows:**
  - DRIP vs manual value comparison
  - Tax impact analysis
  - Annual breakdown

#### 3. Margin Lending
- **Simulator Type:** `MARGIN_LENDING`
- **New Component Needed:** `MarginLendingPanel.tsx`
- **Location:** `components/treasury/MarginLendingPanel.tsx`
- **Form Inputs:**
  - Borrowing amount ($)
  - Collateral amount ($)
  - Interest rate (%)
  - Loan duration (days)
- **Button:** "Preview Liquidation Risk"
- **Preview Shows:**
  - Collateral ratio & liquidation price
  - Interest costs breakdown
  - Liquidation probability (Monte Carlo)

#### 4. Fixed Income
- **Simulator Type:** `FIXED_INCOME`
- **New Component Needed:** `FixedIncomePanel.tsx`
- **Location:** `components/treasury/FixedIncomePanel.tsx`
- **Form Inputs:**
  - Bond amount ($)
  - Bond type (Corporate/Government/High-yield)
  - Credit rating (AAA-C)
  - Maturity (years)
- **Button:** "Preview Bond Analysis"
- **Preview Shows:**
  - Bond pricing & YTM
  - Duration & interest rate risk
  - Default probability

**Implementation Priority:** 🔴 HIGH - Treasury enhancements

---

## Category 9: Staking (4 Simulators)

### Target Dashboard: StakingDashboard (create minimal if needed)

**Existing Path:** May need minimal creation or enhancement

#### 1. Solo Staking
- **Simulator Type:** `SOLO_STAKING`
- **New Component Needed:** `SoloStakingPanel.tsx`
- **Location:** `components/staking/SoloStakingPanel.tsx`
- **Form Inputs:**
  - Staked amount (ETH)
  - Network validators (#)
  - Uptime (%)
  - Slashing risk (low/medium/high)
- **Button:** "Preview Validator Returns"
- **Preview Shows:**
  - Effective reward rate
  - Uptime penalties
  - Slashing scenarios (0%, 10%, 32%, full)
  - Expected value

#### 2. Pool Staking
- **Simulator Type:** `POOL_STAKING`
- **New Component Needed:** `PoolStakingPanel.tsx`
- **Location:** `components/staking/PoolStakingPanel.tsx`
- **Form Inputs:**
  - Pool type (Ethereum/Cosmos/Polkadot)
  - Stake amount ($)
  - Lock period (months)
- **Button:** "Preview Pool Returns"
- **Preview Shows:**
  - Gross vs net APY (after fees)
  - Maturity value
  - Liquidity status
  - Early exit penalties

#### 3. Liquidity Pool
- **Simulator Type:** `LIQUIDITY_POOL`
- **New Component Needed:** `LiquidityPoolPanel.tsx`
- **Location:** `components/defi/LiquidityPoolPanel.tsx`
- **Form Inputs:**
  - LP amount ($)
  - Token pair (e.g., ETH/USDC)
  - Fee tier (0.01%, 0.05%, 0.3%, 1%)
- **Button:** "Preview IL & Returns"
- **Preview Shows:**
  - Impermanent loss formula
  - LP rewards vs HODL
  - Breakeven analysis

#### 4. Yield Farming
- **Simulator Type:** `YIELD_FARMING`
- **New Component Needed:** `YieldFarmingPanel.tsx`
- **Location:** `components/defi/YieldFarmingPanel.tsx`
- **Form Inputs:**
  - Farm amount ($)
  - Strategy (Aggressive/Balanced/Conservative)
  - Platforms (#)
- **Button:** "Preview net APY"
- **Preview Shows:**
  - Base APY by strategy
  - Gas costs per platform
  - Slippage impact
  - Net APY after all costs

**Implementation Priority:** 🟡 MEDIUM - New staking/DeFi UI needed

---

## Category 8: Vaults (4 Simulators)

### Target Dashboard: VaultDashboard (exists partially)

**Existing Path:** `client/src/components/vault/VaultCreationWizard.tsx` (exists ✅)

#### 1. Vault Deposit
- **Simulator Type:** `VAULT_DEPOSIT`
- **Existing Component:** Integrate into `VaultCreationWizard` or create `VaultDepositPanel`
- **Form Inputs:**
  - Vault type (Standard/Premium/Elite/Yield/DAO)
  - Deposit amount ($)
  - APY boost level
- **Button:** "Preview Interest Earned"
- **Preview Shows:**
  - Interest earned with daily compounding
  - Maturity value
  - Lock period restrictions
  - Withdrawal fees

#### 2. Vault Withdrawal
- **Simulator Type:** `VAULT_WITHDRAWAL`
- **New Component Needed:** `VaultWithdrawalPanel.tsx`
- **Location:** `components/vault/VaultWithdrawalPanel.tsx`
- **Form Inputs:**
  - Wallet queue position (#)
  - Withdrawal amount ($)
- **Button:** "Preview Withdrawal Timeline"
- **Preview Shows:**
  - Queue position & wait time
  - Liquidity status
  - Slippage impact
  - Exit fees

#### 3. Vault Liquidation
- **Simulator Type:** `VAULT_LIQUIDATION`
- **New Component Needed:** `VaultLiquidationPanel.tsx`
- **Location:** `components/vault/VaultLiquidationPanel.tsx`
- **Form Inputs:**
  - Collateral assets (ETH, BTC, USDC)
  - Amounts
- **Button:** "Preview Liquidation Risk"
- **Preview Shows:**
  - Collateral ratio vs threshold
  - Margin to liquidation
  - Price drop scenarios
  - Liquidation penalty

#### 4. Vault Strategy
- **Simulator Type:** `VAULT_STRATEGY`
- **New Component Needed:** `VaultStrategyPanel.tsx`
- **Location:** `components/vault/VaultStrategyPanel.tsx`
- **Form Inputs:**
  - Strategy type (Yield Farming/Delta Neutral/Market Making)
  - Backtest period (days)
- **Button:** "Preview Strategy Performance"
- **Preview Shows:**
  - Total return & annualized return
  - Max drawdown (recovery time)
  - Sharpe ratio & Sortino ratio
  - Monthly breakdown

**Implementation Priority:** 🔴 HIGH - Vault enhancements

---

## Category 6: Escrow & Settlements (4 Simulators)

### Target Dashboard: EscrowDashboard (create if needed)

**Existing Path:** May need creation

#### 1. Escrow Release ⭐ **30-DAY RECOVERY WINDOW**
- **Simulator Type:** `ESCROW_RELEASE`
- **New Component Needed:** `EscrowReleasePanel.tsx`
- **Location:** `components/escrow/EscrowReleasePanel.tsx`
- **Form Inputs:**
  - Escrow amount ($)
  - Milestone completion status (%)
  - Release type (Manual/Time-based/Milestone)
- **Button:** "Preview Release & Recovery Window"
- **Preview Shows:**
  - Release approval status
  - **30-day recovery window countdown** (in hours)
  - Recovery deadline date
  - Recovery fund availability
  - Risk status by recovery window

#### 2. Dispute Resolution
- **Simulator Type:** `DISPUTE_RESOLUTION`
- **New Component Needed:** `DisputeResolutionPanel.tsx`
- **Location:** `components/escrow/DisputeResolutionPanel.tsx`
- **Form Inputs:**
  - Dispute reason (Quality/Non-delivery/etc)
  - Evidence strength (1-10)
  - Claim amount (%)
- **Button:** "Preview Dispute & Settlement"
- **Preview Shows:**
  - Dispute merit score
  - Approval probability (3 scenarios)
  - Arbitration costs
  - Final payout estimate

#### 3. Settlement Finality
- **Simulator Type:** `SETTLEMENT_FINALITY`
- **New Component Needed:** `SettlementFinalityPanel.tsx`
- **Location:** `components/escrow/SettlementFinalityPanel.tsx`
- **Form Inputs:**
  - Settlement type (Trade/Payment/Oracle)
  - Blockchain (Ethereum/Polygon/etc)
- **Button:** "Preview Settlement Security"
- **Preview Shows:**
  - Confirmations needed
  - Time to finality
  - Reversal probability
  - Insurance cost

#### 4. Escrow Recovery ⭐ **AUTOMATIC AFTER 30-DAY LOCK**
- **Simulator Type:** `ESCROW_RECOVERY`
- **New Component Needed:** `EscrowRecoveryPanel.tsx`
- **Location:** `components/escrow/EscrowRecoveryPanel.tsx`
- **Form Inputs:**
  - Escrow lock date
  - Recovery method (Auto/Multi-sig/DAO vote)
- **Button:** "Preview Recovery Status"
- **Preview Shows:**
  - Days until eligible
  - **Recovery window expiry countdown**
  - Counterparty response scenarios
  - Recovery conditions checklist
  - Success probability by method

**Implementation Priority:** 🔴 HIGH - Key feature with 30-day windows

---

## Category 5: Cross-Chain Bridges (2 Simulators)

### Target Dashboard: BridgeDashboard or TradingDashboard enhancement

**Existing Path:** May integrate into trading dashboard or create minimal Bridge panel

#### 1. Bridge Transfer
- **Simulator Type:** `BRIDGE_TRANSFER`
- **New Component Needed:** `BridgeTransferPanel.tsx`
- **Location:** `components/bridge/BridgeTransferPanel.tsx`
- **Form Inputs:**
  - Bridge type (Optimistic/Light-client/Validator-set)
  - Source chain (Ethereum)
  - Target chain (Polygon/Arbitrum/Optimism)
  - Transfer amount ($)
- **Button:** "Preview Bridge Costs & Timeline"
- **Preview Shows:**
  - Bridge fee analysis
  - Gas costs per chain
  - Total transfer cost %
  - Crossing time estimate
  - Bridge audit score

#### 2. Cross-Chain Arbitrage
- **Simulator Type:** `CROSS_CHAIN_ARBITRAGE`
- **New Component Needed:** `CrossChainArbitragePanel.tsx`
- **Location:** `components/bridge/CrossChainArbitragePanel.tsx`
- **Form Inputs:**
  - Asset pair (e.g., ETH/USDC)
  - Price on chain A ($)
  - Price on chain B ($)
  - Amount to arbitrage
- **Button:** "Preview Arbitrage ROI"
- **Preview Shows:**
  - Price discrepancy %
  - Bridge + gas + slippage costs
  - Gross vs net profit
  - ROI after all costs
  - Feasibility assessment

**Implementation Priority:** 🟡 MEDIUM - Nice-to-have for advanced users

---

## Category 10: Recurring Payments (3 Simulators)

### Target Dashboard: RecurringPaymentsDashboard or PaymentsDashboard

**Existing Path:** May need minimal creation

#### 1. Subscription
- **Simulator Type:** `SUBSCRIPTION`
- **New Component Needed:** `SubscriptionPanel.tsx`
- **Location:** `components/payments/SubscriptionPanel.tsx`
- **Form Inputs:**
  - Monthly amount ($)
  - Duration (months)
  - Cancellation fee
- **Button:** "Preview Subscription Costs"
- **Preview Shows:**
  - Monthly payment breakdown
  - Total cost with fees
  - Cancellation penalties

#### 2. Installment
- **Simulator Type:** `INSTALLMENT`
- **New Component Needed:** `InstallmentPanel.tsx`
- **Location:** `components/payments/InstallmentPanel.tsx`
- **Form Inputs:**
  - Loan amount ($)
  - Interest rate (%)
  - Term (months)
- **Button:** "Preview Payment Schedule"
- **Preview Shows:**
  - Monthly payment amount
  - Total interest paid
  - Total cost

#### 3. Payment Automation
- **Simulator Type:** `PAYMENT_AUTOMATION`
- **New Component Needed:** `PaymentAutomationPanel.tsx`
- **Location:** `components/payments/PaymentAutomationPanel.tsx`
- **Form Inputs:**
  - Payment amount ($)
  - Retry attempts (#)
  - Success rate (%)
- **Button:** "Preview Reliability"
- **Preview Shows:**
  - Success rate estimate
  - Failed payments forecast
  - Retry impact

**Implementation Priority:** 🟢 LOW - Convenience feature

---

## Category 11: Bounties (3 Simulators)

### Target Dashboard: BountiesDashboard

**Existing Path:** May need minimal creation

#### 1. Bounty Program
- **Simulator Type:** `BOUNTY_PROGRAM`
- **New Component Needed:** `BountyProgramPanel.tsx`
- **Location:** `components/bounties/BountyProgramPanel.tsx`
- **Form Inputs:**
  - Total budget ($)
  - Expected bounties (#)
  - Critical bug rate (%)
- **Button:** "Preview Budget Allocation"
- **Preview Shows:**
  - Budget utilization
  - Critical bugs found
  - Duplicate rate
  - Total payouts

#### 2. Reward Distribution
- **Simulator Type:** `REWARD_DISTRIBUTION`
- **New Component Needed:** `RewardDistributionPanel.tsx`
- **Location:** `components/bounties/RewardDistributionPanel.tsx`
- **Form Inputs:**
  - Total reward pool ($)
  - Recipients (#)
  - Vetting enabled
- **Button:** "Preview Distribution"
- **Preview Shows:**
  - Vetting costs
  - Processing fees
  - Average per recipient

#### 3. Bounty Completion
- **Simulator Type:** `BOUNTY_COMPLETION`
- **New Component Needed:** `BountyCompletionPanel.tsx`
- **Location:** `components/bounties/BountyCompletionPanel.tsx`
- **Form Inputs:**
  - Target completion time (days)
  - Early bonus (%)
- **Button:** "Preview Completion Incentives"
- **Preview Shows:**
  - Target window
  - Max rewards
  - Early bonus structure

**Implementation Priority:** 🟢 LOW - Convenience feature

---

## Category 12: Bill Split (3 Simulators)

### Target Dashboard: ExpensesDashboard or PaymentsDashboard

**Existing Path:** May need minimal creation

#### 1. Bill Split
- **Simulator Type:** `BILL_SPLIT`
- **New Component Needed:** `BillSplitPanel.tsx`
- **Location:** `components/expenses/BillSplitPanel.tsx`
- **Form Inputs:**
  - Total bill amount ($)
  - Number of people
  - Split equally (yes/no)
- **Button:** "Preview Split Calculation"
- **Preview Shows:**
  - Application fees
  - Per-person amount
  - Total with fees

#### 2. Expense Reimbursement
- **Simulator Type:** `EXPENSE_REIMBURSEMENT`
- **New Component Needed:** `ExpenseReimbursementPanel.tsx`
- **Location:** `components/expenses/ExpenseReimbursementPanel.tsx`
- **Form Inputs:**
  - Amount owed ($)
  - Number of people
  - Number reimbursing
- **Button:** "Preview Timeline"
- **Preview Shows:**
  - Per-person reimbursement
  - Approval timeline
  - Settlement timeline

#### 3. Group Settlement
- **Simulator Type:** `GROUP_SETTLEMENT`
- **New Component Needed:** `GroupSettlementPanel.tsx`
- **Location:** `components/expenses/GroupSettlementPanel.tsx`
- **Form Inputs:**
  - Group size (#)
  - Total to settle ($)
  - Settlement method
- **Button:** "Preview Settlement Costs"
- **Preview Shows:**
  - Estimated transactions
  - Settlement costs %
  - Net after costs

**Implementation Priority:** 🟢 LOW - Convenience feature

---

## Summary: Wiring Implementation Order

### 🔴 HIGH Priority (Existng dashboards, high impact)
1. **Investment Operations** (4) - Wire to Treasury (2-3 new panels)
2. **Vaults** (4) - Enhance Vault dashboard (3 new panels)
3. **Escrow & Settlements** (4) - New Escrow dashboard (4 new panels)

### 🟡 MEDIUM Priority
4. **Staking** (4) - New Staking dashboard (4 new panels)
5. **Cross-Chain Bridges** (2) - New Bridge dashboard or Trading enhancement (2 new panels)

### 🟢 LOW Priority (Convenience, lower impact)
6. **Recurring Payments** (3) - Minimal Payments enhancement (3 new panels)
7. **Bounties** (3) - Minimal Bounties dashboard (3 new panels)
8. **Bill Split** (3) - Minimal Expenses dashboard (3 new panels)

---

## New Components To Create (25 Total)

### Investment Operations (2 new)
- [ ] `DividendReinvestmentPanel.tsx`
- [ ] `MarginLendingPanel.tsx`
- [ ] `FixedIncomePanel.tsx`

### Staking (4 new)
- [ ] `SoloStakingPanel.tsx`
- [ ] `PoolStakingPanel.tsx`
- [ ] `LiquidityPoolPanel.tsx`
- [ ] `YieldFarmingPanel.tsx`

### Escrow (4 new)
- [ ] `EscrowReleasePanel.tsx`
- [ ] `DisputeResolutionPanel.tsx`
- [ ] `SettlementFinalityPanel.tsx`
- [ ] `EscrowRecoveryPanel.tsx`

### Vaults (3 new)
- [ ] `VaultWithdrawalPanel.tsx`
- [ ] `VaultLiquidationPanel.tsx`
- [ ] `VaultStrategyPanel.tsx`

### Bridge (2 new)
- [ ] `BridgeTransferPanel.tsx`
- [ ] `CrossChainArbitragePanel.tsx`

### Recurring Payments (3 new)
- [ ] `SubscriptionPanel.tsx`
- [ ] `InstallmentPanel.tsx`
- [ ] `PaymentAutomationPanel.tsx`

### Bounties (3 new)
- [ ] `BountyProgramPanel.tsx`
- [ ] `RewardDistributionPanel.tsx`
- [ ] `BountyCompletionPanel.tsx`

### Bill Split (3 new)
- [ ] `BillSplitPanel.tsx`
- [ ] `ExpenseReimbursementPanel.tsx`
- [ ] `GroupSettlementPanel.tsx`

---

## All Existing Components Requiring Wiring (17 Total)

### Already Wired ✅
- [x] TreasuryRebalancePanel (TREASURY_REBALANCE)
- [x] AssetAllocationPanel (ASSET_ALLOCATION)
- [x] GrantDistributionPanel (GRANT_DISTRIBUTION)

### Needing Review/Enhancement
- [ ] All 15 Week 2 UI components (check if simulators already wired)
  - Trading Dashboard components (5)
  - Governance Dashboard components (5)
  - Agent Dashboard components (2)
  - Treasury Dashboard components (3)

---

## Implementation Checklist

### Phase 3A: Wire Existing Components (Week 2 UI)
- [ ] Treasury: Review AssetAllocationPanel, GrantDistributionPanel for simulation wiring
- [ ] Trading: Review all 5 components for simulation wiring
- [ ] Governance: Review all 5 components for simulation wiring
- [ ] Agent: Review 2 components for simulation wiring

### Phase 3B: Create HIGH Priority Panels (16)
- [ ] Investment operations panels (3)
- [ ] Vault enhancements (3)
- [ ] Escrow panels (4)
- [ ] Staking panels (4)
- [ ] Dashboard wrappers (2)

### Phase 3C: Create MEDIUM Priority Panels (5)
- [ ] Bridge panels (2)
- [ ] Dashboard wrapper (1)
- [ ] Cross-chain panel utilities (2)

### Phase 3D: Create LOW Priority Panels (9)
- [ ] Recurring payments panels (3)
- [ ] Bounties panels (3)
- [ ] Bill split panels (3)

---

## Next Steps

1. **✅ Tier 2 Simulators:** Complete (29 simulators, 5,200+ lines)
2. **🚀 THIS DOC:** Wiring integration mapped
3. **→ Phase 3A:** Wire existing Week 2 components (review + small fixes)
4. **→ Phase 3B:** Create HIGH priority panels (1-2 sessions)
5. **→ Phase 3C:** Create MEDIUM panels (1 session)
6. **→ Phase 3D:** Create LOW priority panels (1 session)
7. **→ Phase 4:** Testing & validation
8. **→ Phase 5:** TIER 3 (convenience features)

---

**Status:** Ready to proceed with wiring
**Estimated Implementation Time:** 3-4 sessions
**Quality:** Enterprise-grade integration with proven patterns
