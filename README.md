# 🌍 MtaaDAO – Community-Powered DeFi for East Africa

[![Built with TypeScript](https://img.shields.io/badge/TypeScript-88%25-blue)](https://www.typescriptlang.org/)
[![Solidity Smart Contracts](https://img.shields.io/badge/Solidity-2%25-darkred)](https://soliditylang.org/)
[![License MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Status Active](https://img.shields.io/badge/Status-Active-brightgreen)](https://github.com/litmajor/mtaa-dao)

---

## 🎯 What is MtaaDAO?

**MtaaDAO** is a full-stack **DAO and DeFi platform** purpose-built for East African markets. It combines:

- **364+ versioned API endpoints** for DAOs, wallets, treasury management, and trading
- **Three-persona dashboards** for different user types:
  - 👤 **Okedi** – Community governance and participation
  - 📈 **Yuki** – Active trading and profit generation
  - ➕ **Amara** – Passive investment and yield farming
- **M-Pesa on/off-ramp integration** – Native connection to East African mobile money
- **ERC4626 Vault System (MaonoVault)** – Trustless, community-managed savings circles
- **AI-Powered Assistant (Morio)** – Natural language interface for DAO operations

---

## 🚀 Key Features

### Financial Layer
- ✅ **Multi-wallet support** (CELO, cUSD, and wrapped assets)
- ✅ **Personal & community vaults** with yield tracking
- ✅ **Automated vault management** – deposit/withdraw/NAV/fee distribution
- ✅ **Transaction history** with real-time updates
- ✅ **Recurring payment automation** and locked savings mechanisms
- ✅ **Smart Router** – Multi-exchange price comparison and optimal trade execution
- ✅ **CEX Integration** – Direct trading on centralized exchanges with fee optimization

### Governance & Community
- ✅ **Advanced proposal system** with templates and custom fields
- ✅ **Vote delegation** – scoped by category or specific proposals
- ✅ **Task & bounty marketplace** – community-driven contributions
- ✅ **Escrow system** – secure payments with dispute resolution

---

## ⚙️ Worker Observability (Payouts)

Short instructions for monitoring and smoke-testing the referral payout worker are in [docs/worker-observability.md](docs/worker-observability.md).

Quick dry-run smoke test:

```bash
# from repo root
NODE_ENV=development npx ts-node scripts/smoke-payout-worker.ts
```

Set `ADMIN_ALERT_WEBHOOK` to a Discord webhook to receive critical alerts when payouts fail after retries.

- ✅ **Proposal comments** – engagement with likes/reactions
- ✅ **Automated execution** – approved proposals trigger on-chain actions

### Reputation & Engagement
- ✅ **Reputation scoring** – based on contributions and participation
- ✅ **Achievement system** – NFT badges for milestones
- ✅ **Leaderboards** – top contributors and active members
- ✅ **Streak tracking** – incentivize consistent engagement
- ✅ **Referral rewards** – weekly distribution system

### Security & Compliance
- ✅ **KYC/AML framework** – multi-tier verification (Basic, Intermediate, Advanced)
- ✅ **Rate limiting** – protection against brute-force and API abuse
- ✅ **Audit logging** – comprehensive event tracking with 45+ event types
- ✅ **2FA/MFA support** – multi-factor authentication options
- ✅ **Role-based access control (RBAC)** – fine-grained permissions
- ✅ **Session management** – secure token handling

### AI & Automation
- ✅ **Morio AI Assistant** – conversational interface for DAO operations
- ✅ **NURU Cognitive Core** – reasoning, analytics, and contextual awareness
- ✅ **KWETU Economic Layer** – wallet, vault, and transaction management
- ✅ **NLP Intent Recognition** – natural language understanding (EN/Swahili)
- ✅ **Predictive Analytics** – ML-powered DAO insights

---

## 🏗️ Architecture

### Tech Stack

```
Frontend: React 18 + TypeScript + Tailwind CSS + Vite
         Shadcn/UI components + Framer Motion animations

Backend:  Node.js/Express + TypeScript
         PostgreSQL + Drizzle ORM
         Redis for caching
         Winston for logging

Blockchain: Ethers.js v6 + Wagmi + Viem
           ERC4626 (Vault), ERC20, ERC1155 (NFTs)
           Celo network integration

AI/ML:    LLM integration (OpenAI/Claude)
         NLP for intent classification
         Python for ML models

Infrastructure: Docker containers
               GitHub Actions CI/CD
               Socket.io for real-time updates
```

### Project Structure

```
mtaa-dao/
├── contracts/                 # Smart contracts (Solidity)
│   ├── MaonoVault.sol         # ERC4626 yield vault
│   ├── MtaaToken.sol          # ERC20 governance token
│   ├── MaonoVaultFactory.sol  # Factory pattern for vaults
│   └── AchievementNFT.sol     # Achievement badges
│
├── server/                    # Express backend
│   ├── index.ts               # Main entry point
│   ├── routes/                # API endpoints (364+ total)
│   │   ├── dao.ts
│   │   ├── vaults.ts
│   │   ├── users.ts
│   │   ├── proposals.ts
│   │   ├── tasks-v2.ts
│   │   ├── cex.ts             # CEX trading routes
│   │   ├── kyc.ts             # KYC/compliance
│   │   └── admin*.ts          # Admin dashboards
│   ├── services/              # Business logic
│   │   ├── vaultService.ts
│   │   ├── taskManagementService.ts
│   │   ├── smartRouter.ts     # Trade optimization
│   │   ├── cexOrderManager.ts # Order lifecycle
│   │   ├── kycService.ts
│   │   └── auditLogging.ts
│   ├── middleware/            # Express middleware
│   │   ├── rateLimiting.ts
│   │   ├── authentication.ts
│   │   └── cexAuthMiddleware.ts
│   ├── db/                    # Database
│   │   ├── schema.ts          # Drizzle ORM tables
│   │   └── migrations/        # Migration files
│   ├── core/                  # AI layer
│   │   ├── nuru/              # Cognitive core
│   │   ├── kwetu/             # Economic layer
│   │   └── types.ts
│   └── agents/
│       └── morio.ts           # Conversational agent
│
├── src/                       # React frontend
│   ├── components/            # Reusable React components
│   │   ├── ui/                # Shadcn/UI base components
│   │   ├── layout/            # Page layouts
│   │   └── sections/          # Feature sections
│   ├── pages/                 # Page components
│   │   ├── dashboard/
│   │   ├── dao/
│   │   ├── vault/
│   │   ├── proposals/
│   │   └── settings/
│   ├── hooks/                 # React custom hooks
│   ├── store/                 # State management
│   ├── services/              # Frontend API clients
│   └── types/                 # TypeScript types
│
├── docs/                      # Documentation
│   ├── README.md              # Technical overview
│   ├── ROADMAP.md             # Project roadmap
│   ├── PROGRESS.md            # Completion status
│   ├── vault-roadmap.md       # Vault evolution plan
│   └── extra.md               # Assistant architecture
│
├── docs-site/                 # Nextra documentation site
│   ├── pages/                 # MDX documentation
│   └── components/            # Interactive docs components
│
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite bundler config
└── .env.example               # Environment variables template
```

---

## 📦 Getting Started

### Prerequisites
- **Node.js** 18+ (or 20+)
- **npm** or **pnpm**
- **PostgreSQL** 13+ (for database)
- **Redis** 6+ (for caching)
- **Wallet** with CELO/cUSD (for blockchain interaction)

### 1. Clone & Install

```bash
git clone https://github.com/litmajor/mtaa-dao.git
cd mtaa-dao

# Install dependencies
npm install

# Install documentation site dependencies
cd docs-site && npm install && cd ..
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Fill in required values:
# - DATABASE_URL (PostgreSQL connection string)
# - REDIS_URL (Redis connection)
# - RPC_URL (Celo RPC endpoint)
# - PRIVATE_KEY (for contract deployment)
# - API_KEYS (OpenAI, CEX exchanges, payment providers)
```

### 3. Database Setup

```bash
# Run migrations
npm run db:push

# Or use drizzle-kit directly
npm run migrate
```

### 4. Development

```bash
# Start development server (frontend + backend)
npm run dev

# Run backend only
npm run dev

# Run tests
npm run test

# Type checking
npm run check

# Linting & formatting
npm run lint
npm run format
```

### 5. Production Build

```bash
# Build both frontend and backend
npm run build

# Run in production
npm run start:prod
```

### 6. Documentation Site

```bash
# Start local docs (Nextra)
cd docs-site
npm run dev
# Opens at http://localhost:4001
```

---

## 🔌 API Overview

### Core Endpoints (364+ total)

**DAO Management**
```
GET    /api/dao                    # List all DAOs
POST   /api/dao                    # Create new DAO
GET    /api/dao/:daoId             # Get DAO details
PATCH  /api/dao/:daoId             # Update DAO settings
```

**Vault Operations**
```
GET    /api/vaults                 # List vaults
POST   /api/vaults                 # Create vault
GET    /api/vaults/:vaultId        # Get vault details
POST   /api/vaults/:vaultId/deposit    # Deposit to vault
POST   /api/vaults/:vaultId/withdraw   # Withdraw from vault
```

**Proposals & Governance**
```
GET    /api/proposals              # List proposals
POST   /api/proposals              # Create proposal
GET    /api/proposals/:id          # Get proposal details
POST   /api/proposals/:id/vote     # Vote on proposal
POST   /api/proposals/:id/execute  # Execute approved proposal
```

**User Management**
```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login
POST   /api/auth/logout            # Logout
GET    /api/user/profile           # Get user profile
PATCH  /api/user/profile           # Update profile
```

**Trading (YUKI)**
```
POST   /api/cex/credentials        # Store exchange credentials
GET    /api/cex/prices             # Get price comparison
POST   /api/cex/smart-route        # Calculate optimal route
POST   /api/cex/orders             # Place order
GET    /api/cex/arbitrage          # Get arbitrage opportunities
```

**Tasks & Bounties**
```
GET    /api/tasks-v2/bounties/active    # Active bounties
GET    /api/tasks-v2/user/my-tasks      # User's tasks
POST   /api/tasks-v2/assignments/:id/accept  # Accept task
```

**Admin Analytics**
```
GET    /api/admin/analytics        # Platform analytics
GET    /api/admin/ai-metrics       # AI layer metrics
GET    /api/admin/compliance       # Compliance reports
```

See [API Documentation](docs/README.md) for complete endpoint reference.

---

## 🤖 AI Layer (NURU-KWETU-MORIO)

### Three-Layer AI System

**1. NURU – The Mind (Cognitive Core)**
- Natural language understanding and intent recognition
- Reasoning and decision support for DAO operations
- Financial, proposal, and community data analysis
- Ethical governance guidance
- Agent memory and context management

**2. KWETU – The Body (Economic Layer)**
- Wallet management and balance tracking
- Vault operations and yield management
- Proposal lifecycle management
- Transaction processing
- On/off-ramp integration (M-Pesa, Paystack)

**3. MORIO – The Spirit (Conversational Agent)**
- Natural language interface to the entire DAO
- Bilingual support (English + Swahili)
- Context-aware responses
- Real-time notifications
- Integration with all DAO operations

### Example: Morio in Action

```
User: "What's my YUKI balance?"
Morio → NURU: Intent = "check_balance", Context = "trading_account"
      → KWETU: Fetch user's YUKI vault balance
      → Response: "Your YUKI trading account has $450.75 in cUSD, with gains of +$28.50 today (6.8%)"

User: "Create a proposal to fund community marketing"
Morio → NURU: Intent = "create_proposal", Type = "spending", Amount = derived
      → KWETU: Create proposal record, emit event
      → Response: "✅ Proposal #47 created. Description visible to 245 members. Voting opens now."
```

---

## ⛓️ Blockchain Integration

### Smart Contracts

**MaonoVault (ERC4626)**
- Tokenized yield vault for community savings
- Automatic NAV calculation
- Performance fee distribution
- Multi-strategy support

**MtaaToken (ERC20)**
- Governance token for DAO voting
- Staking mechanism for reputation
- Transferable and burnable

**MaonoVaultFactory**
- Permissionless vault creation
- Standardized deployment

**AchievementNFT (ERC1155)**
- Reputation badges
- Milestone NFTs
- Leaderboard integration

### Blockchain Networks
- ✅ **Celo Mainnet** (primary)
- 🚧 **Celo Alfajores** (testnet)
- 🔮 **Cross-chain support** (planned for Phase 3)

### Deploy Contracts

```bash
# Compile
npm run compile-contracts

# Deploy to testnet
npx hardhat run scripts/deploy_maono_vault.ts --network alfajores

# Deploy to mainnet
npx hardhat run scripts/deploy_maono_vault.ts --network celo
```

---

## 🛠️ Development Guide

### Add a New API Endpoint

```typescript
// server/routes/myfeature.ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/my-endpoint', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    // Your logic here
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Add to Express Server

```typescript
// server/index.ts
import myfeatureRouter from './routes/myfeature';
app.use('/api', myfeatureRouter);
```

### Create a React Component

```typescript
// src/components/MyFeature.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function MyFeature() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/my-endpoint')
      .then(r => r.json())
      .then(setData);
  }, []);

  return (
    <div>
      <h2>My Feature</h2>
      {/* Your component JSX */}
    </div>
  );
}
```

---

## 📊 Project Progress

**Overall Completion: 88%** ✅

### Completed Phases ✅
- ✅ Phase 1 – Foundation (Schema, Core DAO, Authentication)
- ✅ Phase 2 – Financial Layer (Wallets, Transactions, Vaults)
- ✅ Phase 3 – Governance (Advanced proposals, Tasks, Reputation)

### In Progress 🚧
- 🚧 AI Layer Implementation (NURU-KWETU-MORIO integration)
- 🚧 Advanced Analytics & Predictive Modeling
- 🚧 Multi-chain Expansion (Polygon, Arbitrum)

### Planned 🔮
- 🔮 Privacy Assets Support (XMR, ZEC synthetic)
- 🔮 Universal DAO Finance Layer
- 🔮 Cross-chain Treasury Management

See [ROADMAP.md](docs/ROADMAP.md) and [PROGRESS.md](docs/PROGRESS.md) for details.

---

## 🔒 Security

### Implemented Protections
- ✅ Rate limiting (global, auth, API, sensitive operations)
- ✅ Audit logging (45+ event types, comprehensive queries)
- ✅ KYC/AML framework (3-tier verification)
- ✅ 2FA/MFA support (email OTP, authenticator apps)
- ✅ RBAC (fine-grained role-based access)
- ✅ Session management (secure token handling)
- ✅ Input validation (Zod schemas)
- ✅ SQL injection prevention (parameterized queries)

### Running Security Audits

```bash
# Audit existing code
npm run scan:production

# Type checking
npm run check

# Linting
npm run lint
```

---

## 🌐 Deployment

### Docker

```bash
# Build Docker image
docker build -t mtaa-dao .

# Run container
docker run -e DATABASE_URL="..." -e REDIS_URL="..." mtaa-dao
```

### GitHub Actions

Auto-deployment on push to `main`:
1. Run tests and linting
2. Build contracts
3. Deploy to staging
4. Smoke tests
5. Deploy to production

---

## 📚 Documentation

- **[API Reference](docs/README.md)** – Complete endpoint documentation
- **[Vault Architecture](docs/vault-roadmap.md)** – Vault system evolution
- **[AI Assistant Docs](docs/extra.md)** – NURU-KWETU-MORIO architecture
- **[Smart Contract Docs](contracts/README.md)** – Contract ABI and functions
- **[Blockchain Integration](server/blockchain.md)** – RPC setup and contract calls
- **[Vault Automation](server/vault_automation.md)** – NAV updates and event indexing
- **[Interactive Docs](docs-site/)** – Live examples and tutorials (Nextra)

---

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Code Style
- TypeScript strict mode enabled
- ESLint + Prettier enforced
- Commit messages follow conventional commits

---

## 📄 License

This project is licensed under the **MIT License** – see [LICENSE](LICENSE) file for details.

---

## 🤙 Support & Community

- **Issues**: [GitHub Issues](https://github.com/litmajor/mtaa-dao/issues)
- **Discussions**: [GitHub Discussions](https://github.com/litmajor/mtaa-dao/discussions)
- **Twitter**: [@MtaaDAO](https://twitter.com/mtaadao)
- **Discord**: [Join Community](https://discord.gg/mtaadao)

---

## 👨‍💻 Authors

**Built by the MtaaDAO community** with ❤️ for East Africa.

---

## 🙏 Acknowledgments

- **Celo Foundation** – Blockchain infrastructure
- **OpenZeppelin** – Smart contract libraries
- **Drizzle** – ORM framework
- **Shadcn/UI** – React component library
- **Nextra** – Documentation platform

---

## 🚀 Next Steps

1. **[Read the documentation](docs/README.md)**
2. **[Explore the API](http://localhost:3000/api/docs)** (Swagger)
3. **[Join the community](https://discord.gg/mtaadao)**
4. **[Contribute to the project](CONTRIBUTING.md)**

**Happy Building! 🌍💚**

---

*Last updated: May 7, 2026*
*Repository: [litmajor/mtaa-dao](https://github.com/litmajor/mtaa-dao)*
