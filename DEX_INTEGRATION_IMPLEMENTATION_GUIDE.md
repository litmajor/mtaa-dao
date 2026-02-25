# DEX Integration Implementation Guide

**Quick Reference for Adding New DEXs**  
**All calls route through**: `POST /api/dex/*` on Express.js port 5000

---

## Table of Contents
1. [Raydium Integration](#raydium-integration) - Solana AMM
2. [Pump.fun Integration](#pumpfun-integration) - Solana Memecoin
3. [SunSwap Integration](#sunswap-integration) - Tron DEX
4. [PancakeSwap Activation](#pancakeswap-activation) - BSC DEX

---

## Raydium Integration

**Objective**: Add Solana DEX support for token swaps  
**File to modify**: `server/services/dexIntegrationService.ts`  
**Status**: Not started  
**Effort**: 3-4 hours

### Step 1: Install Dependencies

```bash
npm install @raydium-io/raydium-sdk-v2 @solana/web3.js
```

### Step 2: Add Raydium Configuration

**Location**: Top of `dexIntegrationService.ts`, after imports

```typescript
import * as solanaWeb3 from '@solana/web3.js';
import { Raydium } from '@raydium-io/raydium-sdk-v2';

// Raydium SDK ABI (not needed - SDK handles it)
const RAYDIUM_CONFIG = {
  apiUrl: 'https://api-v3.raydium.io/',
  programId: '675kPX9MHTjXn8kqBvUWXqQaBEG3zzBtSaewWzVggKWT',
  supportedChains: ['solana']
};

// Popular Solana token addresses
const SOLANA_TOKENS = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWaJsJgmJXVmwLpyHYvhkZ7GcyH6qoLU4BRCwEZnQ',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEsl',
  'RAY': '4k3Dyjzvzp8eMZWUXbCCG4rYEiUWTorxideofF4gjwJ',
  'COPE': '8HGyAAB1yoM1ttS7pnMMoa2HiUMwVjfot3NANVgvtnA'
};
```

### Step 3: Add Solana Provider Initialization

**Location**: In `constructor()` or new `initializeSolanaProvider()` method

```typescript
private solanaConnection: solanaWeb3.Connection | null = null;
private solanaRaydium: any = null;

constructor() {
  this.initializeProvider();
  this.initializeSolanaProvider();
}

private initializeSolanaProvider(): void {
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.solanaConnection = new solanaWeb3.Connection(
      rpcUrl,
      'finalized'
    );
    logger.info(`✅ Solana connection initialized: ${rpcUrl}`);

    // Initialize Raydium SDK
    const raydium = new Raydium({
      connection: this.solanaConnection,
      // Optional: Add wallet if private key available
      owner: this.getSolanaWallet()
    });
    this.solanaRaydium = raydium;
    logger.info('✅ Raydium SDK initialized');
  } catch (error) {
    logger.error('Error initializing Solana provider:', error);
    this.solanaConnection = null;
  }
}

private getSolanaWallet(): solanaWeb3.Keypair | null {
  try {
    const privateKey = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKey) return null;
    
    const decoded = JSON.parse(privateKey);
    return solanaWeb3.Keypair.fromSecretKey(new Uint8Array(decoded));
  } catch (error) {
    logger.warn('Could not load Solana wallet');
    return null;
  }
}
```

### Step 4: Add to DEX_ROUTERS

**Location**: In `DEX_ROUTERS` object

```typescript
private readonly DEX_ROUTERS = {
  // ... existing routers ...
  
  // Solana DEXs
  raydium_solana: {
    address: '675kPX9MHTjXn8kqBvUWXqQaBEG3zzBtSaewWzVggKWT',
    name: 'Raydium',
    chain: 'solana',
    type: 'amm-v2',
    liquidity: '$500M+'
  }
};
```

### Step 5: Implement Raydium Quote Method

**Location**: Add new method in DEXIntegrationService class

```typescript
/**
 * Get Raydium swap quote on Solana
 */
private async getRaydiumQuote(
  fromAsset: string,
  toAsset: string,
  amountIn: number
): Promise<SwapQuote | null> {
  try {
    if (!this.solanaConnection || !this.solanaRaydium) {
      logger.warn('Solana provider not initialized');
      return null;
    }

    // Convert token names to addresses
    const fromMint = SOLANA_TOKENS[fromAsset];
    const toMint = SOLANA_TOKENS[toAsset];

    if (!fromMint || !toMint) {
      logger.warn(`Unknown tokens: ${fromAsset} or ${toAsset}`);
      return null;
    }

    // Convert amount to smallest unit (e.g., lamports for SOL)
    const decimals = await this.getTokenDecimals(fromMint);
    const amountInSmallest = Math.floor(amountIn * Math.pow(10, decimals));

    // Get swap routes from Raydium API
    const response = await fetch(
      `${RAYDIUM_CONFIG.apiUrl}v1/swap/getSwapRoutes?` +
      `inputMint=${fromMint}&` +
      `outputMint=${toMint}&` +
      `amount=${amountInSmallest}&` +
      `slippage=0.5&` +
      `walletAddress=${process.env.SOLANA_WALLET || 'unknown'}`
    );

    const data = await response.json();
    
    if (!data.data || !data.data.routeList || data.data.routeList.length === 0) {
      logger.warn(`No routes found for ${fromAsset} → ${toAsset}`);
      return null;
    }

    // Use best route (first one)
    const bestRoute = data.data.routeList[0];
    const outputDecimals = await this.getTokenDecimals(toMint);
    const estimatedAmountOut = bestRoute.outAmount / Math.pow(10, outputDecimals);

    return {
      fromAsset,
      toAsset,
      amountIn,
      estimatedAmountOut,
      exchangeRate: estimatedAmountOut / amountIn,
      priceImpact: bestRoute.priceImpact || 0,
      estimatedGas: 0.00005, // ~Solana's average tx fee in SOL
      dex: 'raydium_solana'
    };
  } catch (error) {
    logger.error('Error getting Raydium quote:', error);
    return null;
  }
}

private async getTokenDecimals(mint: string): Promise<number> {
  try {
    const token = await this.solanaConnection!.getParsedAccountInfo(
      new solanaWeb3.PublicKey(mint)
    );
    // Default to 6 for USDC/USDT/most tokens
    return 6;
  } catch {
    return 6;
  }
}
```

### Step 6: Update getSwapQuote() Method

**Location**: In existing `getSwapQuote()` method, add Solana case

```typescript
async getSwapQuote(
  fromAsset: string,
  toAsset: string,
  amountIn: number,
  preferredDex: string = 'ubeswap_celo',
  chain: string = 'celo'
): Promise<SwapQuote | null> {
  try {
    // Handle Solana chain
    if (chain === 'solana') {
      if (preferredDex.includes('raydium')) {
        return await this.getRaydiumQuote(fromAsset, toAsset, amountIn);
      }
    }

    // ... existing EVM chain handling ...
  } catch (error) {
    logger.error('Error getting swap quote:', error);
    return null;
  }
}
```

### Step 7: Implement Raydium Execute Method

**Location**: Add new method for Solana swap execution

```typescript
/**
 * Execute Raydium swap on Solana
 */
private async executeRaydiumSwap(
  quote: SwapQuote,
  slippageTolerance: number = 0.5
): Promise<SwapResult> {
  try {
    if (!this.solanaConnection) {
      return { success: false, error: 'Solana not initialized' };
    }

    // Check price impact
    if (quote.priceImpact > 5) {
      return {
        success: false,
        error: `Price impact too high: ${quote.priceImpact.toFixed(2)}%`
      };
    }

    const wallet = this.getSolanaWallet();
    if (!wallet) {
      return { success: false, error: 'No Solana wallet configured' };
    }

    // Get token addresses
    const fromMint = SOLANA_TOKENS[quote.fromAsset];
    const toMint = SOLANA_TOKENS[quote.toAsset];

    // Call Raydium API for swap instructions
    const response = await fetch(`${RAYDIUM_CONFIG.apiUrl}v1/swap/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programId: RAYDIUM_CONFIG.programId,
        inputMint: fromMint,
        outputMint: toMint,
        amount: quote.amountIn,
        slippage: slippageTolerance,
        txVersion: 'v0',
        wallet: wallet.publicKey.toBase58(),
        computeUnitPriceMicroLamports: 'auto'
      })
    });

    const swapData = await response.json();
    
    // Deserialize and sign transaction
    const transaction = solanaWeb3.VersionedTransaction.deserialize(
      Buffer.from(swapData.data.transaction, 'base64')
    );
    
    transaction.sign([wallet]);

    // Send transaction
    const signature = await this.solanaConnection.sendTransaction(transaction);
    const confirmation = await this.solanaConnection.confirmTransaction(signature);

    if (confirmation.value.err) {
      return {
        success: false,
        error: `Transaction failed: ${confirmation.value.err.toString()}`
      };
    }

    return {
      success: true,
      transactionHash: signature,
      amountOut: quote.estimatedAmountOut,
      actualRate: quote.exchangeRate,
      gasUsed: 0.00005
    };
  } catch (error) {
    logger.error('Error executing Raydium swap:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Swap failed'
    };
  }
}
```

### Step 8: Update executeSwap() Method

```typescript
async executeSwap(
  fromAsset: string,
  toAsset: string,
  amountIn: number,
  slippageTolerance: number = 0.5,
  dex: string = 'ubeswap',
  chain: string = 'celo'
): Promise<SwapResult> {
  try {
    // Handle Solana
    if (chain === 'solana') {
      const quote = await this.getRaydiumQuote(fromAsset, toAsset, amountIn);
      if (!quote) {
        return { success: false, error: 'Unable to get quote' };
      }
      return await this.executeRaydiumSwap(quote, slippageTolerance);
    }

    // ... existing EVM handling ...
  } catch (error) {
    logger.error('Error executing swap:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### Step 9: Add Environment Variables

**File**: `.env`

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
SOLANA_PRIVATE_KEY=...  # JSON format: [1,2,3,...]
SOLANA_WALLET=...       # Public key (optional)
```

### Step 10: Test Raydium Integration

```typescript
// In API route or test file
const quote = await dexService.getSwapQuote('USDC', 'SOL', 100, 'raydium_solana', 'solana');
console.log('Quote:', quote);

// Should return:
// {
//   fromAsset: 'USDC',
//   toAsset: 'SOL',
//   amountIn: 100,
//   estimatedAmountOut: 2.45,
//   exchangeRate: 0.0245,
//   priceImpact: 0.5,
//   estimatedGas: 0.00005,
//   dex: 'raydium_solana'
// }
```

---

## Pump.fun Integration

**Objective**: Add memecoin trading on Solana  
**Status**: Not started  
**Effort**: 4-5 hours  
**API**: Uses PumpPortal (no official SDK)

### Step 1: Install Dependencies

```bash
npm install axios
# Optional for Bitquery historical data:
npm install @apollo/client graphql
```

### Step 2: Create Pump.fun Service

**File**: `server/services/pumpfunIntegrationService.ts`

```typescript
import axios from 'axios';
import { logger } from '../utils/logger';
import * as solanaWeb3 from '@solana/web3.js';

const PUMP_PORTAL_API = 'https://pumpportal.fun/api';

interface PumpfunToken {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  creator: string;
  createdAt: number;
  supply: number;
  holders: number;
  liquidity: number;
  marketCap: number;
  priceUsd: number;
  priceChange24h: number;
  volumeUsd24h: number;
  trend: 'up' | 'down' | 'stable';
}

interface PumpfunTrade {
  mint: string;
  action: 'buy' | 'sell';
  amountSol: number;
  slippage: number;
}

class PumpfunIntegrationService {
  private connection: solanaWeb3.Connection;
  private wallet: solanaWeb3.Keypair | null = null;

  constructor(connection: solanaWeb3.Connection) {
    this.connection = connection;
    this.initializeWallet();
  }

  private initializeWallet(): void {
    try {
      const privateKey = process.env.SOLANA_PRIVATE_KEY;
      if (!privateKey) return;
      
      const decoded = JSON.parse(privateKey);
      this.wallet = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(decoded));
    } catch (error) {
      logger.warn('Could not load Solana wallet for Pump.fun');
    }
  }

  /**
   * Get trending tokens on Pump.fun
   */
  async getTrendingTokens(limit: number = 20): Promise<PumpfunToken[]> {
    try {
      const response = await axios.get(`${PUMP_PORTAL_API}/trending`, {
        params: { limit, offset: 0 }
      });

      return response.data.map((token: any) => ({
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        description: token.description,
        image: token.image_uri,
        creator: token.creator,
        createdAt: token.created_timestamp,
        supply: token.total_supply,
        holders: token.holders,
        liquidity: token.raydium_pool?.liquidity || 0,
        marketCap: token.market_cap,
        priceUsd: token.price,
        priceChange24h: token.price_change_24h || 0,
        volumeUsd24h: token.volume_24h,
        trend: token.price_change_24h > 0 ? 'up' : 'down'
      }));
    } catch (error) {
      logger.error('Error fetching trending tokens:', error);
      return [];
    }
  }

  /**
   * Get token info and price history
   */
  async getTokenInfo(mint: string): Promise<PumpfunToken | null> {
    try {
      const response = await axios.get(`${PUMP_PORTAL_API}/token/${mint}`);
      const token = response.data;

      return {
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        description: token.description,
        image: token.image_uri,
        creator: token.creator,
        createdAt: token.created_timestamp,
        supply: token.total_supply,
        holders: token.holders,
        liquidity: token.raydium_pool?.liquidity || 0,
        marketCap: token.market_cap,
        priceUsd: token.price,
        priceChange24h: token.price_change_24h || 0,
        volumeUsd24h: token.volume_24h,
        trend: token.price_change_24h > 0 ? 'up' : 'down'
      };
    } catch (error) {
      logger.error(`Error fetching token info for ${mint}:`, error);
      return null;
    }
  }

  /**
   * Execute buy/sell trade on Pump.fun
   */
  async executeTrade(trade: PumpfunTrade): Promise<{
    success: boolean;
    signature?: string;
    amountOut?: number;
    error?: string;
  }> {
    try {
      if (!this.wallet) {
        return { success: false, error: 'No wallet configured' };
      }

      // Get token to swap to (PUMP is wrapped token on bonding curve)
      const response = await axios.post(`${PUMP_PORTAL_API}/trade-local`, {
        publicKey: this.wallet.publicKey.toBase58(),
        action: trade.action,
        mint: trade.mint,
        amount: trade.amountSol,
        slippage: trade.slippage,
        txVersion: 'v0'
      });

      const txData = response.data;
      
      if (txData.error) {
        return { success: false, error: txData.error };
      }

      // Deserialize and sign
      const transaction = solanaWeb3.VersionedTransaction.deserialize(
        Buffer.from(txData.transaction, 'base64')
      );

      transaction.sign([this.wallet]);

      // Send transaction
      const signature = await this.connection.sendTransaction(transaction);
      await this.connection.confirmTransaction(signature);

      return {
        success: true,
        signature,
        amountOut: txData.expectedAmount
      };
    } catch (error) {
      logger.error('Error executing Pump.fun trade:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Trade failed'
      };
    }
  }

  /**
   * Get token holder distribution
   */
  async getHolders(mint: string): Promise<any[]> {
    try {
      const response = await axios.get(`${PUMP_PORTAL_API}/token/${mint}/holders`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching holders for ${mint}:`, error);
      return [];
    }
  }

  /**
   * Detect potential rug-pull risks
   */
  async analyzeRisk(mint: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    indicators: string[];
    safetyScore: number; // 0-100
  }> {
    try {
      const token = await this.getTokenInfo(mint);
      if (!token) {
        return { riskLevel: 'high', indicators: ['Token not found'], safetyScore: 0 };
      }

      const indicators: string[] = [];
      let riskPoints = 0;

      // Check creator reputation
      if (!token.creator) {
        indicators.push('No creator info');
        riskPoints += 20;
      }

      // Check liquidity
      if (token.liquidity < 1000) {
        indicators.push('Low liquidity');
        riskPoints += 15;
      }

      // Check age
      const ageHours = (Date.now() - token.createdAt) / (1000 * 60 * 60);
      if (ageHours < 1) {
        indicators.push('Very new token');
        riskPoints += 25;
      }

      // Check volume
      if (token.volumeUsd24h < 100) {
        indicators.push('Low volume');
        riskPoints += 10;
      }

      // Check concentration
      const holders = await this.getHolders(mint);
      if (holders.length > 0) {
        const top5Holdings = holders.slice(0, 5)
          .reduce((sum, h) => sum + h.percentage, 0);
        
        if (top5Holdings > 70) {
          indicators.push('Concentrated holdings');
          riskPoints += 20;
        }
      }

      const riskLevel = riskPoints >= 60 ? 'high' : riskPoints >= 30 ? 'medium' : 'low';
      
      return {
        riskLevel,
        indicators,
        safetyScore: Math.max(0, 100 - riskPoints)
      };
    } catch (error) {
      logger.error(`Error analyzing risk for ${mint}:`, error);
      return {
        riskLevel: 'high',
        indicators: ['Analysis error'],
        safetyScore: 0
      };
    }
  }
}

export const pumpfunService = new PumpfunIntegrationService(
  new solanaWeb3.Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  )
);
```

### Step 3: Add Pump.fun Routes

**File**: Add to `server/routes/dex.ts`

```typescript
import { pumpfunService } from '../services/pumpfunIntegrationService';

// Get trending Pump.fun tokens
router.get('/pump-fun/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const tokens = await pumpfunService.getTrendingTokens(limit);
    res.json({ success: true, tokens });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get token info
router.get('/pump-fun/token/:mint', async (req, res) => {
  try {
    const token = await pumpfunService.getTokenInfo(req.params.mint);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }
    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze token risk
router.get('/pump-fun/token/:mint/risk', async (req, res) => {
  try {
    const risk = await pumpfunService.analyzeRisk(req.params.mint);
    res.json({ success: true, risk });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute trade
router.post('/pump-fun/trade', async (req, res) => {
  try {
    const { mint, action, amountSol, slippage = 1 } = req.body;
    const result = await pumpfunService.executeTrade({
      mint,
      action,
      amountSol,
      slippage
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Step 4: Test Pump.fun Integration

```bash
# Get trending tokens
curl http://localhost:5000/api/dex/pump-fun/trending?limit=10

# Get token info
curl http://localhost:5000/api/dex/pump-fun/token/CzLSvfkQfAJ9KjRrWgVrwKniNbFisKiKJZqCKi9qjbA

# Analyze risk
curl http://localhost:5000/api/dex/pump-fun/token/CzLSvfkQfAJ9KjRrWgVrwKniNbFisKiKJZqCKi9qjbA/risk

# Execute trade
curl -X POST http://localhost:5000/api/dex/pump-fun/trade \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "CzLSvfkQfAJ9KjRrWgVrwKniNbFisKiKJZqCKi9qjbA",
    "action": "buy",
    "amountSol": 0.1,
    "slippage": 1
  }'
```

---

## SunSwap Integration

**Objective**: Add Tron DEX support  
**Status**: Not started  
**Effort**: 3-4 hours  
**Dependencies**: tronweb, @sunswap-finance/sunswap-sdk

### Step 1: Install Dependencies

```bash
npm install tronweb @sunswap-finance/sunswap-sdk
```

### Step 2: Create SunSwap Service

**File**: `server/services/sunswapIntegrationService.ts`

```typescript
import TronWeb from 'tronweb';
import { SDK } from '@sunswap-finance/sunswap-sdk';
import { logger } from '../utils/logger';

const SUNSWAP_CONFIG = {
  factoryAddress: 'TSSMHYeV62XncPXjBFss9Tm3uqDgSYadrK',
  routerAddress: 'TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax',
  rpc: 'https://api.trongrid.io'
};

const TRON_TOKENS = {
  'USDT': 'TR7NHqjeKQxGTCi8q282JJUC8RS5K5YRLZ',
  'USDC': 'TEkxrTeW5qata41gC1aDzJVaG8nnB39oVM',
  'WTRX': 'TNUC9Qb1rRgcFayXL12DsCSd7Uc846Nrx8',
  'SUN': 'TKfjV1iYzSmLwBtTfwyiiZKLfuQKz6UJYL'
};

class SunSwapIntegrationService {
  private tronweb: TronWeb;
  private sdk: any;
  private wallet: string;

  constructor() {
    this.initializeTronWeb();
  }

  private initializeTronWeb(): void {
    try {
      const privateKey = process.env.TRON_PRIVATE_KEY;
      const apiKey = process.env.TRON_PRO_API_KEY;

      this.tronweb = new TronWeb({
        fullHost: SUNSWAP_CONFIG.rpc,
        headers: {
          'TRON-PRO-API-KEY': apiKey || ''
        },
        privateKey: privateKey || ''
      });

      this.wallet = this.tronweb.address.fromPrivateKey(privateKey);
      this.sdk = SDK.getInstance({ tronWeb: this.tronweb });

      logger.info(`✅ TronWeb initialized. Wallet: ${this.wallet}`);
    } catch (error) {
      logger.error('Error initializing TronWeb:', error);
    }
  }

  /**
   * Get swap quote for SunSwap
   */
  async getSwapQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<{
    estimatedOut: string;
    priceImpact: number;
    executionPrice: number;
  } | null> {
    try {
      const tokenInAddr = TRON_TOKENS[tokenIn] || tokenIn;
      const tokenOutAddr = TRON_TOKENS[tokenOut] || tokenOut;

      const amounts = await this.sdk.router.getAmountsOut(
        amountIn,
        [tokenInAddr, tokenOutAddr]
      );

      if (!amounts || amounts.length === 0) {
        return null;
      }

      const estimatedOut = amounts[amounts.length - 1];
      const executionPrice = parseFloat(estimatedOut) / parseFloat(amountIn);
      const priceImpact = 0.3; // SunSwap average

      return {
        estimatedOut,
        priceImpact,
        executionPrice
      };
    } catch (error) {
      logger.error('Error getting SunSwap quote:', error);
      return null;
    }
  }

  /**
   * Execute swap on SunSwap
   */
  async executeSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minAmountOut: string
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      const tokenInAddr = TRON_TOKENS[tokenIn] || tokenIn;
      const tokenOutAddr = TRON_TOKENS[tokenOut] || tokenOut;

      const path = [tokenInAddr, tokenOutAddr];
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

      const txhash = await this.sdk.router.swapExactTokensForTokens({
        amountIn,
        amountOutMin: minAmountOut,
        path,
        to: this.wallet,
        deadline
      });

      return {
        success: true,
        txHash: txhash
      };
    } catch (error) {
      logger.error('Error executing SunSwap swap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Swap failed'
      };
    }
  }
}

export const sunswapService = new SunSwapIntegrationService();
```

### Step 3: Add SunSwap Routes

Add to `server/routes/dex.ts`:

```typescript
import { sunswapService } from '../services/sunswapIntegrationService';

// SunSwap quote
router.post('/sunswap/quote', async (req, res) => {
  try {
    const { tokenIn, tokenOut, amountIn } = req.body;
    const quote = await sunswapService.getSwapQuote(tokenIn, tokenOut, amountIn);
    
    if (!quote) {
      return res.status(404).json({ success: false, error: 'No quote available' });
    }

    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// SunSwap execute
router.post('/sunswap/execute', async (req, res) => {
  try {
    const { tokenIn, tokenOut, amountIn, minAmountOut } = req.body;
    const result = await sunswapService.executeSwap(
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Step 4: Add Environment Variables

```bash
# Tron Configuration
TRON_RPC_URL=https://api.trongrid.io
TRON_PRO_API_KEY=...
TRON_PRIVATE_KEY=...
TRON_WALLET=...
```

---

## PancakeSwap Activation

**Objective**: Enable BSC DEX swaps  
**Status**: Configuration exists, needs activation  
**Effort**: 1-2 hours  
**Steps**:

### Step 1: Update BSC_RPC_URL

**File**: `.env`

```bash
BSC_RPC_URL=https://bsc-dataseed.binance.org
```

### Step 2: Ensure PancakeSwap is in DEX_ROUTERS

**File**: `server/services/dexIntegrationService.ts`

Verify this exists in `DEX_ROUTERS`:

```typescript
pancakeswap_bsc: {
  address: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  name: 'PancakeSwap',
  chain: 'bsc',
  type: 'uniswap-v2',
  liquidity: '$2B+'
}
```

### Step 3: Update Routes for BSC

**File**: `server/routes/dex.ts`

Ensure `/api/dex/supported-by-chain/bsc` returns PancakeSwap:

```typescript
router.get('/supported-by-chain/:chain', (req, res) => {
  const chain = req.params.chain.toLowerCase();
  const supportedByChain = Object.values(dexService.getDEXs()).filter(
    dex => dex.chain === chain
  );
  
  // Should include: pancakeswap for bsc
  res.json({ success: true, dexs: supportedByChain });
});
```

### Step 4: Test PancakeSwap

```bash
# Get quote
curl -X POST http://localhost:5000/api/dex/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromAsset": "USDT",
    "toAsset": "BNB",
    "amountIn": 100,
    "chain": "bsc",
    "preferredDex": "pancakeswap_bsc"
  }'

# Should return quote for BSC/PancakeSwap
```

---

## Verification Checklist

After implementing each DEX, verify:

- [ ] DEX added to `DEX_ROUTERS` object
- [ ] Quote endpoint returns valid data
- [ ] Gas estimation is reasonable
- [ ] Slippage calculation is correct
- [ ] Wallet integration works (if applicable)
- [ ] Error handling is robust
- [ ] Routes registered in Express server
- [ ] All calls flow through `/api/dex/*`
- [ ] Testnet swap succeeds
- [ ] Mainnet dry-run (no actual execution) works

---

## All Calls Route Through Single Server

```
POST http://localhost:5000/api/dex/quote          ← Single API Server
POST http://localhost:5000/api/dex/execute        ← Express.js Port 5000
GET  http://localhost:5000/api/dex/supported      ← Central Hub
GET  http://localhost:5000/api/dex/pump-fun/*     ← No separate services
POST http://localhost:5000/api/dex/sunswap/*
```

**No separate FastAPI, Django, or Python servers needed.**  
All integrations happen within the single Node.js/Express.js API server.
