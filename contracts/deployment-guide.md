# MTAA Token Implementation Guide
# 🆕 Recent Upgrades & New Logic

This guide reflects the latest upgrades to the MTAA DAO contracts:

- **DAO Treasury Address:** Proposal fees and platform revenues now route to a configurable treasury address, settable via governance.
- **Daily Challenge Rate-Limit:** Users can only claim daily challenge rewards once per 24 hours, enforced on-chain.
- **Vault Performance Metrics:** Vaults now track net profit and ROI, enabling performance-based rewards and analytics.
- **Liquidity Rewards Calculation:** Rewards for liquidity providers are now pro-rated based on their share of total LP tokens in the pool.
- **Reward Minting Logic:** RewardsManager can mint MTAA directly if authorized, or transfer from its balance, with events emitted before external calls.
- **Timelock Execution Hook:** Governance proposals include a placeholder for future timelock/queued execution of on-chain actions.

## 🚀 Complete System Overview

Your MTAA tokenomics implementation consists of **4 main contracts**:

1. **MTAAToken.sol** - Core ERC20 token with staking, vesting, and governance
2. **MTAARewardsManager.sol** - Handles all reward distributions and task management
3. **MTAAGovernance.sol** - Manages proposals and voting
4. **Enhanced MaonoVault/Factory** - Integration with vault system

## 📋 Deployment Order & Setup
### Step-by-Step Integration (2025 Edition)

#### 1. Deploy Core Contracts
1. Deploy `MTAAToken.sol` (ERC20Votes, Ownable, Pausable, Staking, Vesting)
2. Deploy `MaonoVaultFactory.sol` (vault deployment, asset support)
3. Deploy `MTAARewardsManager.sol` (pass MTAA token and vault factory addresses)
4. Deploy `MTAAGovernance.sol` (pass MTAA token and rewards manager addresses)

#### 2. Configure Treasury and Permissions
1. Set the DAO treasury address in both RewardsManager and Governance contracts:
    ```js
    await rewardsManager.setDaoTreasury(treasuryAddress);
    await governance.setDaoTreasury(treasuryAddress);
    ```
2. Transfer ownership of token and rewards manager to governance:
    ```js
    await mtaaToken.transferOwnership(governance.address);
    await rewardsManager.transferOwnership(governance.address);
    ```

#### 3. Distribute Initial Tokens & Vesting
1. Create vesting schedules for community, team, ecosystem, partners (see below)
2. Transfer initial tokens to governance and rewards manager

#### 4. Fund Rewards Manager
1. Transfer MTAA to rewards manager for initial reward pool
    ```js
    await mtaaToken.transfer(rewardsManager.address, ethers.utils.parseEther("50000000"));
    ```

#### 5. Integrate Vaults & Rewards
1. Deploy vaults via factory; rewards are triggered automatically
2. Vaults now track ROI and net profit for analytics and top-performer rewards

#### 6. Enable Daily Challenges & Rate-Limits
1. Users can claim daily challenge rewards once per 24h (enforced by contract)
    ```js
    await rewardsManager.completeDailyChallenge(userAddress, "VOTE_PROPOSAL");
    // Will revert if already claimed today
    ```

#### 7. Governance & Timelock
1. Create proposals, vote, and execute via governance contract
2. Proposal fees are routed to treasury; execution includes a Timelock hook for future upgrades

#### 8. Analytics & Monitoring
1. Query vault performance, ROI, and user engagement metrics via contract view functions


### Phase 1: Core Token Deployment

```javascript
// 1. Deploy MTAA Token
const MTAAToken = await ethers.getContractFactory("MTAAToken");
const mtaaToken = await MTAAToken.deploy(deployerAddress);
console.log("MTAA Token:", mtaaToken.address);

// 2. Deploy Rewards Manager
const MTAARewardsManager = await ethers.getContractFactory("MTAARewardsManager");
const rewardsManager = await MTAARewardsManager.deploy(
    mtaaToken.address,
    vaultFactoryAddress // from previous deployment
);
console.log("Rewards Manager:", rewardsManager.address);

// 3. Deploy Governance
const MTAAGovernance = await ethers.getContractFactory("MTAAGovernance");
const governance = await MTAAGovernance.deploy(
    mtaaToken.address,
    rewardsManager.address
);
console.log("Governance:", governance.address);
```

### Phase 2: Initial Token Distribution

