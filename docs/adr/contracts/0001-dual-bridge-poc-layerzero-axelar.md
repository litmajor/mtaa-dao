# ADR 0001: Dual-Bridge PoC — LayerZero OFT + Axelar ITS

**Date**: 2026-07-08  
**Status**: Accepted

## Context

MtaaDAO needs cross-chain bridging to:
1. Enable Yuki's arbitrage scanning to act on cross-exchange opportunities (CEXs on Ethereum/BSC/Polygon settle separately from Celo).
2. Support user deposits from other chains (USDC/USDT on Ethereum → Celo).
3. Diversify treasury across chains rather than 100% Celo custody.

Four protocols are available: LayerZero, Axelar, Wormhole, Stargate. Each has trade-offs in verification surface, complexity, and suitability for Celo.

## Decision

**Implement a two-bridge PoC:**

### Bridge 1: Axelar ITS (for cUSD)
- **Why**: Existing tokens (cUSD, USDC) benefit from Axelar's Interchain Token Service (ITS) — a factory pattern where Axelar deploys and manages the cross-chain wrapper, eliminating custom adapter contracts.
- **Effort**: Days (integration + testing only; no Solidity to write).
- **Scope**: cUSD → Ethereum/Polygon as a starting point (pick 1 target chain first).
- **Flow**: 
  - One-time: `InterchainTokenFactory.registerCanonicalInterchainToken(cUSD)` → Axelar deploys wrappers on each target chain.
  - Per-transfer: `InterchainTokenService.interchainTransfer(...)` + pay gas via `AxelarGasService`.

### Bridge 2: LayerZero OFT Adapter (for cUSD, scalable to MTAA)
- **Why**: LayerZero's burn-and-mint model (native OFT) has zero custody risk and clean token logic.
- **Effort**: 1–2 days (small, standard OFT adapter contract deployment + peer wiring).
- **Scope**: Same single route (cUSD Celo → target chain).
- **Flow**:
  - Deploy `OFTAdapter.sol` (LayerZero reference, wraps existing cUSD) on both chains.
  - Wire peers: `adapter.setPeer(remoteChainId, remotePeerAddress)`.
  - Register with `CrossChainBridge.sol` router via `setTokenAdapter()` + `mapToken()`.
  - Per-transfer: `CrossChainBridge.bridgeAssets(cUSD, amount, destEid, recipient, ...)`.

**Why not the others:**
- **Wormhole**: Requires token-bridge attestation flow; Celo attestation unverified.
- **Stargate**: Liquidity-pool model; Celo pool address verified but chain-ID mapping missing; unnecessary complexity for a PoC with unproven liquidity.

**Why these two:**
- Smallest unverified surface area.
- Axelar ITS eliminates adapter deployment risk for cUSD.
- LayerZero OFT scales cleanly to MTAA (deploy MTAA natively as OFT from day one, not as ERC20 + retrofit).
- Can run in parallel (no dependency between them).

## Consequences

### Positive
- **Production-ready patterns**: Both are live, audited, used by major protocols.
- **Scalability**: LayerZero OFT path becomes the canonical MTAA model once MTAA token exists.
- **Lower risk**: Axelar ITS outsources wrapper management; LayerZero reference adapters are standard.
- **Testing ground**: Single route (Celo → 1 target) limits blast radius; success unblocks expansion.

### Risks & Follow-ups
1. **Status checking is a live gap**: Current `checkStatus()` in `bridgeIntegration.ts` infers completion from source confirmations. Must replace with:
   - Axelar: Query GMP API for relayer status.
   - LayerZero: Poll LayerZero Scan for VAA finality.
2. **Deployment addresses must be added manually**: `ROUTER_DEPLOYMENTS` and `AXELAR_ITS_ADDRESS` require environment variables or config updates after contracts go live.
3. **Target chain choice must be made first**: LayerZero endpoint IDs and Axelar chain names vary; pick Ethereum, Polygon, or Arbitrum first and verify before deploying.

## Notes

**Related files:**
- [server/services/bridgeIntegration.ts](../../../server/services/bridgeIntegration.ts) — Unified bridge interface; LayerZero path now wired to `CrossChainBridge.sol` router.
- [server/services/laterZeroRouterBridge.ts](../../../server/services/laterZeroRouterBridge.ts) — LayerZero V2 router implementation; calls real `bridgeAssets()` instead of throwing.
- [contracts/CrossChainBridge.sol](../../../contracts/CrossChainBridge.sol) — OFT adapter lockbox pattern; separates underlying token from bridge contract.
- [contracts/deploy-crosschain-bridge.ts](../../../contracts/deploy-crosschain-bridge.ts) — Deployment script for router + OFTAdapter per chain.

**Next steps (in order):**
1. Choose target chain (Ethereum recommended for Yuki's CEX integrations).
2. Confirm Celo cUSD address and LayerZero endpoint on CeloScan / docs.layerzero.network.
3. Deploy `CrossChainBridge.sol` to Celo and target chain.
4. Deploy `OFTAdapter` (cUSD) to Celo and target chain.
5. Wire peers and register token with router.
6. Test single Celo → target transfer end-to-end (including real `checkStatus()` polling).
7. Parallel track: Register cUSD with Axelar ITS factory.
8. Once LayerZero route is live and tested, wire Axelar route and test both simultaneously.
