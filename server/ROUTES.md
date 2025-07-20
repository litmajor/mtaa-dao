# API Endpoints Reference

## MaonoVault On-Chain
- `GET /api/maonovault/nav` — Get current NAV
- `POST /api/maonovault/deposit` — Deposit to vault
- `POST /api/maonovault/withdraw` — Withdraw from vault
- `POST /api/maonovault/nav` — Update NAV (manager only)
- `POST /api/maonovault/fee` — Distribute performance fee (manager only)

## User/DAO/Vault
- `GET /api/user/profile`, `PUT /api/user/profile`, ...
- `GET /api/dao/:daoId/membership/status`, ...
- `GET /api/vaults`, `POST /api/vaults`, ...

## Automation
- See `vault_automation.md` for scripts

---
See `server/README.md` for more details.
