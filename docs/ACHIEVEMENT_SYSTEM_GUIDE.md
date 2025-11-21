# MTAA Comprehensive Achievement NFT System

## Overview

The Achievement NFT System is a comprehensive, multi-tiered gamification framework that rewards user engagement, contributions, and milestones with NFT-based achievements, badges, and leaderboard rankings.

## System Architecture

### Core Components

#### 1. **Achievement Tiers**
- **Bronze**: Entry-level achievements (0-20 total)
- **Silver**: Intermediate achievements (20-40 total)
- **Gold**: Advanced achievements (40-60 total)
- **Platinum**: Elite achievements (60-80 total)
- **Diamond**: Expert achievements (80-100 total)
- **Legendary**: Master achievements (100+)

#### 2. **Achievement Categories**
- **Community**: Community engagement and participation
- **Governance**: Voting, proposals, and governance participation
- **Contribution**: Development, documentation, and contribution
- **Reputation**: Reputation building and social proof
- **Wealth**: Treasury and financial milestones
- **Trading**: DEX trading and swap activities
- **Lending**: Lending and borrowing activities
- **Staking**: Staking and yield farming
- **NFT**: NFT creation and collection
- **Special Event**: Limited-time event achievements
- **Milestone**: Milestone-based achievements

#### 3. **Achievement Status Lifecycle**
```
LOCKED → UNLOCKED → CLAIMED → NFT_MINTED
```

- **Locked**: Requirements not met
- **Unlocked**: Requirements met, ready to claim
- **Claimed**: User claimed the reward
- **NFT Minted**: NFT version created on blockchain

### Achievement Features

#### Progress Tracking
- Real-time progress updates
- Percentage-based progress bars
- Multiple criteria types:
  - Referral counts
  - Voting participation
  - Contribution metrics
  - Reputation scores
  - Transaction volumes
  - Community engagement

#### Reward System
- **Reward Points**: Internal currency for leaderboard
- **Reward Tokens**: Blockchain tokens (MTAA, cUSD, etc.)
- **NFT Minting**: Optional NFT creation for trading/collecting
- **Milestones**: Progressive rewards within achievements

#### NFT Properties
- **Rarity Levels**: Common, Uncommon, Rare, Epic, Legendary
- **Tradeable**: NFT can be listed on marketplace
- **Burnable**: NFT can be burned for special effects
- **Milestone NFTs**: Special NFTs for sub-achievements
- **Metadata**: IPFS-stored metadata with full achievement history

### Badges System

Badges are cosmetic combinations of achievements that unlock when users complete achievement sets.

**Types of Badges:**
- **Achievement Combos**: Multiple specific achievements required
- **Milestone Badges**: Specific threshold achievements
- **Event Badges**: Limited-time event participation
- **Seasonal Badges**: Time-based seasonal achievements

**Badge Features:**
- Display on user profile
- Equippable (one active at a time or multiple)
- Shareable on social media
- Contribute to user reputation

### Milestone System

Progressive levels within achievements for extended engagement.

**Milestone Structure:**
```
Achievement
├── Milestone 1 (Threshold: 10)
├── Milestone 2 (Threshold: 50)
├── Milestone 3 (Threshold: 100)
└── Milestone 4 (Threshold: 500)
```

**Milestone Features:**
- Incremental rewards
- NFT minting eligibility at each level
- Progress notifications
- Cumulative tracking

### Leaderboard System

Multi-dimensional ranking and progression tracking.

**Ranking Factors:**
- Total achievements unlocked
- Reward points earned
- NFT collection size
- User tier progression
- Percentile ranking

**Features:**
- Global top 100 leaderboard
- Category-specific rankings
- Time-based rankings (weekly/monthly)
- Tier-based groupings

## Database Schema

### Core Tables

#### `achievements`
```sql
- id (PK)
- name, description
- category, tier
- criteria (JSON with requirements)
- rewardPoints, rewardTokens
- nftMintable, nftRarity, nftImageUrl
- icon, badgeColor
- isActive, isHidden
- tags (array)
```

#### `user_achievement_progress`
```sql
- id (PK)
- userId (FK)
- achievementId (FK)
- status (locked/unlocked/claimed/nft_minted)
- progressValue, progressPercent
- unlockedAt, claimedAt, nftMintedAt
- nftTokenId, nftContractAddress
- notificationSent
```

