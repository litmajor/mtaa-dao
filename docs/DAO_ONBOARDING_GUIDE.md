
# DAO Onboarding Guide: Two Perspectives

## Overview

This guide explains the DAO experience from two perspectives:
1. **I Created a DAO** - Founder/Admin view
2. **I Joined a DAO** - Member view

---

## 🎯 Perspective 1: I Created a DAO - What Next?

### Congratulations! You're a DAO Founder

After creating your DAO, here's your complete feature map:

### 📋 Essential Setup (Do These First)

#### 1. **DAO Settings** (`/dao/:id/settings`)
**What it does:** Your DAO control panel
- Configure name, description, governance rules
- Set voting thresholds (quorum, approval %)
- Define member roles and permissions
- Set treasury spending limits
- Configure rotation/mzee system (if applicable)

**Action Items:**
- ✅ Set quorum (recommended: 30-50%)
- ✅ Set approval threshold (recommended: 60-75%)
- ✅ Define daily/monthly treasury limits
- ✅ Choose governance type (token-weighted, 1p1v, quadratic)

---

#### 2. **Billing & Subscription** (`/dao/:id/subscription`)
**What it does:** Manage your DAO's payment plan
- View current tier (Free, Collective, MetaDAO)
- Upgrade/downgrade subscription
- View billing history
- Auto-payment from treasury

**Pricing:**
- **Free:** 0-25 members, public only, ₭0/month
- **Collective:** Unlimited members, ₭1,500/month
- **MetaDAO:** Multi-DAO management, custom pricing

**Important:** Fees auto-deduct from DAO treasury on the 1st of each month

---

#### 3. **DAO Treasury** (`/dao/treasury`)
**What it does:** Your DAO's operating bank account
- All member contributions pool here
- Requires multi-sig approval for withdrawals
- Track deposits, withdrawals, balance
- View transaction history
- Analytics and forecasting

**Key Features:**
- Multi-signature protection (3-of-5 for large amounts)
- Proposal-based withdrawals (no unilateral spending)
- Real-time balance tracking
- Audit trail (100% transparent)

**Use Cases:**
- Pay for monthly subscription
- Distribute salaries/stipends
- Fund community projects
- Emergency fund reserves

---

#### 4. **Investment Vaults** (`/vault`)
**What it does:** Separate investment pools to grow wealth

**❓ Why Vaults ≠ Treasury?**
| Feature | Treasury | Vaults |
|---------|----------|--------|
| **Purpose** | Operating funds | Investment growth |
| **Control** | Multi-sig governance | Optional auto-strategy |
| **Withdrawals** | Proposal required | Direct (for personal) or governed (DAO vaults) |
| **Returns** | 0% (just storage) | 8-15% APY via DeFi |
| **Use Case** | Pay bills, salaries | Grow surplus funds |

**Vault Types:**
- **Personal Vaults:** Individual member investments
- **DAO Vaults:** Community investment pools
- **Goal Vaults:** Targeted savings (e.g., "Buy land in 2 years")

**Action Items:**
- ✅ Create DAO investment vault (optional)
- ✅ Set yield strategy (conservative/moderate/aggressive)
- ✅ Allocate surplus treasury to vault for growth

---

#### 5. **Member Management** (`/dao/:id/members`)
**What it does:** Invite, manage, and track members

**Features:**
- Invite by email, phone, or wallet address
- Assign roles:
  - **Admin:** Full control
  - **Elder:** Create proposals, vote, manage members
  - **Proposer:** Create proposals, vote
  - **Member:** Vote only
- Track contributions per member
- View reputation scores
- Remove/ban members (requires proposal)

**Invitation Types:**
- **Email:** Send invite link via email
- **Phone:** SMS invite (if verified)
- **Invite Code:** Shareable link for public DAOs

---

#### 6. **DAO Chat** (`/dao-chat`)
**What it does:** Internal messaging for your community

