# Cross-Chain Database Migration & Population Guide

## Overview
This guide provides SQL scripts and instructions for populating the newly created cross-chain database tables with bridge and DEX configuration data.

---

## Table Population Order
1. **cross_chain_chains** - Define all supported chains
2. **cross_chain_dexes** - Define all DEXes per chain
3. **cross_chain_tokens** - Define all supported tokens
4. **cross_chain_trading_pairs** - Define available pairs per DEX
5. **cross_chain_bridges** - Define bridge routes between chains
6. **cross_chain_transfers** - Auto-populated by application
7. **cross_chain_swaps** - Auto-populated by application

---

## 1. Populate cross_chain_chains

```sql
-- Insert supported chains
INSERT INTO cross_chain_chains (chain_name, chain_id, chain_type, native_token, rpc_url, rpc_backup, explorer_url, is_active, is_supported, min_gas_price)
VALUES
-- EVM Chains
('ethereum', '1', 'evm', 'ETH', 'https://eth-mainnet.g.alchemy.com/v2/{API_KEY}', 'https://eth.llamarpc.com', 'https://etherscan.io', true, true, '20.000000'),
('polygon', '137', 'evm', 'MATIC', 'https://polygon-mainnet.g.alchemy.com/v2/{API_KEY}', 'https://polygon.llamarpc.com', 'https://polygonscan.com', true, true, '40.000000'),
('arbitrum', '42161', 'evm', 'ETH', 'https://arb-mainnet.g.alchemy.com/v2/{API_KEY}', 'https://arb1.arbitrum.io/rpc', 'https://arbiscan.io', true, true, '0.100000'),
('optimism', '10', 'evm', 'ETH', 'https://opt-mainnet.g.alchemy.com/v2/{API_KEY}', 'https://optimism.llamarpc.com', 'https://optimistic.etherscan.io', true, true, '0.001000'),
('bsc', '56', 'evm', 'BNB', 'https://bsc-dataseed1.bnbchain.org', 'https://bsc-dataseed2.bnbchain.org', 'https://bscscan.com', true, true, '3.000000'),
('celo', '42220', 'evm', 'CELO', 'https://forno.celo.org', 'https://celo.quicknode.com/{API_KEY}', 'https://celoscan.io', true, true, '1.000000'),
('solana', 'mainnet-beta', 'solana', 'SOL', 'https://api.mainnet-beta.solana.com', 'https://solana-mainnet.rpc.grove.io/{API_KEY}', 'https://solscan.io', true, true, NULL);

-- If adding other chains:
-- ('avalanche', '43114', 'evm', 'AVAX', '...', '...', 'https://snowtrace.io', true, true, '25.000000'),
-- ('fantom', '250', 'evm', 'FTM', '...', '...', 'https://ftmscan.com', true, true, '20.000000'),
-- ('moonbeam', '1284', 'evm', 'GLMR', '...', '...', 'https://moonscan.io', true, true, '1.000000'),

RETURNING id, chain_name;
```

---

## 2. Populate cross_chain_tokens

