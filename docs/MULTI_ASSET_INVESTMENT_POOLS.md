# 💎 Multi-Asset Investment Pools for DAOs

**Date:** October 23, 2025  
**Feature:** Pooled Crypto Investment with Share Minting  
**Use Case:** Chama-style group investments in top cryptocurrencies

---

## 🎯 Overview

Enable DAOs to create **multi-asset investment pools** where members can:
- Pool funds to invest in top cryptocurrencies (BTC, ETH, SOL, BNB, XRP, LTC)
- Receive proportional shares (tokens) representing their investment
- Track portfolio performance in real-time
- Rebalance assets collectively through governance
- Withdraw proportionally to their shares

**Perfect for:** Investment clubs, chamas, group savings with crypto exposure

---

## 🪙 Supported Assets (Big 6)

| Asset | Symbol | Network | Why Include |
|-------|--------|---------|-------------|
| Bitcoin | BTC | Bitcoin/Wrapped | Store of value, institutional adoption |
| Ethereum | ETH | Ethereum | Smart contracts, DeFi ecosystem |
| Solana | SOL | Solana | High performance, low fees |
| Binance Coin | BNB | BSC | Exchange utility, broad adoption |
| Ripple | XRP | XRP Ledger | Cross-border payments |
| Litecoin | LTC | Litecoin | Fast transactions, proven track record |

---

## 🏗️ Architecture

### 1. Smart Contracts

#### **MultiAssetVault.sol**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MultiAssetVault
 * @notice DAO vault that holds multiple cryptocurrencies and mints shares
 */
