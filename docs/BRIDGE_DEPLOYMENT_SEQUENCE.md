# Bridge Deployment Sequence — LayerZero OFT + Axelar ITS PoC

**Goal**: Enable cUSD bridging between Celo and a target chain (recommend Ethereum) via two independent protocols.

**Effort**: ~3–4 days (deployment + testing + monitoring).

---

## Pre-Deployment Checklist

- [ ] **Network & RPC Setup**
  - [ ] Set `CELO_RPC_URL` (default: https://forno.celo.org)
  - [ ] Set `ETH_RPC_URL` (or target chain RPC)
  - [ ] Set `STRATEGY_EXECUTOR_PRIVATE_KEY` (deployer account with native gas on both chains)
  - [ ] Fund deployer with ≥ 1 CELO + 0.5 ETH (estimate for deployments + peer wiring)

- [ ] **Verify Contract Addresses**
  - [ ] Confirm cUSD address on Celo: `0x765DE816845861e75A25fCA122bb6898B8B1282` (CeloScan)
  - [ ] Confirm LayerZero Endpoint V2 on Celo: `0x1a44076050125825900e736c501f859c50fe728c` (docs.layerzero.network)
  - [ ] Confirm Axelar ITS on Celo: `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` (docs.axelar.dev)

- [ ] **Package Dependencies**
  - [ ] `npm ls @layerzerolabs/oft-evm` (ensure package exists in node_modules)
  - [ ] `npm ls ethers@v6` (LayerZero OFT adapters target ethers v6)

---

## Phase 1: LayerZero OFT Bridge Deployment

### Step 1a: Deploy CrossChainBridge Router on Celo

```bash
npx hardhat run contracts/deploy-crosschain-bridge.ts --network celo
```

**Expected output**: JSON saved to `deployments/crosschain/celo.json`
```json
{
  "network": "celo",
  "crossChainBridge": "0x...",
  "cusdOFTAdapter": "0x...",
  "cusdToken": "0x765DE816845861e75A25fCA122bb6898B8B1282",
  "deployedAt": "2026-07-08T..."
}
```

### Step 1b: Deploy CrossChainBridge Router on Target Chain (Ethereum)

```bash
npx hardhat run contracts/deploy-crosschain-bridge.ts --network ethereum
```

**Expected output**: JSON saved to `deployments/crosschain/ethereum.json`

### Step 1c: Wire Peers & Register Token Mappings

Run from Celo (script handles both chains):

```bash
npx hardhat run contracts/wire-peers-and-register.ts --network celo
```

**Expected output**:
```
[wire] Setting source adapter (...) peer to target (...) on endpoint 30101
[wire] Source peer wiring confirmed: 0x...
[wire] Setting target adapter (...) peer back to source (...) on endpoint 30125
[wire] Target peer wiring confirmed: 0x...
[wire] ✅ Dual-chain peer wiring complete!
```

### Step 1d: Update Configuration

Edit [server/services/laterZeroRouterBridge.ts](../../server/services/laterZeroRouterBridge.ts):

```typescript
const ROUTER_DEPLOYMENTS: Record<string, string> = {
  celo: '0x...',        // from celo.json
  ethereum: '0x...',    // from ethereum.json
};
```

### Step 1e: Test Single Transfer (LayerZero Path)

Create a test script (or use Hardhat console):

```bash
npx hardhat console --network celo
```

```typescript
const BridgeIntegration = await ethers.getContractFactory('CrossChainBridge');
const bridge = BridgeIntegration.attach('0x...');

// Quote cUSD transfer (1000 cUSD = 1000e18 base units)
const quote = await bridge.quoteBridge(
  '0x765DE816845861e75A25fCA122bb6898B8B1282', // cUSD
  ethers.parseEther('1000'),
  30101, // Ethereum endpoint ID
  '0x1234...', // recipient on Ethereum
  0,
  '0x' // lzOptions (can be empty for PoC)
);

console.log('Quote nativeFee:', quote[0].toString());

// Initiate transfer (will fail if adapter not set; expected at this stage)
```

---

## Phase 2: Axelar ITS Registration (Parallel Track)

### Step 2a: Register cUSD as Canonical Token

```bash
npx hardhat run contracts/register-cusd-axelar-its.ts --network celo
```

**Expected output**:
```
[axelar-its] Registering canonical token (0x765DE816...)
[axelar-its] ✅ Canonical registration confirmed: 0x...
[axelar-its] Deploying cUSD wrapper on Ethereum...
[axelar-its] Gas payment confirmed for Ethereum: 0x...
[axelar-its] ✅ Remote wrapper deployment initiated on Ethereum: 0x...
```

### Step 2b: Wait for Remote Wrapper Deployment

Monitor Axelar explorer (typically 5–30 min per chain):

```
https://testnet.axelarscan.io/
https://mainnet.axelarscan.io/
```

Once deployed, Axelar will report the wrapped cUSD address on the target chain.

---

## Phase 3: Validation & Live Testing

### Step 3a: Verify Both Bridges Are Live

Update [server/services/bridgeIntegration.ts](../../server/services/bridgeIntegration.ts):

Confirm `getExecutableProtocols()` returns `['layerzero']` (Axelar path not yet implemented in bridgeIntegration; will be added after LayerZero validation).

```typescript
const executable = bridgeIntegration.getExecutableProtocols('cUSD', 'celo', 'ethereum');
console.log(executable); // Should log ['layerzero']
```

### Step 3b: Run End-to-End Transfer

Via `bridgeIntegration.initiateTransfer()`:

```typescript
const result = await bridgeIntegration.initiateTransfer({
  protocol: 'layerzero',
  fromChain: 'celo',
  toChain: 'ethereum',
  tokenSymbol: 'cUSD',
  amount: 100, // 100 cUSD
  recipientAddress: '0x...',
});

console.log('Transfer ID:', result.transferId);
console.log('Estimated fee:', result.estimatedFeeUsd);
```

### Step 3c: Poll Transfer Status

```typescript
const status = await bridgeIntegration.getTransferStatus(result.transferId);
console.log('Status:', status.status); // pending, bridging, awaiting_vaa, completed, failed
```

**Expected timeline**:
- **0–30 sec**: `pending` → `bridging` (transaction confirmed on Celo)
- **30–300 sec**: `awaiting_vaa` (LayerZero relayers executing on Ethereum)
- **300+ sec**: `completed` or `failed`

### Step 3d: Verify Funds on Target Chain

Check Ethereum recipient address for wrapped cUSD (via Etherscan or SDK).

---

## Phase 4: Axelar ITS Integration (Future)

Currently, [bridgeIntegration.ts](../../server/services/bridgeIntegration.ts) throws an error for Axelar:

```typescript
throw new Error('Axelar bridge integration not yet implemented');
```

**To enable** (after LayerZero is validated):

1. Create `server/services/axelarRouterBridge.ts` with:
   - `quote()`: Call `InterchainTokenService.estimateGasFee()`
   - `bridge()`: Call `InterchainTokenService.interchainTransfer()`

2. Update `bridgeIntegration.ts`:
   ```typescript
   if (protocol === 'axelar' && this.axelarBridge) {
     return this.axelarBridge.bridge(params);
   }
   ```

3. Update `getExecutableProtocols()` to include `'axelar'` once AXELAR_ITS_ADDRESS is populated.

---

## Troubleshooting

### "Cannot find module '@layerzerolabs/oft-evm'"

```bash
npm install @layerzerolabs/oft-evm @layerzerolabs/lz-evm-oapp-v2
```

### "OFT Adapter is not set on router"

**Cause**: `setTokenAdapter()` was not called in `deploy-crosschain-bridge.ts`, or the deployment script failed.

**Fix**: Re-run `deploy-crosschain-bridge.ts` and verify `deployments/crosschain/<chain>.json` contains `cusdOFTAdapter` address.

### "No LayerZero endpoint for Ethereum"

**Cause**: `LZ_ENDPOINT_IDS` in `deploy-crosschain-bridge.ts` doesn't include Ethereum (or has wrong ID).

**Fix**: Verify against docs.layerzero.network/v2/deployments/chains/ and update the constant.

### "Transaction failed: AdapterNotSet"

**Cause**: CrossChainBridge tried to call OFTAdapter, but it wasn't registered.

**Fix**: Confirm `wire-peers-and-register.ts` completed without errors, and check that `ROUTER_DEPLOYMENTS` in `laterZeroRouterBridge.ts` has valid addresses.

### Transfer stuck in "awaiting_vaa" after 10 minutes

**Cause**: LayerZero relayers are delayed or endpoints are congested.

**Action**:
1. Wait 30 more minutes (relayers retry automatically).
2. Check LayerZero Scan: `https://layerzeroscan.com/`
3. If stuck, file issue with LayerZero support; include source txHash.

---

## Success Criteria

✅ **All phases complete when:**

1. [ ] `npx hardhat run contracts/deploy-crosschain-bridge.ts --network celo` succeeds.
2. [ ] `npx hardhat run contracts/deploy-crosschain-bridge.ts --network ethereum` succeeds.
3. [ ] `npx hardhat run contracts/wire-peers-and-register.ts --network celo` completes all peer wiring without errors.
4. [ ] Manual transfer of 100 cUSD from Celo → Ethereum via `bridgeIntegration.initiateTransfer()` goes to `completed` status.
5. [ ] Recipient account on Ethereum shows received wrapped cUSD balance.
6. [ ] `npx hardhat run contracts/register-cusd-axelar-its.ts --network celo` completes registration without errors.

---

## Next Steps

1. **Run Phase 1** (LayerZero) on testnet first (Celo testnet → Sepolia), then mainnet.
2. **Validate Phase 1** before starting Phase 2.
3. **Phase 2** (Axelar) can run in parallel with Phase 1's validation phase.
4. **Once both are live**, expand to additional chains (Polygon, Arbitrum, Optimism).
5. **Deploy MTAA** as native OFT using the same `CrossChainBridge` router pattern.

---

**Related ADR**: [docs/adr/contracts/0001-dual-bridge-poc-layerzero-axelar.md](./adr/contracts/0001-dual-bridge-poc-layerzero-axelar.md)  
**Related Code**:
- [server/services/bridgeIntegration.ts](../../server/services/bridgeIntegration.ts)
- [server/services/laterZeroRouterBridge.ts](../../server/services/laterZeroRouterBridge.ts)
- [contracts/CrossChainBridge.sol](../../contracts/CrossChainBridge.sol)
- [contracts/deploy-crosschain-bridge.ts](../../contracts/deploy-crosschain-bridge.ts)