```sql
-- Insert supported tokens with contract addresses
INSERT INTO cross_chain_tokens (symbol, name, chain_name, contract_address, decimals, logo_url, coingecko_id, is_native, is_bridgeable, is_swappable, price, price_updated_at)
VALUES
-- Ethereum Chain
('ETH', 'Ethereum', 'ethereum', '0x0000000000000000000000000000000000000000', 18, 'https://tokens.pancakeswap.finance/images/0x0000000000000000000000000000000000000000.png', 'ethereum', true, false, true, '2500.00000000', NOW()),
('USDC', 'USD Coin', 'ethereum', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'https://tokens.pancakeswap.finance/images/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48.png', 'usd-coin', false, true, true, '1.00000000', NOW()),
('USDT', 'Tether USD', 'ethereum', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'https://tokens.pancakeswap.finance/images/0xdAC17F958D2ee523a2206206994597C13D831ec7.png', 'tether', false, true, true, '1.00000000', NOW()),
('DAI', 'Dai Stablecoin', 'ethereum', '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'https://tokens.pancakeswap.finance/images/0x6B175474E89094C44Da98b954EedeAC495271d0F.png', 'dai', false, true, true, '1.00000000', NOW()),

-- Polygon Chain
('MATIC', 'Polygon', 'polygon', '0x0000000000000000000000000000000000000000', 18, 'https://tokens.pancakeswap.finance/images/0x0000000000000000000000000000000000000000.png', 'matic-network', true, false, true, '0.80000000', NOW()),
('ETH', 'Ethereum', 'polygon', '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 18, 'https://tokens.pancakeswap.finance/images/0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619.png', 'ethereum', false, true, true, '2500.00000000', NOW()),
('USDC', 'USD Coin', 'polygon', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', 6, 'https://tokens.pancakeswap.finance/images/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174.png', 'usd-coin', false, true, true, '1.00000000', NOW()),
('USDT', 'Tether USD', 'polygon', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 6, 'https://tokens.pancakeswap.finance/images/0xc2132D05D31c914a87C6611C10748AEb04B58e8F.png', 'tether', false, true, true, '1.00000000', NOW()),
('DAI', 'Dai Stablecoin', 'polygon', '0x8f3Cf7ad23Cd3CaDbD9735AFF958023D60d90E6d', 18, 'https://tokens.pancakeswap.finance/images/0x8f3Cf7ad23Cd3CaDbD9735AFF958023D60d90E6d.png', 'dai', false, true, true, '1.00000000', NOW()),

-- Arbitrum Chain
('ETH', 'Ethereum', 'arbitrum', '0x0000000000000000000000000000000000000000', 18, 'https://tokens.pancakeswap.finance/images/0x0000000000000000000000000000000000000000.png', 'ethereum', true, false, true, '2500.00000000', NOW()),
('USDC', 'USD Coin', 'arbitrum', '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F86', 6, 'https://tokens.pancakeswap.finance/images/0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F86.png', 'usd-coin', false, true, true, '1.00000000', NOW()),
('USDT', 'Tether USD', 'arbitrum', '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6, 'https://tokens.pancakeswap.finance/images/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9.png', 'tether', false, true, true, '1.00000000', NOW()),
('DAI', 'Dai Stablecoin', 'arbitrum', '0xDA10009754f1CE336B8cE2B0919FAD14937e2d09', 18, 'https://tokens.pancakeswap.finance/images/0xDA10009754f1CE336B8cE2B0919FAD14937e2d09.png', 'dai', false, true, true, '1.00000000', NOW()),

-- Optimism Chain
('ETH', 'Ethereum', 'optimism', '0x0000000000000000000000000000000000000000', 18, 'https://tokens.pancakeswap.finance/images/0x0000000000000000000000000000000000000000.png', 'ethereum', true, false, true, '2500.00000000', NOW()),
('USDC', 'USD Coin', 'optimism', '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', 6, 'https://tokens.pancakeswap.finance/images/0x7F5c764cBc14f9669B88837ca1490cCa17c31607.png', 'usd-coin', false, true, true, '1.00000000', NOW()),
('USDT', 'Tether USD', 'optimism', '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 6, 'https://tokens.pancakeswap.finance/images/0x94b008aA00579c1307B0EF2c499aD98a8ce58e58.png', 'tether', false, true, true, '1.00000000', NOW()),
('DAI', 'Dai Stablecoin', 'optimism', '0xDA10009754f1CE336B8cE2B0919FAD14937e2d09', 18, 'https://tokens.pancakeswap.finance/images/0xDA10009754f1CE336B8cE2B0919FAD14937e2d09.png', 'dai', false, true, true, '1.00000000', NOW()),

-- BSC Chain
('BNB', 'Binance Coin', 'bsc', '0x0000000000000000000000000000000000000000', 18, 'https://tokens.pancakeswap.finance/images/0x0000000000000000000000000000000000000000.png', 'binancecoin', true, false, true, '600.00000000', NOW()),
('USDC', 'USD Coin', 'bsc', '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 18, 'https://tokens.pancakeswap.finance/images/0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d.png', 'usd-coin', false, true, true, '1.00000000', NOW()),
('USDT', 'Tether USD', 'bsc', '0x55d398326f99059fF775485246999027B3197955', 18, 'https://tokens.pancakeswap.finance/images/0x55d398326f99059fF775485246999027B3197955.png', 'tether', false, true, true, '1.00000000', NOW()),

-- Celo Chain
('CELO', 'Celo', 'celo', '0x0000000000000000000000000000000000000000', 18, 'https://tokens.pancakeswap.finance/images/0x0000000000000000000000000000000000000000.png', 'celo', true, false, true, '0.75000000', NOW()),
('USDC', 'USD Coin', 'celo', '0xcEb6acE566f06e81fD7De15D2934e602e59d637e', 6, 'https://tokens.pancakeswap.finance/images/0xcEb6acE566f06e81fD7De15D2934e602e59d637e.png', 'usd-coin', false, true, true, '1.00000000', NOW()),
('cUSD', 'Celo Dollar', 'celo', '0x765DE816845861e75A25fCA122bb6CAA78443Cb', 18, 'https://tokens.pancakeswap.finance/images/0x765DE816845861e75A25fCA122bb6CAA78443Cb.png', 'celo-dollar', false, true, true, '0.90000000', NOW()),

-- Solana Chain
('SOL', 'Solana', 'solana', '11111111111111111111111111111111', 9, 'https://tokens.pancakeswap.finance/images/solana.png', 'solana', true, false, true, '150.00000000', NOW()),
('USDC', 'USD Coin', 'solana', 'EPjFWdd5Au17Burns48e3YjDgsTZmbRoqft27zP3kA1', 6, 'https://tokens.pancakeswap.finance/images/EPjFWdd5Au17Burns48e3YjDgsTZmbRoqft27zP3kA1.png', 'usd-coin', false, true, true, '1.00000000', NOW()),
('USDT', 'Tether USD', 'solana', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 6, 'https://tokens.pancakeswap.finance/images/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB.png', 'tether', false, true, true, '1.00000000', NOW());

RETURNING id, symbol, chain_name, contract_address;
```

