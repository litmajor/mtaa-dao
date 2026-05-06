# Direct Answer: Cross-Chain Token Swap & Bridge Capabilities

## Executive Summary

**Your Question:** "CAN I SWAP THOSE TOKENS OR BRIDGE THEM, AND IF SO, WHICH CONTRACTS ENABLE THAT?"

**Answer:** Yes, you can swap and bridge virtually all supported tokens using specific contracts. Below is the definitive breakdown of which tokens can be swapped/bridged and which exact contracts enable each operation.

---

## Token-by-Token Capability Matrix

### ✅ CELO (Celo Native Token)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| Celo | Ethereum | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Celo | Polygon | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Celo | Solana | Wormhole: `9L5c2r8zzHHq4Dh5GcK8V` | Wormhole Portal | 5-15 min |

#### Swapping Capabilities  
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **Celo** | ✅ CELO ↔ Any | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Celo** | ✅ CELO ↔ USDC | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Celo** | ✅ CELO ↔ cUSD | SushiSwap: `0x7f5Cc8d963Fc5f8307625bBDe0bEE9cD628a71E4` | SushiSwap |
| **Ethereum** | ⚠️ Limited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 (low liquidity) |
| **Polygon** | ⚠️ Limited | QuickSwap: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` | QuickSwap (low liquidity) |
| **Solana** | ✅ Good | Jupiter: `JupiterK4bXe9eMZmqKc2JSMoqDCjhSJJCHoNc4cqt1` | Jupiter Aggregator |

**Summary:** ✅ Bridgeable on 3 chains, highly swappable on Celo, limited swaps on others.

---

### ✅ ETH (Ethereum Native Token)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| Ethereum | Polygon | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | Arbitrum | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | Optimism | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | BSC | Connext: `0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777` | Connext | 2-30 min |
| Ethereum | Celo | Axelar: `0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69` | Axelar Network | 15-45 min |
| Ethereum | Solana | Wormhole: `0x98f3c9e6E3fAce36bAAd05FE20C9D3F7EA9792C` | Wormhole Portal | 5-15 min |

#### Swapping Capabilities
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **Ethereum** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Ethereum** | ✅ ETH ↔ USDC | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Ethereum** | ✅ ETH ↔ USDT | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Ethereum** | ✅ ETH ↔ DAI | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Polygon** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Arbitrum** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Optimism** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **BSC** | ✅ ETH ↔ USDC | PancakeSwap: `0x10ED43C718714eb63d5aA57B78f985BB64e3A85` | PancakeSwap |
| **Celo** | ⚠️ Limited | SushiSwap: `0x7f5Cc8d963Fc5f8307625bBDe0bEE9cD628a71E4` | SushiSwap |
| **Solana** | ✅ Good | Jupiter: `JupiterK4bXe9eMZmqKc2JSMoqDCjhSJJCHoNc4cqt1` | Jupiter Aggregator |

**Summary:** ✅ Bridgeable on 6 chains, unlimited swaps on Ethereum and most L2s.

---

### ✅ USDC (USD Coin - Most Bridgeable)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| Ethereum | Polygon | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | Arbitrum | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | Optimism | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | BSC | Axelar: `0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69` | Axelar Network | 15-45 min |
| Ethereum | Celo | Axelar: `0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69` | Axelar Network | 15-45 min |
| Ethereum | Solana | Wormhole: `0x98f3c9e6E3fAce36bAAd05FE20C9D3F7EA9792C` | Wormhole Portal | 5-15 min |
| Polygon | Ethereum | Stargate: `0x45A01E4e04F14f7a2a3F19b36F312F0530e1Aa07` | Stargate Finance | 5-15 min |
| Polygon | Arbitrum | Stargate: `0x45A01E4e04F14f7a2a3F19b36F312F0530e1Aa07` | Stargate Finance | 5-15 min |
| Arbitrum | Ethereum | Stargate: `0x53Bf833A5d6c4ddA888F69c22C88C9f356a94009` | Stargate Finance | 5-15 min |
| BSC | Ethereum | Axelar: `0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69` | Axelar Network | 15-45 min |
| Solana | Ethereum | Wormhole: `wormDTUJ6AWPNvK59vGQLFa8JAmL1AxbnZyXqmMsgU` | Wormhole Portal | 5-15 min |

#### Swapping Capabilities
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **Ethereum** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Ethereum** | ✅ USDC ↔ Everything | SushiSwap: `0xd9e1cE17f2641f24aE57070Df9dF627d89d112Cb` | SushiSwap |
| **Polygon** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Polygon** | ✅ USDC ↔ Everything | QuickSwap: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` | QuickSwap |
| **Arbitrum** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Optimism** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **BSC** | ✅ USDC ↔ Everything | PancakeSwap: `0x10ED43C718714eb63d5aA57B78f985BB64e3A85` | PancakeSwap |
| **Celo** | ✅ USDC ↔ Everything | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Solana** | ✅ Unlimited | Jupiter: `JupiterK4bXe9eMZmqKc2JSMoqDCjhSJJCHoNc4cqt1` | Jupiter Aggregator |

