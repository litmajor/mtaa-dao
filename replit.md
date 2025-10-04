
# MtaaDAO — Full Project Scope

## System Architecture

### Smart Contracts
- **MaonoVault (ERC4626):** Flagship vault contract for managed, trustless, DAO-linked crypto vaults
- **DAO Governance Contracts:** Proposals, voting, membership, treasury
- **OpenZeppelin Contracts:** Security, access control, and token standards
- **Hardhat:** Development, testing, and deployment framework

### Backend
- **Node.js/Express:** RESTful API for vaults, DAOs, users, payments, analytics
- **Drizzle ORM:** Type-safe database operations
- **Neon/PostgreSQL:** Serverless, scalable database
- **Vault Automation:** Scripts for NAV updates, fee collection, and event indexing
- **Blockchain Integration:** Ethers.js for contract calls and event listening
- **Payments API:** Mpesa, Stripe, crypto, platform fee logic
- **Admin & Analytics:** Billing dashboard, DAO plan management, referral system

### Frontend
- **React 18 + TypeScript:** SPA dashboard for DAOs, vaults, payments, analytics, user management
- **Vite:** Fast development and optimized builds
- **Wouter:** Lightweight client-side routing
- **TanStack Query:** Server state management
- **Tailwind CSS + Shadcn/ui + Radix UI:** Modern, accessible UI components
- **Custom Dashboard:** DAO analytics, proposal leaderboard, vault disbursement alerts
- **Branding:** Orange theme (#FF7F3F) with dark/light mode support. Mtaa DAO logos in `attached_assets/mtaa_dao_logos/` used consistently across navigation and favicon

### User & Community Features
- **Authentication:** OAuth, session storage in PostgreSQL
- **User Profiles:** Roles, referrals, contribution stats
- **DAO Membership:** Invite codes, role management, voting eligibility
- **Personal Vaults:** Individual finance, deposits, withdrawals, budgeting
- **Community Vaults:** DAO treasury, proposals, disbursements

### DevOps & Tooling
- **Hardhat:** Contract compilation, testing, deployment
- **Drizzle Kit:** Database migrations
- **TypeScript:** Strict type safety across backend and frontend
- **.env:** Environment configuration for API keys, DB, blockchain
- **Prometheus:** Monitoring and metrics

## Data Flow
1. **User Authentication:** OAuth, session storage in PostgreSQL
2. **API Requests:** Frontend to Express backend
3. **Database Operations:** Drizzle ORM to Neon/PostgreSQL
4. **Blockchain Events:** Ethers.js for contract events and automation
5. **Payments:** API routes for Mpesa, Stripe, and crypto
6. **State Management:** TanStack Query for client cache and sync
7. **Automation:** NAV updates, fee collection, event indexing

## Quick Start
- `npm install` — Install all dependencies
- `npx hardhat compile` — Compile smart contracts
- `npm run migrate` — Run database migrations
- `npm run dev` — Start frontend (Vite)
- `npm run start` — Start backend (Express)

## Folder Structure
- `contracts/` — Smart contracts (MaonoVault.sol, DAO contracts, deployment scripts)
- `server/` — Express backend, blockchain integration, payments, automation
- `client/` — React frontend, UI components, hooks, analytics
- `shared/` — TypeScript types, schemas, utilities
- `infra/` — Prometheus, monitoring configs
- `migrations/` — SQL and Drizzle migrations

## Environment Setup
- See `.env.example` for required variables
- Configure DB, blockchain, payment provider keys

## Documentation
- `contracts/README.md` — Smart contract usage
- `server/README.md` — Backend/API docs
- `server/blockchain.md` — Blockchain integration
- `server/vault_automation.md` — Automation/indexing

---

For full technical docs, see the respective folders and READMEs.