---

## 3. Populate cross_chain_dexes

```sql
-- Insert DEX configurations
INSERT INTO cross_chain_dexes (dex_name, dex_type, chain_name, router_contract_address, factory_contract_address, liquidity_token_symbol, fee_percent, tvl, volume24h, is_active)
VALUES
-- Ethereum DEXes
('Uniswap V3', 'amm', 'ethereum', '0xE592427A0AEce92De3Edee1F18E0157C05861564', '0x1F98431c8aD98523631AE4a59f267346ea31394E', 'UNI', '0.25', '5000000000.00', '2000000000.00', true),
('SushiSwap', 'amm', 'ethereum', '0xd9e1cE17f2641f24aE57070Df9dF627d89d112Cb', '0xC0AEe478c3bE900A85755667f52183AD7d58a0a', 'SUSHI', '0.25', '1500000000.00', '500000000.00', true),

-- Polygon DEXes
('Uniswap V3', 'amm', 'polygon', '0xE592427A0AEce92De3Edee1F18E0157C05861564', '0x1F98431c8aD98523631AE4a59f267346ea31394E', 'UNI', '0.25', '800000000.00', '300000000.00', true),
('QuickSwap', 'amm', 'polygon', '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', 'QUICK', '0.04', '600000000.00', '200000000.00', true),
('SushiSwap', 'amm', 'polygon', '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', 'SUSHI', '0.25', '400000000.00', '150000000.00', true),

-- Arbitrum DEXes
('Uniswap V3', 'amm', 'arbitrum', '0xE592427A0AEce92De3Edee1F18E0157C05861564', '0x1F98431c8aD98523631AE4a59f267346ea31394E', 'UNI', '0.25', '700000000.00', '400000000.00', true),
('SushiSwap', 'amm', 'arbitrum', '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', 'SUSHI', '0.25', '300000000.00', '100000000.00', true),

-- Optimism DEXes
('Uniswap V3', 'amm', 'optimism', '0xE592427A0AEce92De3Edee1F18E0157C05861564', '0x1F98431c8aD98523631AE4a59f267346ea31394E', 'UNI', '0.25', '400000000.00', '150000000.00', true),

-- BSC DEXes
('PancakeSwap', 'amm', 'bsc', '0x10ED43C718714eb63d5aA57B78f985BB64e3A85', '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', 'CAKE', '0.25', '900000000.00', '600000000.00', true),

-- Celo DEXes
('Uniswap V3', 'amm', 'celo', '0xE592427A0AEce92De3Edee1F18E0157C05861564', '0x1F98431c8aD98523631AE4a59f267346ea31394E', 'UNI', '0.25', '50000000.00', '20000000.00', true),
('SushiSwap', 'amm', 'celo', '0x7f5Cc8d963Fc5f8307625bBDe0bEE9cD628a71E4', '0x3028F3c91f5fAe14b66996ac1d88d11d301aEd6f', 'SUSHI', '0.25', '30000000.00', '10000000.00', true),

-- Solana DEXes
('Jupiter', 'aggregator', 'solana', 'JupiterK4bXe9eMZmqKc2JSMoqDCjhSJJCHoNc4cqt1', NULL, NULL, '0.25', '2000000000.00', '1500000000.00', true),
('Raydium', 'amm', 'solana', '675kPX9MHTjS2zt1qLCXVJ2PgwciSNcP1vAeoP60K1w', NULL, 'RAY', '0.25', '1000000000.00', '800000000.00', true),
('Orca', 'amm', 'solana', 'whirLbMiicVdio4KfUqkEB4OfVMeYBj2ufsqWfzbnU', NULL, 'ORCA', '0.25', '500000000.00', '300000000.00', true);

RETURNING id, dex_name, chain_name;
```