#### `achievement_milestones`
```sql
- id (PK)
- achievementId (FK)
- level, name, description
- thresholdValue
- rewardBonus
- nftMintable
```

#### `achievement_badges`
```sql
- id (PK)
- name, description
- requiredAchievementIds (array)
- icon, badgeColor
- isActive
```

#### `achievement_leaderboard`
```sql
- userId (PK)
- totalAchievements
- unlockedAchievements
- totalRewardPoints
- tier
- rank, percentile
```

#### `achievement_events`
```sql
- id (PK)
- userId (FK)
- achievementId (FK)
- eventType (unlocked/claimed/nft_minted/shared)
- metadata (JSON)
- createdAt
```

## API Reference

### Achievement Management

#### GET `/api/achievements`
Retrieve all achievements with optional filters.

**Query Parameters:**
- `category`: Filter by category
- `tier`: Filter by tier
- `hidden`: Include hidden achievements

**Response:**
```json
{
  "success": true,
  "count": 42,
  "achievements": [...]
}
```

#### GET `/api/achievements/:achievementId`
Get detailed achievement information.

#### POST `/api/achievements`
Create new achievement (admin only).

**Body:**
```json
{
  "name": "Community Hero",
  "description": "Help 10 community members",
  "category": "community",
  "tier": "gold",
  "criteria": { "type": "help_count", "threshold": 10 },
  "rewardPoints": 500,
  "rewardTokens": "100",
  "nftMintable": true,
  "nftRarity": "epic",
  "icon": "🦸",
  "badgeColor": "bg-blue-500"
}
```

### User Progress

#### GET `/api/achievements/user/progress`
Get user's achievement progress and statistics.

**Response:**
```json
{
  "success": true,
  "progress": [...],
  "stats": {
    "totalUnlocked": 15,
    "totalClaimed": 12,
    "totalNFTMinted": 5,
    "completionRate": 35.7
  }
}
```

#### PUT `/api/achievements/user/progress/:achievementId`
Update achievement progress.

**Body:**
```json
{
  "progressValue": 7,
  "progressPercent": 70
}
```

#### POST `/api/achievements/:achievementId/unlock`
Unlock achievement for user.

**Body (optional):**
```json
{
  "metadata": { "source": "manual", "reason": "user_request" }
}
```

#### POST `/api/achievements/:achievementId/claim`
Claim achievement reward.

**Response:**
```json
{
  "success": true,
  "message": "Reward claimed successfully!"
}
```

### NFT Minting

#### POST `/api/achievements/:achievementId/mint-nft`
Mint achievement as NFT.

**Body:**
```json
{
  "walletAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "nft": {
    "tokenId": "1",
    "transactionHash": "0x...",
    "success": true
  }
}
```

### Badges

#### GET `/api/achievements/user/badges`
Get user's unlocked badges.

**Response:**
```json
{
  "success": true,
  "badges": [
    {
      "id": "badge_1",
      "name": "Community Champion",
      "icon": "👑",
      "unlockedAt": "2025-11-18T10:30:00Z",
      "isEquipped": true
    }
  ]
}
```

#### POST `/api/achievements/badges`
Create new badge (admin only).

### Milestones

#### POST `/api/achievements/:achievementId/milestones`
Create milestone for achievement (admin only).

**Body:**
```json
{
  "level": 1,
  "name": "First Steps",
  "thresholdValue": 10,
  "rewardBonus": 100,
  "nftMintable": true,
  "icon": "🚀"
}
```

### Leaderboard

#### GET `/api/achievements/leaderboard`
Get top achievers.

**Query Parameters:**
- `limit`: Number of results (default: 10)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "leaderboard": [
    {
      "userId": "user_1",
      "userName": "John Doe",
      "totalAchievements": 42,
      "unlockedAchievements": 35,
      "totalRewardPoints": 5000,
      "tier": "legendary",
      "rank": 1,
      "percentile": 99
    }
  ]
}
```

#### POST `/api/achievements/leaderboard/update`
Force update leaderboard rankings (admin only).

## Smart Contract Functions

### AchievementNFTv2 Contract

#### Minting Functions

```solidity
// Single achievement mint
function mintAchievement(
    address to,
    string memory name,
    string memory category,
    uint8 tier,
    uint256 rarity,
    uint256 rewardPoints,
    uint256 rewardTokens,
    string memory imageUrl,
    string memory metadataUri,
    bool tradeable,
    bool burnable,
    uint256 milestoneLevel
) external onlyOwner returns (uint256)