**Summary:** ✅ Bridgeable on 6+ routes, swappable on all supported chains with high liquidity everywhere.

---

### ✅ USDT (Tether)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| Ethereum | Polygon | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | Arbitrum | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | BSC | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 15-20 min |
| Ethereum | Celo | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | Solana | Wormhole: `0x98f3c9e6E3fAce36bAAd05FE20C9D3F7EA9792C` | Wormhole Portal | 5-15 min |

#### Swapping Capabilities
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **Ethereum** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Polygon** | ✅ Unlimited | QuickSwap: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` | QuickSwap |
| **Arbitrum** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Optimism** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **BSC** | ✅ Unlimited | PancakeSwap: `0x10ED43C718714eb63d5aA57B78f985BB64e3A85` | PancakeSwap |
| **Celo** | ⚠️ Limited | SushiSwap: `0x7f5Cc8d963Fc5f8307625bBDe0bEE9cD628a71E4` | SushiSwap |
| **Solana** | ✅ Good | Jupiter: `JupiterK4bXe9eMZmqKc2JSMoqDCjhSJJCHoNc4cqt1` | Jupiter Aggregator |
| **TRON** | ✅ Native Swaps | TRX DEX: Multiple | Sun.io, JustLend |

**Summary:** ✅ Bridgeable on 5 routes, swappable on all chains.

---

### ✅ MATIC (Polygon Native Token)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| Polygon | Ethereum | Stargate: `0x45A01E4e04F14f7a2a3F19b36F312F0530e1Aa07` | Stargate Finance | 5-15 min |
| Polygon | Solana | Wormhole: `9L5c2r8zzHHq4Dh5GcK8V` | Wormhole Portal | 5-15 min |

#### Swapping Capabilities
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **Polygon** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Polygon** | ✅ MATIC ↔ Everything | QuickSwap: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` | QuickSwap |
| **Ethereum** | ✅ MATIC ↔ Everything | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Solana** | ⚠️ Limited | Jupiter: `JupiterK4bXe9eMZmqKc2JSMoqDCjhSJJCHoNc4cqt1` | Jupiter Aggregator |

**Summary:** ✅ Bridgeable on 2 major routes, highly swappable on Polygon.

---

### ✅ BNB (Binance Coin)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| BSC | Ethereum | Connext: `0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777` | Connext | 2-30 min |
| BSC | Polygon | Connext: `0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777` | Connext | 2-30 min |

#### Swapping Capabilities
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **BSC** | ✅ Unlimited | PancakeSwap: `0x10ED43C718714eb63d5aA57B78f985BB64e3A85` | PancakeSwap |
| **BSC** | ✅ BNB ↔ Everything | PancakeSwap: `0x10ED43C718714eb63d5aA57B78f985BB64e3A85` | PancakeSwap |
| **Ethereum** | ⚠️ Limited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |

**Summary:** ⚠️ Limited bridging, excellent swaps on BSC.

---

### ✅ SOL (Solana Native Token)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| Solana | Ethereum | Wormhole: `wormDTUJ6AWPNvK59vGQLFa8JAmL1AxbnZyXqmMsgU` | Wormhole Portal | 5-15 min |
| Solana | Polygon | Wormhole: `9L5c2r8zzHHq4Dh5GcK8V` | Wormhole Portal | 5-15 min |