```javascript
// Create vesting schedules for different categories
const now = Math.floor(Date.now() / 1000);

// Community Rewards (400M MTAA - 4 year linear)
await mtaaToken.createVestingSchedule(
    rewardsManager.address,
    ethers.utils.parseEther("400000000"), // 400M tokens
    now,
    4 * 365 * 24 * 60 * 60, // 4 years
    0, // No cliff
    0  // COMMUNITY_REWARDS
);

// Team & Advisors (150M MTAA - 3 years, 1 year cliff)
await mtaaToken.createVestingSchedule(
    teamMultisigAddress,
    ethers.utils.parseEther("150000000"), // 150M tokens
    now,
    3 * 365 * 24 * 60 * 60, // 3 years
    365 * 24 * 60 * 60,     // 1 year cliff
    1  // TEAM_ADVISORS
);

// Ecosystem Development (100M MTAA - 5 years linear)
await mtaaToken.createVestingSchedule(
    ecosystemAddress,
    ethers.utils.parseEther("100000000"), // 100M tokens
    now,
    5 * 365 * 24 * 60 * 60, // 5 years
    0, // No cliff
    2  // ECOSYSTEM_DEV
);

// DAO Treasury (200M MTAA - governance controlled)
await mtaaToken.transfer(governance.address, ethers.utils.parseEther("200000000"));

// Strategic Partners (25M MTAA - 2 years linear)
await mtaaToken.createVestingSchedule(
    partnersAddress,
    ethers.utils.parseEther("25000000"), // 25M tokens
    now,
    2 * 365 * 24 * 60 * 60, // 2 years
    0, // No cliff
    3  // STRATEGIC_PARTNERS
);
```

### Phase 3: System Integration

```javascript
// Fund rewards manager with initial tokens
await mtaaToken.transfer(rewardsManager.address, ethers.utils.parseEther("50000000"));

// Set up permissions
await mtaaToken.transferOwnership(governance.address); // Governance controls token
await rewardsManager.transferOwnership(governance.address); // Governance controls rewards
```

## 💼 User Interaction Examples
### New User Flows (2025)

- **Daily Challenges:** Only one claim per 24h per user
- **Vault Rewards:** Vaults track ROI/net profit, and top performers get extra rewards
- **Liquidity Rewards:** Pro-rated based on LP share
- **Governance:** Proposal fees go to treasury, execution supports timelock
- **Staking, Vesting, and Reputation:** Unchanged, but now fully governed


### For Regular Users

#### 1. Daily Challenges
```javascript
// Frontend calls this when user completes actions
await rewardsManager.completeDailyChallenge(userAddress, "VOTE_PROPOSAL");
await rewardsManager.completeDailyChallenge(userAddress, "COMPLETE_TASK");
await rewardsManager.completeDailyChallenge(userAddress, "INVITE_MEMBER");
```

#### 2. Staking MTAA
```javascript
const mtaaContract = new ethers.Contract(mtaaAddress, MTAA_ABI, signer);

// Stake 1000 MTAA for 90 days
const stakeAmount = ethers.utils.parseEther("1000");
const lockPeriod = 90;

await mtaaContract.stake(stakeAmount, lockPeriod);

// Check rewards
const rewards = await mtaaContract.calculateStakeRewards(userAddress);
console.log("Pending rewards:", ethers.utils.formatEther(rewards));

// Unstake (after lock period)
await mtaaContract.unstake();
```

#### 3. Vault Interactions with MTAA Rewards
```javascript
// When user creates vault - they get MTAA rewards automatically
const tx = await factory.deployVault(/*...params...*/, {value: deploymentFee});
// This triggers rewardsManager.rewardVaultCreation()

// When user makes first deposit - gets first deposit bonus
const vault = new ethers.Contract(vaultAddress, VAULT_ABI, signer);
await vault.deposit(depositAmount, userAddress);
// This triggers rewardsManager.rewardFirstDeposit()
```

#### 4. Governance Participation
```javascript
const governance = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

// Create proposal (costs MTAA + requires reputation)
await governance.createProposal(
    "Increase Vault Rewards",
    "Proposal to increase vault creation rewards by 50%",
    0 // ProposalType.STANDARD
);

// Vote on proposal
await governance.vote(proposalId, 1); // VoteType.FOR

// Execute proposal (after voting period)
await governance.executeProposal(proposalId);
```

### For Managers/Admins