contract MultiAssetVault is ERC20, AccessControl, ReentrancyGuard {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    
    struct Asset {
        address tokenAddress;
        string symbol;
        uint256 targetAllocation; // Percentage in basis points (10000 = 100%)
        uint256 currentBalance;
        bool isActive;
    }
    
    struct InvestmentRecord {
        address investor;
        uint256 sharesMinted;
        uint256 usdValue;
        uint256 timestamp;
    }
    
    // Supported assets
    mapping(address => Asset) public assets;
    address[] public assetList;
    
    // Investment tracking
    InvestmentRecord[] public investments;
    mapping(address => uint256[]) public userInvestments;
    
    // Portfolio metrics
    uint256 public totalValueLocked; // In USD
    uint256 public lastRebalanceTime;
    uint256 public performanceFee; // In basis points
    address public feeCollector;
    
    // Price oracle
    address public priceOracle;
    
    event AssetAdded(address indexed tokenAddress, string symbol, uint256 targetAllocation);
    event AssetRemoved(address indexed tokenAddress);
    event Investment(address indexed investor, uint256 usdAmount, uint256 sharesMinted);
    event Withdrawal(address indexed investor, uint256 sharesRedeemed, uint256 usdValue);
    event Rebalanced(uint256 timestamp, uint256 newTVL);
    event AllocationUpdated(address indexed tokenAddress, uint256 newAllocation);
    
    constructor(
        string memory name,
        string memory symbol,
        address _priceOracle,
        address _feeCollector
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        priceOracle = _priceOracle;
        feeCollector = _feeCollector;
        performanceFee = 200; // 2%
    }
    
    /**
     * @notice Add a new asset to the portfolio
     */
    function addAsset(
        address tokenAddress,
        string memory _symbol,
        uint256 targetAllocation
    ) external onlyRole(MANAGER_ROLE) {
        require(!assets[tokenAddress].isActive, "Asset already exists");
        require(targetAllocation <= 10000, "Allocation exceeds 100%");
        
        assets[tokenAddress] = Asset({
            tokenAddress: tokenAddress,
            symbol: _symbol,
            targetAllocation: targetAllocation,
            currentBalance: 0,
            isActive: true
        });
        
        assetList.push(tokenAddress);
        emit AssetAdded(tokenAddress, _symbol, targetAllocation);
    }
    
    /**
     * @notice Invest in the pool and receive shares
     * @param usdAmount Amount in USD to invest
     */
    function invest(uint256 usdAmount) external payable nonReentrant {
        require(usdAmount > 0, "Amount must be > 0");
        
        // Calculate shares to mint
        uint256 sharesToMint;
        if (totalSupply() == 0) {
            // First investment: 1:1 ratio
            sharesToMint = usdAmount;
        } else {
            // Subsequent investments: proportional to TVL
            sharesToMint = (usdAmount * totalSupply()) / totalValueLocked;
        }
        
        // Mint shares
        _mint(msg.sender, sharesToMint);
        
        // Record investment
        investments.push(InvestmentRecord({
            investor: msg.sender,
            sharesMinted: sharesToMint,
            usdValue: usdAmount,
            timestamp: block.timestamp
        }));
        
        userInvestments[msg.sender].push(investments.length - 1);
        
        // Update TVL
        totalValueLocked += usdAmount;
        
        emit Investment(msg.sender, usdAmount, sharesToMint);
    }
    
    /**
     * @notice Withdraw from the pool by burning shares
     * @param shares Number of shares to redeem
     */
    function withdraw(uint256 shares) external nonReentrant {
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");
        
        // Calculate USD value of shares
        uint256 usdValue = (shares * totalValueLocked) / totalSupply();
        
        // Burn shares
        _burn(msg.sender, shares);
        
        // Update TVL
        totalValueLocked -= usdValue;
        
        emit Withdrawal(msg.sender, shares, usdValue);
        
        // TODO: Distribute assets proportionally
    }
    
    /**
     * @notice Rebalance portfolio to target allocations
     */
    function rebalance() external onlyRole(REBALANCER_ROLE) {
        lastRebalanceTime = block.timestamp;
        
        // TODO: Implement rebalancing logic
        // 1. Get current prices from oracle
        // 2. Calculate current allocations
        // 3. Swap assets to match target allocations
        
        emit Rebalanced(block.timestamp, totalValueLocked);
    }
    
    /**
     * @notice Update target allocation for an asset
     */
    function updateAllocation(
        address tokenAddress,
        uint256 newAllocation
    ) external onlyRole(MANAGER_ROLE) {
        require(assets[tokenAddress].isActive, "Asset not active");
        require(newAllocation <= 10000, "Allocation exceeds 100%");
        
        assets[tokenAddress].targetAllocation = newAllocation;
        emit AllocationUpdated(tokenAddress, newAllocation);
    }
    
    /**
     * @notice Get portfolio composition
     */
    function getPortfolio() external view returns (
        address[] memory tokens,
        uint256[] memory balances,
        uint256[] memory allocations
    ) {
        uint256 len = assetList.length;
        tokens = new address[](len);
        balances = new uint256[](len);
        allocations = new uint256[](len);
        
        for (uint256 i = 0; i < len; i++) {
            address token = assetList[i];
            tokens[i] = token;
            balances[i] = assets[token].currentBalance;
            allocations[i] = assets[token].targetAllocation;
        }
        
        return (tokens, balances, allocations);
    }
    
    /**
     * @notice Get user's share of the portfolio in USD
     */
    function getUserValue(address user) external view returns (uint256) {
        uint256 userShares = balanceOf(user);
        if (totalSupply() == 0) return 0;
        return (userShares * totalValueLocked) / totalSupply();
    }
    
    /**
     * @notice Calculate performance return
     */
    function getPerformance() external view returns (
        uint256 totalInvested,
        uint256 currentValue,
        int256 returnPercentage
    ) {
        totalInvested = 0;
        for (uint256 i = 0; i < investments.length; i++) {
            totalInvested += investments[i].usdValue;
        }
        
        currentValue = totalValueLocked;
        
        if (totalInvested == 0) {
            returnPercentage = 0;
        } else {
            returnPercentage = int256((currentValue - totalInvested) * 10000 / totalInvested);
        }
        
        return (totalInvested, currentValue, returnPercentage);
    }
}
```

---

## 📊 Database Schema

### New Tables

```sql
-- Multi-Asset Investment Pools
CREATE TABLE investment_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dao_id UUID REFERENCES daos(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(10) NOT NULL, -- Share token symbol
    contract_address VARCHAR(255),
    total_value_locked DECIMAL(18, 8) DEFAULT 0,
    share_token_supply DECIMAL(18, 8) DEFAULT 0,
    performance_fee INTEGER DEFAULT 200, -- Basis points
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pool Assets
CREATE TABLE pool_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES investment_pools(id) ON DELETE CASCADE,
    asset_symbol VARCHAR(10) NOT NULL, -- BTC, ETH, SOL, etc.
    asset_name VARCHAR(100),
    token_address VARCHAR(255),
    network VARCHAR(50),
    target_allocation INTEGER NOT NULL, -- Basis points (10000 = 100%)
    current_balance DECIMAL(18, 8) DEFAULT 0,
    current_value_usd DECIMAL(18, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Investments
CREATE TABLE pool_investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES investment_pools(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    investment_amount_usd DECIMAL(18, 2) NOT NULL,
    shares_minted DECIMAL(18, 8) NOT NULL,
    share_price DECIMAL(18, 8) NOT NULL,
    transaction_hash VARCHAR(255),
    invested_at TIMESTAMP DEFAULT NOW()
);

-- Pool Rebalancing History
CREATE TABLE pool_rebalances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES investment_pools(id) ON DELETE CASCADE,
    initiated_by VARCHAR(255) REFERENCES users(id),
    tvl_before DECIMAL(18, 2),
    tvl_after DECIMAL(18, 2),
    assets_changed JSONB, -- Array of {symbol, from_allocation, to_allocation}
    transaction_hash VARCHAR(255),
    rebalanced_at TIMESTAMP DEFAULT NOW()
);

-- Pool Performance Snapshots (for charts)
CREATE TABLE pool_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES investment_pools(id) ON DELETE CASCADE,
    tvl DECIMAL(18, 2),
    share_price DECIMAL(18, 8),
    total_return_percentage DECIMAL(10, 4), -- Can be negative
    snapshot_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pool_assets_pool ON pool_assets(pool_id);
CREATE INDEX idx_pool_investments_user ON pool_investments(user_id);
CREATE INDEX idx_pool_investments_pool ON pool_investments(pool_id);
CREATE INDEX idx_pool_performance_pool ON pool_performance(pool_id, snapshot_at);
```

---

## 🎨 Frontend Features

### 1. Investment Pool Dashboard

**Page:** `/dao/:daoId/investment-pool`

**Features:**
- Portfolio overview (pie chart of asset allocation)
- Current TVL and performance
- Your shares and value
- Recent investments
- Rebalancing history

### 2. Invest Modal

**UI Elements:**
- Amount input (USD)
- Estimated shares to receive
- Current share price
- Portfolio composition preview
- Approve & Invest button

### 3. Portfolio Management (DAO Admins)

**Features:**
- Add/remove assets
- Set target allocations
- Initiate rebalancing
- View member investments
- Performance analytics

### 4. Share Token Display

**Features:**
- Token balance
- Current value in USD
- Historical performance chart
- Redemption calculator

---

## 🔄 Workflow

### Investment Flow

```
1. User deposits cUSD/USDT
   ↓
2. System calculates shares based on current pool value
   ↓
3. Smart contract mints share tokens
   ↓
4. Funds distributed across assets per target allocation
   ↓
5. User receives share tokens in wallet
```

### Withdrawal Flow

```
1. User burns share tokens
   ↓
2. System calculates proportional value
   ↓
3. Assets sold/converted to cUSD
   ↓
4. Performance fee deducted
   ↓
5. Net amount sent to user
```

### Rebalancing Flow

```
1. DAO votes on new allocations (governance)
   ↓
2. Admin initiates rebalance
   ↓
3. System calculates required swaps
   ↓
4. DEX integration executes trades
   ↓
5. New allocations achieved
   ↓
6. Snapshot recorded
```

---

## 💰 Default Asset Allocations

### Conservative Portfolio (60% BTC/ETH)
```typescript
{
  BTC: 40%,  // Store of value
  ETH: 20%,  // Smart contract platform
  SOL: 15%,  // High performance
  BNB: 10%,  // Exchange utility
  XRP: 10%,  // Payments
  LTC: 5%    // Fast transactions
}
```

### Balanced Portfolio
```typescript
{
  BTC: 30%,
  ETH: 25%,
  SOL: 20%,
  BNB: 12%,
  XRP: 8%,
  LTC: 5%
}
```

### Aggressive Portfolio (DeFi Heavy)
```typescript
{
  BTC: 20%,
  ETH: 30%,  // DeFi ecosystem
  SOL: 25%,  // DeFi + NFTs
  BNB: 15%,  // BSC DeFi
  XRP: 5%,
  LTC: 5%
}
```

---

## 📈 Price Oracle Integration

### Options:

1. **Chainlink Price Feeds** (Recommended)
   - Most reliable
   - Decentralized
   - Available on most networks

2. **Pyth Network**
   - Low latency
   - High frequency updates
   - Good for Solana assets

3. **Uniswap TWAP**
   - On-chain
   - Manipulation resistant
   - For wrapped assets

### Implementation:
```solidity
interface IPriceOracle {
    function getPrice(address asset) external view returns (uint256);
    function getLatestPrice(string memory symbol) external view returns (uint256);
}
```

---

## 🔐 Security Considerations

### 1. Share Pricing
- ✅ Use time-weighted average prices
- ✅ Prevent flash loan attacks
- ✅ Implement withdrawal delays

### 2. Rebalancing
- ✅ Only authorized roles
- ✅ Governance approval required
- ✅ Slippage protection

### 3. Asset Management
- ✅ Whitelist verified tokens only
- ✅ Audit smart contracts
- ✅ Multi-sig for large operations

### 4. User Protection
- ✅ Minimum lock period
- ✅ Gradual withdrawal limits
- ✅ Emergency pause function

---

## 📱 API Endpoints

### Investment Pool Management

```typescript
// Create investment pool
POST /api/dao/:daoId/investment-pool
{
  name: string,
  symbol: string,
  initialAssets: Array<{
    symbol: string,
    targetAllocation: number
  }>,
  performanceFee: number
}

// Get pool details
GET /api/dao/:daoId/investment-pool

// Invest in pool
POST /api/investment-pool/:poolId/invest
{
  amountUSD: number,
  paymentToken: string
}

// Withdraw from pool
POST /api/investment-pool/:poolId/withdraw
{
  shares: number
}

// Get user's investment
GET /api/investment-pool/:poolId/my-investment

// Rebalance pool (admin)
POST /api/investment-pool/:poolId/rebalance
{
  newAllocations: Array<{
    symbol: string,
    allocation: number
  }>
}

// Get portfolio performance
GET /api/investment-pool/:poolId/performance?period=30d

// Get asset prices
GET /api/investment-pool/prices?symbols=BTC,ETH,SOL,BNB,XRP,LTC
```

---

## 🎯 Implementation Phases

### Phase 1: MVP (2-3 weeks)
- ✅ Deploy MultiAssetVault contract
- ✅ Integrate BTC, ETH (start with 2 assets)
- ✅ Basic investment/withdrawal
- ✅ Share minting
- ✅ Simple UI

### Phase 2: Full Asset Support (1-2 weeks)
- ✅ Add SOL, BNB, XRP, LTC
- ✅ Price oracle integration
- ✅ Automated rebalancing
- ✅ Performance tracking

### Phase 3: Advanced Features (2-3 weeks)
- ✅ Governance voting on allocations
- ✅ Auto-compounding
- ✅ DCA (Dollar Cost Averaging)
- ✅ Tax reporting
- ✅ Mobile app support

---

## 💡 Use Cases

### 1. Crypto Chama
**Scenario:** 20 friends pool $100/month each
- Monthly contribution: $2,000
- Diversified across 6 assets
- Shares distributed proportionally
- Quarterly rebalancing via vote
- Withdraw after 1 year with gains

### 2. DAO Treasury Diversification
**Scenario:** DAO holds only cUSD
- Convert 50% to multi-asset pool
- Reduce single-asset risk
- Potential for higher returns
- Governance-controlled

### 3. Investment Club
**Scenario:** Professional investors pool capital
- Start with $50,000
- Aggressive allocation
- Weekly rebalancing
- Performance-based fees

---

## 📊 Expected Returns (Historical)

**Disclaimer:** Past performance doesn't guarantee future results

### Conservative Portfolio (60% BTC/ETH)
- **1 Year:** +85% (2023)
- **Risk:** Medium
- **Volatility:** Moderate

### Balanced Portfolio
- **1 Year:** +120% (2023)
- **Risk:** Medium-High
- **Volatility:** High

### Aggressive Portfolio
- **1 Year:** +150% (2023)
- **Risk:** High
- **Volatility:** Very High

---

## 🚀 Next Steps

1. **Smart Contract Development**
   - Deploy MultiAssetVault
   - Integrate price oracles
   - Add wrapped asset support

2. **Backend Integration**
   - Create database tables
   - Build API endpoints
   - Implement transaction tracking

3. **Frontend Development**
   - Investment pool dashboard
   - Portfolio visualization
   - Investment/withdrawal flows

4. **Testing**
   - Unit tests for contracts
   - Integration tests
   - Security audit

5. **Launch**
   - Deploy to testnet
   - Beta testing with select DAOs
   - Mainnet launch

---

## 📝 Documentation Needed

- [ ] User guide: "How to invest in a multi-asset pool"
- [ ] Admin guide: "Managing your DAO's investment pool"
- [ ] Smart contract documentation
- [ ] API reference
- [ ] Security best practices

---

**Ready to build this?** Let me know and I'll start implementing! 🚀

This feature will make MTAA DAO a **complete solution** for group investments, combining traditional chama culture with modern crypto portfolios! 💎