---

## 4. Populate cross_chain_trading_pairs

```sql
-- Insert major trading pairs for each DEX
-- Example for Ethereum Uniswap V3 (USDC/ETH and USDC/USDT pairs)
INSERT INTO cross_chain_trading_pairs (dex_id, base_token, quote_token, pair_contract_address, liquidity, volume24h, price_base_per_quote, price_updated_at, is_active)
SELECT 
  (SELECT id FROM cross_chain_dexes WHERE dex_name = 'Uniswap V3' AND chain_name = 'ethereum'),
  'USDC', 'ETH',
  '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8', -- USDC-ETH 0.05% pool
  '1000000000.00000000', '500000000.00000000', '2500.00000000', NOW(), true
UNION ALL SELECT 
  (SELECT id FROM cross_chain_dexes WHERE dex_name = 'Uniswap V3' AND chain_name = 'ethereum'),
  'USDC', 'USDT',
  '0x3416cF6C708Da44DB2624D63ea0AAef7113527C58', -- USDC-USDT 0.01% pool
  '5000000000.00000000', '2000000000.00000000', '1.00000000', NOW(), true
UNION ALL SELECT 
  (SELECT id FROM cross_chain_dexes WHERE dex_name = 'Uniswap V3' AND chain_name = 'ethereum'),
  'ETH', 'DAI',
  '0x60594a405d53811d3bca46eB58aF86618f5d9DFb', -- ETH-DAI 0.3% pool
  '800000000.00000000', '400000000.00000000', '2500.00000000', NOW(), true
-- Add similar entries for other DEXes and chains...
-- Note: In production, these should come from DEX GraphQL APIs or price feeds
;

RETURNING id, base_token, quote_token, price_base_per_quote;
```

---

## 5. Populate cross_chain_bridges