#### 1. Task Management
```javascript
const rewardsManager = new ethers.Contract(rewardsAddress, REWARDS_ABI, signer);

// Create tasks
const taskId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("AUDIT_VAULT_001"));
await rewardsManager.createTask(
    taskId,
    3, // TaskDifficulty.EXPERT
    ethers.utils.parseEther("25000"), // 25k MTAA reward
    Date.now() + (30 * 24 * 60 * 60), // 30 day deadline
    "Audit smart contract for security vulnerabilities"
);

// Mark task as completed
await rewardsManager.completeTask(taskId, userAddress);
```

#### 2. Reward Distribution
```javascript
// Reward vault creation (called by factory automatically)
await rewardsManager.rewardVaultCreation(creatorAddress, vaultAddress);

// Reward liquidity provision
await rewardsManager.rewardLiquidityProvider(
    userAddress,
    lpTokenAmount,
    "MTAA/cUSD"
);

// Set top performing vault
await rewardsManager.setTopPerformingVault(vaultAddress, true);
```

## 🎮 Frontend Integration

### React Hooks for MTAA

```javascript
// useMAA.js
import { useState, useEffect } from 'react';

export const useMTAABalance = (userAddress, provider) => {
    const [balance, setBalance] = useState('0');
    const [stakeInfo, setStakeInfo] = useState(null);
    const [reputation, setReputation] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            const mtaaContract = new ethers.Contract(MTAA_ADDRESS, MTAA_ABI, provider);
            
            const [userBalance, stake, rep] = await Promise.all([
                mtaaContract.balanceOf(userAddress),
                mtaaContract.getStakeInfo(userAddress),
                mtaaContract.reputationScores(userAddress)
            ]);

            setBalance(ethers.utils.formatEther(userBalance));
            setStakeInfo(stake);
            setReputation(rep.toNumber());
        };

        if (userAddress && provider) {
            fetchData();
        }
    }, [userAddress, provider]);

    return { balance, stakeInfo, reputation };
};

export const useDailyChallenges = (userAddress, provider) => {
    const [streak, setStreak] = useState(0);
    const [availableChallenges, setAvailableChallenges] = useState([]);

    useEffect(() => {
        const fetchStreak = async () => {
            const mtaaContract = new ethers.Contract(MTAA_ADDRESS, MTAA_ABI, provider);
            const userStreak = await mtaaContract.getUserStreak(userAddress);
            setStreak(userStreak.toNumber());
        };

        fetchStreak();
    }, [userAddress, provider]);

    const completechallenge = async (challengeType, signer) => {
        const rewardsContract = new ethers.Contract(REWARDS_ADDRESS, REWARDS_ABI, signer);
        const tx = await rewardsContract.completeDailyChallenge(userAddress, challengeType);
        await tx.wait();
        
        // Refresh streak
        const mtaaContract = new ethers.Contract(MTAA_ADDRESS, MTAA_ABI, provider);
        const newStreak = await mtaaContract.getUserStreak(userAddress);
        setStreak(newStreak.toNumber());
    };

    return { streak, availableChallenges, completechallenge };
};
```

### Dashboard Components

```javascript
// MTAADashboard.js
const MTAADashboard = ({ userAddress, signer, provider }) => {
    const { balance, stakeInfo, reputation } = useMTAABalance(userAddress, provider);
    const { streak } = useDailyChallenges(userAddress, provider);

    const getReputationTier = (rep) => {
        if (rep >= 10000) return "Architect";
        if (rep >= 5000) return "Elder";
        if (rep >= 1000) return "Contributor";
        return "Member";
    };

    const handleStake = async (amount, lockPeriod) => {
        const mtaaContract = new ethers.Contract(MTAA_ADDRESS, MTAA_ABI, signer);
        const tx = await mtaaContract.stake(
            ethers.utils.parseEther(amount.toString()),
            lockPeriod
        );
        await tx.wait();
        alert('Staking successful!');
    };

    return (
        <div className="mtaa-dashboard">
            <div className="stats-grid">
                <div className="stat-card">
                    <h3>MTAA Balance</h3>
                    <p>{parseFloat(balance).toLocaleString()} MTAA</p>
                </div>
                
                <div className="stat-card">
                    <h3>Reputation</h3>
                    <p>{reputation.toLocaleString()} ({getReputationTier(reputation)})</p>
                </div>
                
                <div className="stat-card">
                    <h3>Daily Streak</h3>
                    <p>{streak} days</p>
                </div>
                
                {stakeInfo && stakeInfo.isActive && (
                    <div className="stat-card">
                        <h3>Staked Amount</h3>
                        <p>{ethers.utils.formatEther(stakeInfo.amount)} MTAA</p>
                        <small>{stakeInfo.lockPeriod} days remaining</small>
                    </div>
                )}
            </div>

            <div className="actions">
                <button onClick={() => handleStake(1000, 90)}>
                    Stake 1000 MTAA (90 days)
                </button>
                <button onClick={() => handleStake(5000, 365)}>
                    Stake 5000 MTAA (365 days)
                </button>
            </div>
        </div>
    );
};
```

