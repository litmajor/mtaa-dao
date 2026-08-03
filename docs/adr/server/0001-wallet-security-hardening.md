# ADR 0001: Harden wallet creation, encryption, and recovery verification

- Status: Accepted
- Date: 2026-07-11

## Context
The wallet creation flow previously exposed a few security and reliability gaps:

- Sensitive wallet material such as mnemonics and private keys was encrypted with a fallback secret instead of a caller-provided secret, which made the protection weaker than intended.
- The mnemonic creation route returned placeholder recovery data instead of using the real wallet generation pipeline, which created a mismatch between the UI and backend behavior.
- Challenge-based wallet import verification used a single in-memory nonce slot per user/address combination, which could lead to ambiguous replay protection when multiple addresses were involved.
- The client-side flow relied on the server response structure being shaped a certain way, so the mnemonic modal needed to handle the payload more defensively.

These issues affected both security posture and operational correctness for wallet setup and recovery.

## Decision
We adopted a stricter wallet security model centered on the following decisions:

1. Use a dedicated encryption helper for wallet secrets.
   - Wallet mnemonics and private keys are encrypted with AES-256-GCM using a PBKDF2-derived key.
   - Encryption now uses the caller-provided master secret when available, rather than silently falling back to a default secret.
   - Decryption requires the same secret to succeed.

2. Route wallet mnemonic creation through the real wallet service.
   - The mnemonic setup endpoint now creates the wallet through the shared service layer instead of returning synthetic placeholder content.
   - The server returns the actual generated mnemonic from the wallet generation pipeline.

3. Scope challenge nonces per address/user context.
   - Nonce challenges are stored with a composite key so each address-specific verification challenge is isolated.
   - This improves replay protection and avoids accidental overwrite or confusion when multiple wallet addresses are in use.

4. Harden client-side handling of the recovery phrase payload.
   - The wallet setup UI now reads the mnemonic from the response in a safer, more defensive way before displaying it in the recovery modal.

## Consequences
### Positive
- Wallet secrets are protected by a stronger and more explicit encryption path.
- The backend and frontend wallet setup flow are now aligned around the same real wallet creation path.
- Nonce verification is more robust for multi-address wallet import scenarios.
- The recovery phrase modal is less likely to fail if the API response shape changes slightly.

### Trade-offs
- The encryption path now requires the secret to be provided consistently for successful decryption; this is stricter, but it is the correct security behavior.
- The stricter challenge handling may require clients to request a fresh challenge if they attempt to reuse an expired or already-consumed nonce.

### Risks
- If a client loses the secret used during wallet creation, the encrypted wallet material cannot be decrypted.
- Existing wallet records created before this change may not be recoverable through the new strict path unless they were encrypted with the same secret and format.

## Notes
Relevant implementation points:
- Server encryption helper: [server/utils/sensitiveDataEncryption.ts](../../server/utils/sensitiveDataEncryption.ts)
- Wallet creation service: [server/services/wallet-generation-service.ts](../../server/services/wallet-generation-service.ts)
- Wallet setup route: [server/routes/v1/wallets/setup.ts](../../server/routes/v1/wallets/setup.ts)
- Challenge nonce store: [server/utils/challengeStore.ts](../../server/utils/challengeStore.ts)
- Wallet setup UI: [client/src/components/WalletSetup.tsx](../../client/src/components/WalletSetup.tsx)
- Regression tests: [server/__tests__/wallet-security.test.ts](../../server/__tests__/wallet-security.test.ts)