// Batch mint
function batchMintAchievements(
    address[] calldata recipients,
    string[] calldata names,
    string[] calldata categories,
    uint8[] calldata tiers,
    uint256[] calldata rarities
) external onlyOwner returns (uint256[] memory)
```

#### Marketplace Functions

```solidity
// List for sale
function listForSale(uint256 tokenId, uint256 price) external

// Purchase
function buyAchievement(uint256 tokenId) external payable

// Unlist
function unlistAchievement(uint256 tokenId) external
```

#### Query Functions

```solidity
function getUserAchievements(address user) 
    external view returns (uint256[] memory)

function getAchievementCount(address user) 
    external view returns (uint256)

function getUserReputation(address user) 
    external view returns (uint256)

function hasAchievement(address user, uint256 tokenId) 
    external view returns (bool)
```

## Frontend Components

### AchievementSystemPage
Main page displaying:
- Achievement grid with filtering
- User statistics
- Badge showcase
- Global leaderboard
- Real-time progress bars
- Claim/mint actions

### Achievement Card Features
- Visual tier indicators
- Progress bars
- Reward display
- Status timeline
- Action buttons
- Social sharing

## Initialization

### Create Sample Achievements

```typescript
const achievements = [
  {
    name: "First Steps",
    description: "Complete your first task",
    category: "milestone",
    tier: "bronze",
    criteria: { type: "task_count", threshold: 1 },
    rewardPoints: 10,
    rewardTokens: "1",
    icon: "🚀"
  },
  {
    name: "Community Champion",
    description: "Help 50 users in the community",
    category: "community",
    tier: "platinum",
    criteria: { type: "help_count", threshold: 50 },
    rewardPoints: 1000,
    rewardTokens: "50",
    nftMintable: true,
    nftRarity: "epic",
    icon: "👑"
  }
  // ... more achievements
];

for (const ach of achievements) {
  await AchievementSystemService.createAchievement(ach);
}
```

### Deploy NFT Contract

```bash
npx hardhat run scripts/deploy-achievement-nftv2.ts --network celo
```

## Gamification Mechanics

### Progression System
- Users unlock achievements through actions
- Milestones provide intermediate goals
- Tiers reflect overall achievement level
- Leaderboards drive community competition

### Reward Structure
- Early achievements give quick wins (boosting engagement)
- Mid-tier achievements require sustained effort
- High-tier achievements are prestige symbols
- NFTs add collectible value

### Social Elements
- Badge display on profiles
- Achievement sharing
- Leaderboard rankings
- Community recognition

## Advanced Features

### Special Event Achievements
Limited-time achievements tied to events, with:
- Time-based availability
- Capped awardments
- Special rewards
- Community-wide challenges

### Dynamic Criteria
Achievements can use multiple criteria types:
- Fixed thresholds
- Percentage-based
- Time-based (e.g., "active for 30 days")
- Combination criteria (AND/OR logic)

### Reputation System Integration
- Achievements boost user reputation
- Reputation affects reward multipliers
- Tier-based reputation benefits
- DAO voting influence based on reputation

## Best Practices

1. **Tier Progression**: Balance difficulty - early achievements should be easy, later ones challenging
2. **Reward Balance**: Ensure total rewards are distributed fairly across tiers
3. **Engagement Hooks**: Use milestones to keep users engaged
4. **Community Competitiveness**: Leaderboards drive engagement
5. **Rarity Control**: Limit legendary achievement awards to maintain prestige

## Future Enhancements

- [ ] Achievement trading marketplace
- [ ] Dynamic achievement generation
- [ ] AI-based achievement recommendations
- [ ] Cross-DAO achievement compatibility
- [ ] Achievement collections and sets
- [ ] Seasonal achievement rotations
- [ ] Community voting on new achievements
- [ ] Achievement quest chains