```sql
-- Insert bridge routes
INSERT INTO cross_chain_bridges (bridge_name, bridge_type, source_chain, destination_chain, bridge_contract_address, pool_contract_address, token_address, supported_token, min_amount, max_amount, bridge_fee_percent, estimated_time_minutes, is_active)
VALUES
-- Stargate Finance routes (USDC bridges)
('Stargate', 'liquidity', 'ethereum', 'polygon', '0x8731d54E9D02c286e8b3212f8433959A7bBEde0a', '0x55bE61eFC5DfdBb9dcF7d86a9e09A08Dd0fd0b3d', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', '100.00000000', '1000000.00000000', '0.06', 10, true),
('Stargate', 'liquidity', 'ethereum', 'arbitrum', '0x8731d54E9D02c286e8b3212f8433959A7bBEde0a', '0x892785f33CdeE22A30AFA92757f8F62c0e5fdD42', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', '100.00000000', '1000000.00000000', '0.06', 10, true),
('Stargate', 'liquidity', 'ethereum', 'optimism', '0x8731d54E9D02c286e8b3212f8433959A7bBEde0a', '0xDecC0c09c3B5f6e92EF4184125D5648a66F28298', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', '100.00000000', '1000000.00000000', '0.06', 10, true),
('Stargate', 'liquidity', 'ethereum', 'bsc', '0x8731d54E9D02c286e8b3212f8433959A7bBEde0a', '0x1c272232df0bb54efb46cd1cd632ca90ff592676', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', '100.00000000', '1000000.00000000', '0.06', 15, true),

-- Stargate Finance routes (USDT bridges)
('Stargate', 'liquidity', 'ethereum', 'polygon', '0x8731d54E9D02c286e8b3212f8433959A7bBEde0a', '0x38EA452219524Bb897e2EJournal4D8b924B2d50', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', '100.00000000', '1000000.00000000', '0.06', 10, true),
('Stargate', 'liquidity', 'ethereum', 'arbitrum', '0x8731d54E9D02c286e8b3212f8433959A7bBEde0a', '0xB6CcC89cE1d1756Cf7b906Bc8D23Fc3ba6E27bCc', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', '100.00000000', '1000000.00000000', '0.06', 10, true),
('Stargate', 'liquidity', 'ethereum', 'bsc', '0x8731d54E9D02c286e8b3212f8433959A7bBEde0a', '0x8ba1d4E6b66df9f6CAE7C3e4EEB59DAA0D74f6dc', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', '100.00000000', '1000000.00000000', '0.06', 15, true),

-- Axelar Network routes (USDC bridges)
('Axelar', 'message-passing', 'ethereum', 'celo', '0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69', NULL, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', '50.00000000', '500000.00000000', '0.35', 25, true),
('Axelar', 'message-passing', 'ethereum', 'polygon', '0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69', NULL, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', '50.00000000', '500000.00000000', '0.35', 25, true),

-- Wormhole Portal Bridge routes (for Solana)
('Wormhole', 'wrapped-bridge', 'ethereum', 'solana', '0x98f3c9e6E3fAce36bAAd05FE20C9D3F7EA9792C', NULL, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', '10.00000000', '1000000.00000000', '0.25', 12, true),
('Wormhole', 'wrapped-bridge', 'solana', 'ethereum', 'wormDTUJ6AWPNvK59vGQLFa8JAmL1AxbnZyXqmMsgU', NULL, 'EPjFWdd5Au17Burns48e3YjDgsTZmbRoqft27zP3kA1', 'USDC', '10.00000000', '1000000.00000000', '0.25', 12, true),

-- Connext routes (faster bridges)
('Connext', 'liquidity', 'ethereum', 'polygon', '0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777', NULL, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', '50.00000000', '100000.00000000', '0.15', 15, true),
('Connext', 'liquidity', 'ethereum', 'arbitrum', '0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777', NULL, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', '50.00000000', '100000.00000000', '0.15', 15, true);

RETURNING id, bridge_name, source_chain, destination_chain, supported_token;
```

---

## 6. Migration Steps

### Step 1: Backup Existing Data
```sql
-- Create backup tables
CREATE TABLE cross_chain_chains_backup AS SELECT * FROM cross_chain_chains WHERE 1=0;
CREATE TABLE cross_chain_tokens_backup AS SELECT * FROM cross_chain_tokens WHERE 1=0;
CREATE TABLE cross_chain_dexes_backup AS SELECT * FROM cross_chain_dexes WHERE 1=0;
CREATE TABLE cross_chain_bridges_backup AS SELECT * FROM cross_chain_bridges WHERE 1=0;
```