**Features:**
- Real-time chat with all members
- Discuss proposals before voting
- Coordinate tasks and events
- Share updates and announcements
- Thread conversations

**Best Practices:**
- Daily check-ins for active DAOs
- Weekly community meetings
- Transparent decision-making

---

#### 7. **Analytics Dashboard** (`/analytics-dashboard`)
**What it does:** AI-powered insights into your DAO

**Metrics Tracked:**
- Treasury growth (30/90/365 day forecasts)
- Member engagement rates
- Voting participation %
- Task completion rates
- Risk assessment (5-factor model)
- Portfolio performance (if using vaults)

**AI Features:**
- Predictive treasury forecasting
- Fraud detection alerts
- Proposal success probability
- Member churn prediction

---

#### 8. **Task Management** (`/tasks`)
**What it does:** Create bounties and reward contributors

**Features:**
- Create tasks with rewards (MTAA tokens or cUSD)
- Set difficulty (easy/medium/hard) with multipliers
- Review submissions
- Auto-verify with AI (score 0-100)
- Track task history

**Workflow:**
1. Admin creates task (e.g., "Design logo - 500 MTAA")
2. Member claims task
3. Member submits proof (screenshot, GitHub link)
4. AI scores submission (70+ = auto-approve)
5. Member earns reward + reputation

---

#### 9. **Leaderboard & Reputation** (`/reputation`)
**What it does:** Gamify participation and reward top contributors

**Features:**
- Reputation points system
- Achievement badges
- NFT minting for achievements
- Task completion streaks
- Voting participation tracking

**Reputation Calculation:**
- Task completion: +50-200 points (difficulty-based)
- Proposal creation: +25 points
- Voting: +10 points
- Streak bonuses: up to 5x multiplier

---

#### 10. **Governance & Proposals** (`/proposals`)
**What it does:** Democratic decision-making system

**Proposal Types:**
- **Grant:** Request funds from treasury
- **Policy:** Change DAO rules
- **Membership:** Add/remove members
- **Treasury:** Approve large withdrawals
- **Partnership:** Collaborate with other DAOs

**Workflow:**
1. Create proposal (requires role: Proposer/Elder/Admin)
2. Discussion period (1-7 days)
3. Voting period (3-7 days)
4. Execution (if passed, auto-executes or queues)

---

### 📊 Recent Activity Widget
Track latest:
- New members joined
- Proposals created/voted
- Treasury deposits/withdrawals
- Tasks completed
- Chat messages

---

## 🤝 Perspective 2: I Joined a DAO - What Can I Do?

### Welcome to the Community!

As a DAO member, here's what you can access:

### 🏠 Your Dashboard (`/dashboard`)
**What you see:**
- Your membership status and role
- Your contributions to this DAO
- Your voting power
- Pending tasks
- Recent proposals
- Your reputation score

---

### 💰 DAO Treasury (View Only) (`/dao/treasury`)
**What you can do:**
- **View balance:** See how much the DAO has
- **Deposit funds:** Contribute to the treasury
- **View history:** See all transactions (100% transparent)
- **Cannot withdraw directly:** Must create proposal and get votes

**Why restrictions?**
- Prevents theft
- Requires community consensus
- Protects everyone's funds

---

### 🏦 Investment Vaults (Optional) (`/vault`)
**What are vaults?**
Think of them as the DAO's investment accounts separate from the operating treasury.

**Key Difference:**
- **Treasury = Operating Funds**
  - Pay for DAO expenses (subscriptions, salaries)
  - Requires governance to withdraw
  - 0% returns (just storage)
  
- **Vaults = Investment Accounts**
  - Earn 8-15% APY via DeFi strategies
  - Optional participation (you choose to deposit)
  - Can be personal or DAO-wide

**Can I use vaults?**
Yes! Two ways:
1. **Personal Vault:** Your own investment account (independent of DAO)
2. **DAO Vault:** Contribute to DAO's investment pool (shared returns)

