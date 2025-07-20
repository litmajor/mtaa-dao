# Backend/API Docs

## Overview
- Express server for MtaaDAO vault platform
- REST API for vault, user, DAO, and analytics
- Blockchain integration via ethers.js

## Key Endpoints
- `/api/maonovault/*` — On-chain vault actions (deposit, withdraw, nav, fee)
- `/api/user/*`, `/api/dao/*`, `/api/vaults/*` — User/DAO/vault management

## Blockchain Integration
- See `blockchain.md` for contract wiring

## Automation
- See `vault_automation.md` for NAV/fee automation and event indexing

## Running
- `npm install`
- `npm run dev` or `npm start`
- Configure `.env` for keys, RPC, contract addresses

---
See main project README for more.
