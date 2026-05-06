# Phase 2.3 Refactoring Plan - Focus on Minimal Changes

**Approach**: Refactor existing components to integrate Phase 2.2 features (2FA, PIN, wallet creation)
**Principle**: Minimal new components, maximum reuse
**Date**: Session Start

---

## 🎯 Refactoring Goals

1. **Integrate 2FA into withdrawal flow**
2. **Add PIN verification modal**
3. **Connect wallet creation to signup flow**
4. **Update existing components with new API endpoints**
5. **Minimal new component creation**

---

## 📋 Components to Refactor

### High Priority (Must Have)

#### 1. **WithdrawalModal.tsx** - Add 2FA + PIN flow
- **Current**: Basic withdrawal with provider options
- **Refactor**: Add 2FA step after amount entry
- **Refactor**: Add PIN verification before submission
- **API Calls**: 
  - POST /api/2fa/generate
  - POST /api/2fa/verify
  - POST /api/pin/verify
  - POST /api/withdrawals/verify-2fa
- **Lines Changed**: ~50-80 lines
- **New Components**: 2FAVerificationStep, PINVerificationStep (as sub-components)

#### 2. **DepositWithdrawFlow.tsx** - Update to use new wallet flow
- **Current**: Separate deposit/withdraw tabs
- **Refactor**: Connect to real wallet endpoints
- **API Calls**: Use /api/wallets/* endpoints
- **Lines Changed**: ~30-50 lines

#### 3. **WalletDashboard.tsx** - Add 2FA status indicator
- **Current**: Shows vault and portfolio tabs
- **Refactor**: Add 2FA status badge
- **Refactor**: Link to 2FA setup modal
- **API Calls**: GET /api/2fa/config
- **Lines Changed**: ~20-30 lines

### Medium Priority (Nice to Have)

#### 4. **Auth/SignUp Flow** - Integrate wallet creation
- **Current**: User signup without wallet
- **Refactor**: Show created wallet address in signup success
- **API Calls**: Already handled by backend (auth_register.ts)
- **Lines Changed**: ~15-20 lines

#### 5. **TransactionHistory.tsx** - Show 2FA verification status
- **Current**: Basic transaction list
- **Refactor**: Add "2FA Verified" badge on withdrawals
- **Lines Changed**: ~10-15 lines

#### 6. **PersonalVaultBalance.tsx** - Add quick PIN setup
- **Current**: Shows vault balance
- **Refactor**: Quick PIN setup button if not configured
- **API Calls**: GET /api/pin/requirements, POST /api/pin/setup
- **Lines Changed**: ~20-25 lines

---

## 🔄 Refactoring Steps

### Step 1: Create 2FA/PIN Modal Components (Reusable)
**Files to Create**: 2 mini-components only
- `2FAVerificationModal.tsx` - Reusable 2FA step
- `PINVerificationModal.tsx` - Reusable PIN step

### Step 2: Refactor WithdrawalModal.tsx
**Changes**:
- Import 2FA and PIN modals
- Add state for OTP verification
- Add state for PIN verification
- Update handleWithdraw flow to include 2FA/PIN steps
- Call POST /api/withdrawals/verify-2fa

### Step 3: Update DepositWithdrawFlow.tsx
**Changes**:
- Fix API endpoints to match actual backend
- Connect to real /api/wallets endpoints
- Remove mock data

### Step 4: Update WalletDashboard.tsx
**Changes**:
- Add 2FA status check on component mount
- Display 2FA indicator badge
- Add link to 2FA setup

### Step 5: Update Auth/Signup Components
**Changes**:
- Detect wallet creation in signup response
- Display wallet address
- Show "Save your wallet address" message

### Step 6: Update TransactionHistory.tsx
**Changes**:
- Show 2FA verification badge on withdrawals

### Step 7: Update PersonalVaultBalance.tsx
**Changes**:
- Add PIN requirement check
- Show "Set PIN" button if not configured

---

## 📊 Scope Summary

| Task | Components | Files Changed | Lines | Effort |
|------|-----------|---|---|---|
| 2FA Modal | 1 new | 1 new | 150 | 30 min |
| PIN Modal | 1 new | 1 new | 150 | 30 min |
| WithdrawalModal | Refactor | 1 modified | +80 | 1 hour |
| DepositWithdrawFlow | Refactor | 1 modified | +50 | 45 min |
| WalletDashboard | Refactor | 1 modified | +30 | 30 min |
| Auth/Signup | Refactor | 1 modified | +20 | 30 min |
| TransactionHistory | Refactor | 1 modified | +15 | 20 min |
| PersonalVaultBalance | Refactor | 1 modified | +25 | 30 min |
| **TOTAL** | **2 new** | **8 files** | **~365 lines** | **~4 hours** |

---

## 🎯 Minimal New Components Strategy

**Only 2 new components** (both are reusable utilities):
1. **2FAVerificationModal.tsx** - Can be used anywhere 2FA is needed
2. **PINVerificationModal.tsx** - Can be used anywhere PIN is needed

Everything else = **refactoring existing components**

---

## ✅ Success Criteria

- ✅ Withdrawal flow includes 2FA step
- ✅ Withdrawal flow includes PIN step
- ✅ 2FA status shown in wallet dashboard
- ✅ PIN setup available in vault section
- ✅ Wallet address shown after signup
- ✅ Transaction history shows 2FA status
- ✅ No unnecessary new components
- ✅ All existing components still work
- ✅ All new APIs integrated

---

## 🚀 Next Action

Ready to start Phase 2.3 refactoring?

**Recommended order**:
1. Create 2FA modal component
2. Create PIN modal component
3. Refactor WithdrawalModal to use them
4. Update DepositWithdrawFlow
5. Update WalletDashboard
6. Update auth/signup
7. Update remaining components

**Estimated Total Time**: 4-5 hours

---

**Status**: Plan Ready
**Approach**: Refactoring-focused, minimal new components
**Ready to Execute**: Yes
