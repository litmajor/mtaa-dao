# DEX Routing Report

## Overview

This report summarizes the new DEX routing and execution flow introduced in the repository, including what the new modules do, which chains and venues they cover, how treasury routing differs from general user routing, and which files were affected by the fixes.

## What the new files do

### 1. Production execution engine
- File: [server/services/dexRoutingExecution.production.ts](server/services/dexRoutingExecution.production.ts)
- Purpose: Main production DEX router and executor.
- Responsibilities:
  - Selects routes for swaps.
  - Performs safety checks around slippage and price impact.
  - Executes trades against supported venues.
  - Supports the production execution path used by the runtime.

### 2. Compatibility routing service
- File: [server/services/dexRoutingService.ts](server/services/dexRoutingService.ts)
- Purpose: Compatibility layer for the newer routing system.
- Responsibilities:
  - Provides a stable entrypoint for quote and execution flows.
  - Routes broad-user traffic through the new execution path.
  - Enforces explicit recipient handling.
  - Fails loudly when pricing data is missing instead of silently inventing a fallback price.

### 3. Treasury routing wrapper
- File: [server/services/treasuryDexRouting.ts](server/services/treasuryDexRouting.ts)
- Purpose: Conservative treasury-only pathway.
- Responsibilities:
  - Restricts treasury swaps to safer venues.
  - Applies hard treasury caps and tighter slippage controls.
  - Keeps treasury execution separate from broad-user execution.

### 4. Legacy compatibility re-export
- File: [server/services/dexIntegrationService.ts](server/services/dexIntegrationService.ts)
- Purpose: Keeps older imports working while routing them through the new service layer.

### 5. API route entrypoints
- Files:
  - [server/routes/v1/yuki/dex.ts](server/routes/v1/yuki/dex.ts)
  - [server/routes/v1/yuki/execute.ts](server/routes/v1/yuki/execute.ts)
  - [server/routes/yuki.ts](server/routes/yuki.ts)
- Purpose: User-facing quote and execution endpoints that now call the new routing service.

### 6. Internal consumers
- Files:
  - [server/services/orderRouter.ts](server/services/orderRouter.ts)
  - [server/services/rebalancingService.ts](server/services/rebalancingService.ts)
  - [server/services/dexAssetDiscoveryService.ts](server/services/dexAssetDiscoveryService.ts)
- Purpose: These modules consume the routing layer for execution, quoting, rebalancing, or venue discovery.

## Chains and DEXes covered

### Primary Celo coverage
The main live routing work in this change set is centered on Celo.

Supported or actively emphasized venues:
- Mento
- Ubeswap

These are the key venues for the treasury-safe path and for the Celo-native routing experience.

### Broader routing surface
The production router also includes broader venue support in its architecture for other flows:
- Uniswap
- Curve
- Balancer
- Additional fallback routing support

### Practical split
- Treasury flow: restricted to Mento and Ubeswap for safety.
- General user flow: uses the broader routing shim and can access the wider production routing path.

## What is present vs what is guarded

### Present and active
- Mento: yes
- Ubeswap: yes
- Treasury-only venue restriction: yes
- Explicit recipient handling: yes
- Safety checks for price failures: yes
- Slippage and price-impact safety: yes

### Broader venues available structurally
- Uniswap: present in the production routing architecture
- Curve: present in the production routing architecture
- Balancer: present in the production routing architecture

### Important nuance
The implementation is intentionally split so that treasury operations remain conservative and limited, while general users can continue to use the broader routing layer.

## Why these modules touch the routing layer

- Route handlers touch the router because they expose quote and swap execution to API consumers.
- Order routing touches the router because swap execution must be selected and executed consistently for all flows.
- Rebalancing touches the router because portfolio rebalancing needs swap quotes and executions for asset transitions.
- Discovery services touch the router because they need to report which venues are available and how swaps may be routed.

## Registry / routing contradictions and fixes

### 1. Comment vs. actual native-symbol filtering
- Issue: The documented Celo-native symbol set claimed that bridged tokens such as USDT and USDC should be included, but the actual filtering logic only matched native, stablecoin, or MTAA categories.
- Impact: Tokens like USDT could be omitted from native-symbol sets and later route through faulty CEX lookups.
- Fix: The symbol-selection logic should be aligned with the documented intent and include the intended bridged/native Celo assets consistently.

### 2. Celo routing guardrail conflict with native rebalancing
- Issue: The routing shim enforced a strict cUSD-anchored rule for Celo swaps, which blocked native non-dollar paths such as CELO → cEUR even when the registry and strategy configuration advertised those token transitions as valid.
- Impact: Native yield-position rebalancing could fail immediately even though the token universe supported the trade.
- Fix: The Celo routing guard should be narrowed to the specific treasury-safe path or made conditional so non-treasury rebalancing can use valid native pairs without being blocked by an overly broad rule.

### 3. Missing cKES in runtime enum validation
- Issue: The runtime enum used for validation did not include cKES even though the token registry defined it as a Celo-native token.
- Impact: Payloads or form submissions containing cKES could fail validation before execution.
- Fix: Add cKES to the runtime-supported token enum so validation and execution remain consistent with the registry.

## Fixes applied to the files

### [server/services/dexRoutingExecution.production.ts](server/services/dexRoutingExecution.production.ts)
- Added execution safety handling around price impact and slippage.
- Kept the routing path aligned with the production execution engine.
- Ensured the engine is the central implementation point for route execution.

### [server/services/dexRoutingService.ts](server/services/dexRoutingService.ts)
- Removed the unsafe behavior of silently using a fake fallback price when pricing data is missing.
- Made unsupported Celo pairs fail explicitly instead of allowing a wrong swap path.
- Made the recipient address explicit rather than relying on a hidden default.
- Preserved gas-cost information in execution results.
- Ensured best-route logic uses the broader available route surface rather than a single hardcoded path.

### [server/services/treasuryDexRouting.ts](server/services/treasuryDexRouting.ts)
- Added treasury-safe caps.
- Tightened slippage handling.
- Restricted treasury execution to Mento and Ubeswap.

### [server/services/dexIntegrationService.ts](server/services/dexIntegrationService.ts)
- Replaced the legacy implementation with a compatibility shim so calls continue to work.

### [server/services/rebalancingService.ts](server/services/rebalancingService.ts)
- Fixed a nullability issue around the rebalance threshold so the service compiles cleanly.

## Summary

The new DEX routing structure now separates two concerns clearly:

1. Treasury operations
   - Conservative
   - Mento/Ubeswap only
   - Strong caps and tighter slippage controls

2. General user operations
   - Broader routing support
   - Production execution path
   - Explicit safety checks and clearer failure behavior