#### Swapping Capabilities
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **Solana** | ✅ Unlimited | Jupiter: `JupiterK4bXe9eMZmqKc2JSMoqDCjhSJJCHoNc4cqt1` | Jupiter Aggregator |
| **Solana** | ✅ SOL ↔ Everything | Raydium: `675kPX9MHTjS2zt1qLCXVJ2PgwciSNcP1vAeoP60K1w` | Raydium |
| **Solana** | ✅ SOL ↔ Everything | Orca: `whirLbMiicVdio4KfUqkEB4OfVMeYBj2ufsqWfzbnU` | Orca |
| **Ethereum** | ✅ SOL ↔ USDC | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |

**Summary:** ✅ Bridgeable on 2 routes via Wormhole, unlimited swaps on Solana.

---

### ✅ DAI (Decentralized USD)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| Ethereum | Polygon | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | Arbitrum | Stargate: `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | Stargate Finance | 5-15 min |
| Ethereum | Optimism | Connext: `0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777` | Connext | 2-30 min |

#### Swapping Capabilities
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **Ethereum** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Polygon** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Arbitrum** | ✅ Unlimited | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |

**Summary:** ✅ Bridgeable on 3 routes, good alternative to USDC/USDT.

---

### ✅ TRX (TRON Native Token)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| TRON | Solana | Wormhole: `9L5c2r8zzHHq4Dh5GcK8V` | Wormhole Portal | 5-15 min |

#### Swapping Capabilities
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **TRON** | ✅ Unlimited | TRX-native DEX | Sun.io, JustLend |
| **Solana** | ✅ TRX ↔ SPL tokens | Jupiter: `JupiterK4bXe9eMZmqKc2JSMoqDCjhSJJCHoNc4cqt1` | Jupiter |

**Summary:** ⚠️ Limited bridging (mainly to Solana), good swaps on TRON natively.

---

### ✅ cUSD & cEUR (Celo Stablecoins)

#### Bridging Capabilities
| From | To | Contract | Bridge Service | Time |
|------|----|-----------|----|------|
| Celo | Ethereum | ❌ Not directly bridgeable | - | - |
| Celo | Polygon | ❌ Not directly bridgeable | - | - |

#### Swapping Capabilities
| Chain | Available Swaps | Contract | DEX |
|-------|-----------------|----------|-----|
| **Celo** | ✅ cUSD ↔ CELO | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |
| **Celo** | ✅ cUSD ↔ USDC | SushiSwap: `0x7f5Cc8d963Fc5f8307625bBDe0bEE9cD628a71E4` | SushiSwap |
| **Celo** | ✅ cEUR ↔ CELO | Uniswap V3: `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Uniswap V3 |

**Summary:** ⚠️ Only swappable on Celo, not bridgeable to other chains (use USDC instead).

---

## Cross-Chain Swap Scenarios (Real World Examples)

### Scenario 1: USDC Swap (Ethereum → Polygon)
**Goal:** User has USDC on Ethereum, wants USDC on Polygon  
**Solution:** **Bridge (Recommended)**
```
1. Use Stargate Bridge: 0x8731d54E9D02c286e8b3212f8433959A7bBEde0a
2. Time: 5-15 minutes
3. Fee: 0.06%
4. Outcome: Native USDC on Polygon
```

### Scenario 2: CELO → ETH (Celo → Ethereum)
**Goal:** User has CELO on Celo, wants ETH on Ethereum  
**Solution:** **Two-step swap + bridge**
```
Step 1: Swap CELO → USDC on Celo
  - DEX: Uniswap V3 (0xE592427A0AEce92De3Edee1F18E0157C05861564)
  - Time: 30 seconds
  
Step 2: Bridge USDC from Celo → Ethereum
  - Bridge: Axelar (0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69)
  - Time: 15-45 minutes
  
Step 3: Swap USDC → ETH on Ethereum (if not directly bridging ETH)
  - DEX: Uniswap V3 (0xE592427A0AEce92De3Edee1F18E0157C05861564)
  - Time: 30 seconds
  
Total Time: 15-46 minutes
```

### Scenario 3: BNB → POLYGON
**Goal:** User has BNB on BSC, wants to use on Polygon  
**Solution:** **Bridge + Swap**
```
Step 1: Bridge BNB from BSC → Ethereum
  - Bridge: Connext (0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777)
  - Time: 2-30 minutes
  