**Example:**
You contribute ₭5,000 to treasury (operating funds) AND ₭10,000 to a vault (investment). Treasury pays bills, vault grows at 12% APY.

---

### 🗳️ Vote on Proposals (`/proposals`)
**Your most important power!**

**What you can vote on:**
- Treasury spending
- New member admissions
- Policy changes
- DAO strategy

**Your voting power:**
- Depends on governance type (1 member = 1 vote OR token-weighted)
- Delegation allowed (give your vote to trusted member)

**Voting Period:**
- Typically 3-7 days
- Need quorum (e.g., 30% participation)
- Need approval (e.g., 60% yes votes)

---

### ✅ Claim Tasks & Earn (`/tasks`)
**Build reputation and earn rewards**

**How it works:**
1. Browse available tasks
2. Claim one that fits your skills
3. Complete and submit proof
4. Get verified (AI + human review)
5. Earn MTAA tokens + reputation points

**Task Categories:**
- Design (logos, graphics)
- Development (code, smart contracts)
- Marketing (social media, content)
- Community (moderation, support)
- Research (analysis, reports)

---

### 💬 DAO Chat (`/dao-chat`)
**Connect with members**

**Features:**
- Real-time messaging
- Discuss proposals
- Coordinate activities
- Build relationships
- Get help from admins

---

### 🏆 Leaderboard (`/reputation`)
**See top contributors**

**What it shows:**
- Reputation rankings
- Achievement unlocks
- Task completion stats
- Voting participation

**Your goals:**
- Earn reputation points
- Unlock achievement NFTs
- Climb the leaderboard
- Get recognized

---

## 🔑 Key Differences: Creator vs Member

| Feature | Creator/Admin | Member |
|---------|---------------|--------|
| **Settings** | Full access | View only |
| **Billing** | Manage subscription | No access |
| **Treasury** | Multi-sig control | View + Deposit only |
| **Vaults** | Create DAO vaults | Join existing or create personal |
| **Members** | Invite, remove, assign roles | View members |
| **Chat** | Moderate | Participate |
| **Analytics** | Full dashboard | Personal metrics only |
| **Tasks** | Create, verify | Claim, complete |
| **Leaderboard** | View all | View all |
| **Proposals** | Create any type | Create (if Proposer role) |
| **Voting** | Vote + execute | Vote only |

---

## 💡 Quick Tips

### For Creators:
1. ✅ Set up governance rules FIRST (quorum, approval %)
2. ✅ Invite 3-5 trusted members as Elders
3. ✅ Create 2-3 starter tasks to engage members
4. ✅ Fund treasury with 3-6 months of subscription fees
5. ✅ Consider a DAO vault for surplus funds (earn 8-15% APY)
6. ✅ Weekly community meetings in DAO chat

### For Members:
1. ✅ Read the DAO's governance rules
2. ✅ Introduce yourself in DAO chat
3. ✅ Vote on active proposals (your voice matters!)
4. ✅ Claim 1-2 tasks to build reputation
5. ✅ Optional: Join DAO vault to earn passive income
6. ✅ Contribute what you can to treasury

---

## 🚀 Next Steps

### Just Created a DAO?
1. Complete onboarding tour (pops up automatically)
2. Configure settings
3. Invite first 5 members
4. Create first proposal
5. Set up recurring tasks

### Just Joined a DAO?
1. Complete member onboarding tour
2. Introduce yourself in chat
3. Vote on active proposals
4. Claim your first task
5. Explore investment vaults (optional)

---

## 📞 Need Help?

- **In-app:** Chat with Morio AI assistant
- **Documentation:** https://docs.mtaadao.com
- **Support:** support@mtaadao.com
- **Community:** Discord/Telegram

---

**Remember:** Treasury = Operating Funds, Vaults = Investment Growth! 🚀