### Step 2: Execute Population Scripts
Run scripts in order: chains → dexes → tokens → trading pairs → bridges

### Step 3: Verify Population
```sql
-- Verify all tables have data
SELECT 'cross_chain_chains' as table_name, COUNT(*) as row_count FROM cross_chain_chains
UNION ALL SELECT 'cross_chain_dexes', COUNT(*) FROM cross_chain_dexes
UNION ALL SELECT 'cross_chain_tokens', COUNT(*) FROM cross_chain_tokens
UNION ALL SELECT 'cross_chain_bridges', COUNT(*) FROM cross_chain_bridges
UNION ALL SELECT 'cross_chain_trading_pairs', COUNT(*) FROM cross_chain_trading_pairs;
```

### Step 4: Validate Foreign Keys
```sql
-- Check for any referential integrity issues
SELECT * FROM cross_chain_bridges b
WHERE NOT EXISTS (SELECT 1 FROM cross_chain_chains c WHERE c.chain_name = b.source_chain);

SELECT * FROM cross_chain_trading_pairs tp
WHERE NOT EXISTS (SELECT 1 FROM cross_chain_dexes d WHERE d.id = tp.dex_id);
```

---

## 7. Update Process (Ongoing)

### Update Token Prices Daily
```sql
-- Script to run daily (via cron or CI/CD)
UPDATE cross_chain_tokens
SET price = '2500.00000000', -- From price feed API
    price_updated_at = NOW()
WHERE symbol = 'ETH';
```

### Update DEX Volume & TVL Weekly
```sql
-- Script to run weekly
UPDATE cross_chain_dexes
SET volume24h = '2000000000.00', -- From TheGraph API
    tvl = '5000000000.00',
    updated_at = NOW()
WHERE dex_name = 'Uniswap V3' AND chain_name = 'ethereum';
```

### Add New Bridge Routes as Available
```sql
-- Template for new bridge routes
INSERT INTO cross_chain_bridges (bridge_name, bridge_type, source_chain, destination_chain, bridge_contract_address, token_address, supported_token, min_amount, max_amount, bridge_fee_percent, estimated_time_minutes, is_active)
VALUES ('NewBridge', 'liquidity', 'source', 'dest', '0x...', '0x...', 'USDC', '100', '1000000', '0.25', 20, true);
```

---

## 8. Indexing for Performance

Create indexes on frequently queried columns:

```sql
-- Performance indexes
CREATE INDEX idx_tokens_chain ON cross_chain_tokens(chain_name);
CREATE INDEX idx_tokens_symbol ON cross_chain_tokens(symbol);
CREATE INDEX idx_bridges_source_dest ON cross_chain_bridges(source_chain, destination_chain);
CREATE INDEX idx_trading_pairs_dex_tokens ON cross_chain_trading_pairs(dex_id, base_token, quote_token);
CREATE INDEX idx_transfers_user ON cross_chain_transfers(user_id);
CREATE INDEX idx_transfers_status ON cross_chain_transfers(status);
CREATE INDEX idx_swaps_user ON cross_chain_swaps(user_id);
CREATE INDEX idx_swaps_status ON cross_chain_swaps(status);
```

---

## 9. Notes & Considerations

1. **Contract Addresses**: Some contracts use different addresses on different chains. Ensure accuracy when copying addresses.
2. **Decimals**: Be careful with token decimals (USDC is 6 decimals, not 18 on most chains).
3. **Liquidity**: Trading pairs should be populated from DEX subgraphs (The Graph) for real-time accuracy.
4. **Price Feeds**: Use Chainlink or CoinGecko API for real-time prices.
5. **Bridge Status**: Monitor bridge status changes and update `is_active` accordingly.
6. **Testing**: Test all routes with small amounts before production use.

