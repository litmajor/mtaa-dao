# Threat model

## Actors

| Actor | Capability | Trusted? |
|---|---|---|
| Unprivileged depositor / attacker | any ERC-4626 call, direct token transfers to the vault, share transfers, contract callbacks, flash loans | No |
| Vault owner (`MaonoVault_Phase1B`) | all `onlyOwner` setters, `pause`/`unpause`, upkeep, reactivation | Partially — assumed honest-but-fallible; loss of the key must not be unbounded |
| Manager/owner (artifact vault) | `updateNAV`, all setters, `emergencyWithdraw` | Fully trusted by the current code — this is itself a finding |
| Factory | selects the asset, creates and initializes clones | Trusted |
| MTAA token | `balanceOf`, `transferFrom`, `burn` | Trusted (protocol-owned) |
| Underlying asset | full ERC-20 semantics | Trusted-by-selection: the factory/owner picks it, users then inherit that choice |
| Price oracle | `getPrice()` | Untrusted, bounded and `try/catch`-wrapped |

## Assets at risk
1. Depositor principal held as the underlying ERC-20.
2. The share/asset exchange rate (i.e. every depositor's claim).
3. Protocol revenue (MTAA upkeep burn + treasury split).
4. Availability of exits (pause / hibernation / stuck withdrawal requests).
5. Reported NAV shown to users by the backend.

## Attacker goals, in priority order
1. **Extract value**: end with more underlying than they started with.
2. **Cause protocol accounting != economic reality**: make `totalAssets` /
   `totalSupply` / `preview*` describe a state that does not match the tokens
   actually held, then monetise the gap.
3. **Impose loss on others without profit** (griefing / DoS).
4. **Reduce protocol revenue** without paying for it.

## Entry points reachable by an unprivileged attacker
- `deposit` / `mint` / `withdraw` / `redeem` in any order, sizes and repetition.
- Direct `transfer` of the underlying into the vault (donation) — cannot be
  prevented.
- Share ERC-20 transfers/approvals (not pausable).
- Being the first depositor.
- Supplying a callback contract as `receiver` or `owner`.
- On the artifact vault: creating withdrawal requests, calling
  `fulfillWithdrawal`.

## Explicitly out of scope for "unprivileged" findings
- A malicious underlying asset. The factory/owner chooses the asset; a hostile
  token is a governance failure, not an attacker capability. Non-standard but
  *plausible* assets (fee-on-transfer, rebasing, no-return-value) **are** in
  scope because they can be listed by an honest owner.
- Compromise of the owner key. Impact of such a compromise is quantified
  (H-1, M-3) but reachability is privileged.

## Trust-boundary conclusions from experiment
- Share pricing depends only on the vault's real token balance; no oracle,
  NAV, or admin input can reprice shares in either contract.
- The reentrancy guard covers all four ERC-4626 entry points and both upkeep
  functions; ERC-777-style callbacks cannot re-enter.
- The dangerous privileges are concentrated in single EOAs: the Phase 1B owner
  (availability) and the artifact vault's manager/owner (full principal).
