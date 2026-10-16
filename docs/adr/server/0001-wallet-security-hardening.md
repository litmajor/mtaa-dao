# ADR 0001: Harden wallet registration, encryption, and recovery verification

- Status: Accepted (supersedes the original server-generated wallet decision)
- Date: 2026-07-11

## Context
The wallet flow previously exposed security and reliability gaps:

- Sensitive wallet material could be encrypted with a fallback secret instead of a caller-provided secret.
- Server-generated mnemonics and private-key import exposed key material to the backend and created unnecessary custodial risk.
- In-memory challenge storage was not shared across application instances and could not provide reliable multi-instance replay protection.
- Wallet registration needed database-enforced uniqueness and a safe, client-generated-key path.

## Decision
We use a non-custodial registration model:

1. **Encrypt wallet secrets explicitly.**
   - Wallet mnemonics and private keys use AES-256-GCM with a PBKDF2-derived key.
   - Encryption uses the caller-provided master secret; decryption requires the same secret.

2. **Generate wallet keys on the client and register only the public address.**
   - The client requests an authenticated registration challenge, signs its exact message locally, and submits the address, challenge ID, and signature.
   - The server verifies the EIP-191 signature and persists the wallet and public-key metadata without receiving a mnemonic or private key.
   - Server mnemonic generation and raw private-key import API routes fail closed with `501`; `ALLOW_SERVER_WALLET_MNEMONIC` defaults off in production.
   - Signup does not create a server-side wallet. Client-side generation is the supported default.

3. **Store registration challenges in Redis.**
   - Challenges are random, short-lived, bound to the authenticated user and normalized address, and stored under the security-sensitive `otp:` key prefix.
   - A Redis single-use marker prevents concurrent or replayed consumption across application instances.
   - Invalid, expired, or consumed challenges must be replaced by requesting a new challenge.

4. **Enforce wallet uniqueness in the database.**
   - Migration 048 adds the optional wallet label, case-insensitive address uniqueness, and uniqueness for active `(user_id, currency, wallet_type)` tuples.
   - The migration fails on existing duplicates instead of silently deleting or merging wallet records.
   - Wallet lookup and updates use case-insensitive address matching and transactional persistence.

## Consequences
### Positive
- The backend does not need to receive newly generated mnemonics or imported private keys.
- Challenge validation and replay protection work across application instances when Redis is configured.
- Database constraints prevent duplicate active wallets and address collisions regardless of application-level races.
- Wallet registration is authenticated and rate-limited per user.

### Trade-offs
- The client must securely back up its recovery phrase; losing it can make the wallet unrecoverable.
- Redis availability is required for registration challenges; registration must fail explicitly rather than fall back to process-local storage.
- Existing duplicate wallet data must be reconciled before migration 048 can be applied.

### Risks
- Legacy encrypted server-generated wallet records may require the prior recovery path and are not automatically converted.
- A failed or invalid signature consumes its challenge; clients must request a fresh one.
- The server mnemonic-generation helper remains a legacy service capability and must not be exposed through production API routes.

## Notes
Relevant implementation points:
- Server encryption helper: [server/utils/sensitiveDataEncryption.ts](../../../server/utils/sensitiveDataEncryption.ts)
- Wallet service and Redis-backed challenges: [server/services/wallet-generation-service.ts](../../../server/services/wallet-generation-service.ts)
- Canonical wallet routes: [server/routes/v1/wallets/core.ts](../../../server/routes/v1/wallets/core.ts)
- Legacy wallet setup routes (custodial operations fail closed): [server/routes/v1/wallets/setup.ts](../../../server/routes/v1/wallets/setup.ts)
- Wallet schema: [shared/schema.ts](../../../shared/schema.ts)
- Wallet registration migration: [server/db/migrations/048-wallet-registration-hardening.ts](../../../server/db/migrations/048-wallet-registration-hardening.ts)
- Wallet setup UI: [client/src/components/WalletSetup.tsx](../../../client/src/components/WalletSetup.tsx)
- Regression tests: [server/__tests__/wallet-security.test.ts](../../../server/__tests__/wallet-security.test.ts)