## 💰 Revenue Model Implementation
### Updated Revenue Flows

- **Proposal Fees:** Routed to DAO treasury address
- **Platform Fees:** 50% burned, 50% to treasury
- **Vault Performance:** Top-performing vaults rewarded based on ROI
- **Liquidity Rewards:** Pro-rated by LP share


### 1. Platform Fees (Automatic)
```javascript
// When users pay fees, 50% burned, 50% to treasury
// This happens automatically in the token contract

// DAO creation: 1000 MTAA fee
await mtaaToken.payDAOCreationFee(); // Called by user

// Vault deployment: 500 MTAA fee  
await mtaaToken.payVaultDeploymentFee(); // Called by user
```

### 2. Staking Revenue
```javascript
// Users stake MTAA to earn yield
// Platform benefits from reduced circulating supply
// Higher staking = higher token price = more valuable rewards

// Quarterly burns reduce supply further
await mtaaToken.quarterlyBurn(); // Called by owner quarterly
```

### 3. Governance Revenue
```javascript
// Proposal fees go to treasury
// Failed malicious proposals get burned (slashing)
// Platform gets stronger governance over time
```

## 📊 Analytics & Monitoring
### New Metrics

- Vault ROI and net profit (performance-based rewards)
- Daily challenge participation (rate-limited)
- Treasury balance and proposal fee tracking
- Liquidity provider share and rewards


### Key Metrics to Track

```javascript
// Token metrics
const totalSupply = await mtaaToken.totalSupply();
const totalStaked = await mtaaToken.totalStaked(); // You'll need to add this
const totalBurned = await mtaaToken.totalBurned();
const burnProgress = await mtaaToken.getBurnProgress();

// User engagement
const activeStakers = await getActiveStakers(); // Custom query
const dailyActiveUsers = await getDailyActiveUsers(); // Custom query
const averageStreak = await getAverageStreak(); // Custom query

// Governance participation
const proposalCount = await governance.proposalCount();
const participationRate = await getVotingParticipation(); // Custom query

// Vault integration
const vaultCount = await factory.getDeployedVaultsCount();
const totalTVL = await getTotalVaultTVL(); // Custom query
```

## 🔄 Migration & Upgrade Path

### For Existing Users
1. **Airdrop Strategy**: Distribute MTAA to current vault users based on their activity
2. **Bonus Periods**: Extra rewards for early adopters
3. **Gradual Migration**: Allow users to opt-in to MTAA rewards

### For New Features
1. **Proxy Contracts**: Use upgradeable contracts for non-critical components
2. **Feature Flags**: Enable/disable features through governance
3. **Backward Compatibility**: Ensure old vault contracts still work

## ⚠️ Security Considerations
### Additional Security Upgrades

- Daily challenge rate-limits to prevent abuse
- Treasury address can be updated via governance
- Timelock hook for proposal execution (future-proofing)
- Checks-effects-interactions pattern for all reward logic


### Before Mainnet Deployment

1. **Audit All Contracts**: Especially MTAA token and rewards manager
2. **Test Thoroughly**: Deploy on testnet with real usage patterns
3. **Gradual Rollout**: Start with limited supply and features
4. **Emergency Controls**: Implement pause mechanisms
5. **Monitor Closely**: Track all metrics in real-time

### Risk Mitigation

```javascript
// Set conservative limits initially
await mtaaToken.setLockPeriodMultiplier(365, 10000); // Start with 10% APY max
await rewardsManager.setMilestoneReward(1000 * 1e18, 100 * 1e18); // Lower rewards

// Emergency pause if needed
await mtaaToken.pause();
await rewardsManager.pause();
```

This implementation gives you a complete tokenomics system that:
- ✅ Incentivizes all desired behaviors from your whitepaper
- ✅ Integrates seamlessly with existing vault system
- ✅ Provides sustainable revenue streams
- ✅ Enables decentralize