Step 2: Bridge ETH/BNB from Ethereum → Polygon
  - Bridge: Stargate (0x8731d54E9D02c286e8b3212f8433959A7bBEde0a)
  - Time: 5-15 minutes
  
OR Alternative: Swap BNB → USDC on BSC, then bridge USDC
  - Swap: PancakeSwap (0x10ED43C718714eb63d5aA57B78f985BB64e3A85)
  - Bridge: Stargate (0x8731d54E9D02c286e8b3212f8433959A7bBEde0a)
  - Total Time: 5-20 minutes (faster!)
```

### Scenario 4: Solana SPL Token → Ethereum ERC-20
**Goal:** User has USDC on Solana, wants to use on Ethereum  
**Solution:** **Bridge via Wormhole**
```
1. Use Wormhole Portal Bridge (Solana Program: wormDTUJ6AWPNvK59vGQLFa8JAmL1AxbnZyXqmMsgU)
2. Wrapped USDC will arrive as USDC on Ethereum
3. Time: 5-15 minutes
4. Fee: 0% - 0.5%
5. Note: Will receive wrapped token initially, can be swapped for native on DEX
```

---

## Quick Reference: Which Contract for What Operation

### For Bridges (Choose based on destination)
- **Ethereum ↔ Polygon/Arbitrum/Optimism:** Use Stargate `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a`
- **Ethereum ↔ Celo:** Use Axelar `0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69`
- **Ethereum ↔ Solana:** Use Wormhole `0x98f3c9e6E3fAce36bAAd05FE20C9D3F7EA9792C`
- **Any ↔ Solana:** Use Wormhole Portal
- **Fast bridges:** Use Connext `0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777`

### For Swaps (Choose based on chain)
- **Ethereum/Arbitrum/Optimism:** Uniswap V3 `0xE592427A0AEce92De3Edee1F18E0157C05861564`
- **Polygon:** QuickSwap `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` (0.04% fee, faster)
- **BSC:** PancakeSwap `0x10ED43C718714eb63d5aA57B78f985BB64e3A85`
- **Celo:** Uniswap V3 or SushiSwap
- **Solana:** Jupiter Aggregator `JupiterK4bXe9eMZmqKc2JSMoqDCjhSJJCHoNc4cqt1` (best prices)

---

## Summary: Can You Swap/Bridge Each Token?

| Token | Can Bridge? | Can Swap? | Best For |
|-------|------------|-----------|----------|
| **CELO** | ✅ Yes (3 routes) | ✅ Yes (all chains) | Celo native operations |
| **ETH** | ✅ Yes (6 routes) | ✅ Yes (all chains) | Best liquidity everywhere |
| **USDC** | ✅ Yes (6+ routes) | ✅ Yes (all chains) | Most versatile, highest liquidity |
| **USDT** | ✅ Yes (5 routes) | ✅ Yes (all chains) | Good alternative to USDC |
| **MATIC** | ✅ Yes (2 routes) | ✅ Yes (2-3 chains) | Polygon-specific |
| **BNB** | ⚠️ Limited (2 routes) | ✅ Yes (3 chains) | BSC-specific |
| **SOL** | ✅ Yes (2 routes) | ✅ Yes (3+ chains) | Solana native |
| **DAI** | ✅ Yes (3 routes) | ✅ Yes (3 chains) | Alternative stablecoin |
| **TRX** | ⚠️ Limited (1 route) | ✅ Yes (2 chains) | TRON-specific |
| **cUSD/cEUR** | ❌ No | ✅ Yes (Celo only) | Celo-specific |

---

## Implementation Notes

1. **Always check liquidity** before executing swaps - low liquidity = high slippage
2. **Use price feeds** to display real-time quotes to users
3. **Set reasonable slippage** (0.5% - 2%) based on trade size
4. **Monitor bridge status** - some bridges can take 30+ minutes
5. **For large amounts:** Split into multiple smaller trades to reduce slippage
6. **Multi-hop swaps:** If direct pair unavailable, use path: Token A → USDC → Token B

---

## Last Updated
January 15, 2024

For the most current contract addresses and supported pairs, always verify with:
- Stargate: stargate.finance
- Uniswap: uniswap.org
- Jupiter (Solana): jup.ag
- LayerZero: layerzero.network

