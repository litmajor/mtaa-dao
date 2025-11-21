// Phase 3: Enhanced Token Service with multi-token support
import { ethers } from 'ethers';
import { TOKEN_REGISTRY, TokenInfo, TokenRegistry, YIELD_STRATEGIES } from '../../shared/tokenRegistry';
import { db } from '../db';
import { users, governanceProposals } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Enhanced ERC20 ABI with additional functions for Phase 3
const ENHANCED_ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

// RPC Call Retry Configuration
const RPC_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1s initial delay
  maxDelay: 20000, // 20s max delay
};

// Helper for retrying RPC calls with exponential backoff
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'RPC call'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= RPC_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const isRetryable = 
        error.code === 'TIMEOUT' || 
        error.code === 'RATE_LIMIT' ||
        error.status === 429 ||
        error.message?.includes('timeout') ||
        error.message?.includes('block') && error.message?.includes('range');
      
      if (!isRetryable || attempt >= RPC_RETRY_CONFIG.maxRetries) {
        throw error;
      }
      
      const delay = Math.min(
        RPC_RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
        RPC_RETRY_CONFIG.maxDelay
      );
      console.warn(`[${operationName}] Retry attempt ${attempt + 1}/${RPC_RETRY_CONFIG.maxRetries} after ${delay}ms`, 
        { error: error.message });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error(`${operationName} failed after ${RPC_RETRY_CONFIG.maxRetries} retries`);
}

export class TokenService {
  public provider: ethers.JsonRpcProvider; // Make public for sharing
  public signer?: ethers.Wallet; // Make public for sharing
  private network: 'mainnet' | 'testnet';
  private contracts: Map<string, ethers.Contract> = new Map();

  constructor(
    providerUrl: string,
    privateKey?: string,
    network: 'mainnet' | 'testnet' = 'testnet'
  ) {
    // Configure provider with timeout settings
    this.provider = new ethers.JsonRpcProvider(
      providerUrl,
      undefined,
      {
        staticNetwork: true,
        batchMaxCount: 1
      }
    );
    
    // Set polling interval for faster updates (optional)
    this.provider.pollingInterval = 12000; // 12 seconds
    
    this.signer = privateKey ? new ethers.Wallet(privateKey, this.provider) : undefined;
    this.network = network;

    // Initialize contracts for active tokens
    this.initializeContracts();
  }

  private initializeContracts(): void {
    const activeTokens = TokenRegistry.getActiveTokens();

    for (const token of activeTokens) {
      if (token.symbol === 'CELO') continue; // Native token, no contract needed

      const address = token.address[this.network];
      // Only initialize contracts with valid addresses
      if (address && address !== '0x0000000000000000000000000000000000000000') {
        const contract = new ethers.Contract(
          address,
          ENHANCED_ERC20_ABI,
          this.signer || this.provider
        );
        this.contracts.set(token.symbol, contract);
      }
    }
  }

  // Get token contract instance
  getTokenContract(symbol: string): ethers.Contract | null {
    return this.contracts.get(symbol) || null;
  }

  // Get token balance for an address (with retry logic)
  async getTokenBalance(symbol: string, address: string): Promise<string> {
    return executeWithRetry(async () => {
      if (symbol === 'CELO') {
        // Native token balance
        const balance = await this.provider.getBalance(address);
        return ethers.formatEther(balance);
      }

      const contract = this.getTokenContract(symbol);
      if (!contract) {
        throw new Error(`Token contract not found for ${symbol}`);
      }

      const token = TokenRegistry.getToken(symbol);
      if (!token) {
        throw new Error(`Token info not found for ${symbol}`);
      }

      const balance = await contract.balanceOf(address);
      return ethers.formatUnits(balance, token.decimals);
    }, `getTokenBalance(${symbol}, ${address})`);
  }

  // Send token transaction
  async sendToken(
    symbol: string,
    to: string,
    amount: string,
    fromAddress?: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('No signer available for token transfer');
    }

    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      throw new Error(`Token not supported: ${symbol}`);
    }

    if (symbol === 'CELO') {
      // Native token transfer
      const tx = await this.signer.sendTransaction({
        to,
        value: ethers.parseEther(amount)
      });
      await tx.wait();
      return tx.hash;
    }

    const contract = this.getTokenContract(symbol);
    if (!contract) {
      throw new Error(`Token contract not found for ${symbol}`);
    }

    const parsedAmount = ethers.parseUnits(amount, token.decimals);
    const tx = await contract.transfer(to, parsedAmount);
    await tx.wait();
    return tx.hash;
  }

  // Approve token spending (for vault deposits)
  async approveToken(
    symbol: string,
    spender: string,
    amount: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('No signer available for token approval');
    }

    if (symbol === 'CELO') {
      throw new Error('Native token does not require approval');
    }

    const contract = this.getTokenContract(symbol);
    if (!contract) {
      throw new Error(`Token contract not found for ${symbol}`);
    }

    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      throw new Error(`Token info not found for ${symbol}`);
    }

    const parsedAmount = ethers.parseUnits(amount, token.decimals);
    const tx = await contract.approve(spender, parsedAmount);
    await tx.wait();
    return tx.hash;
  }

  // Check token allowance
  async getTokenAllowance(
    symbol: string,
    owner: string,
    spender: string
  ): Promise<string> {
    if (symbol === 'CELO') {
      return '0'; // Native token has no allowance concept
    }

    const contract = this.getTokenContract(symbol);
    if (!contract) {
      throw new Error(`Token contract not found for ${symbol}`);
    }

    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      throw new Error(`Token info not found for ${symbol}`);
    }

    const allowance = await contract.allowance(owner, spender);
    return ethers.formatUnits(allowance, token.decimals);
  }

  // Get multiple token balances for portfolio view with real prices
  async getPortfolioBalances(address: string): Promise<{
    symbol: string;
    balance: string;
    balanceUSD: string;
    token: TokenInfo;
  }[]> {
    const activeTokens = TokenRegistry.getActiveTokens();
    const balances = [];

    for (const token of activeTokens) {
      try {
        const balance = await this.getTokenBalance(token.symbol, address);
        const balanceNum = parseFloat(balance);

        if (balanceNum > 0) {
          // Get real price from primary sources
          const priceUSD = await this.getTokenPriceFromOracle(token.symbol);
          const balanceUSD = (balanceNum * priceUSD).toFixed(2);

          balances.push({
            symbol: token.symbol,
            balance,
            balanceUSD,
            token
          });
        }
      } catch (error) {
        console.error(`Error fetching balance for ${token.symbol}:`, error);
      }
    }

    return balances;
  }

  /**
   * Get real token price from multiple oracle sources (CoinGecko, DeFiLlama, Chainlink)
   */
  private async getTokenPriceFromOracle(symbol: string): Promise<number> {
    try {
      // Try CoinGecko first (free, reliable, no auth needed)
      try {
        const price = await this.getPriceFromCoinGecko(symbol);
        if (price > 0) return price;
      } catch (error) {
        console.warn(`[CoinGecko] Failed to fetch price for ${symbol}:`, error);
      }

      // Fallback to DeFiLlama
      try {
        const price = await this.getPriceFromDeFiLlama(symbol);
        if (price > 0) return price;
      } catch (error) {
        console.warn(`[DeFiLlama] Failed to fetch price for ${symbol}:`, error);
      }

      // Fallback to on-chain Chainlink oracle
      try {
        const price = await this.getPriceFromChainlink(symbol);
        if (price > 0) return price;
      } catch (error) {
        console.warn(`[Chainlink] Failed to fetch price for ${symbol}:`, error);
      }

      throw new Error(`Unable to fetch price for ${symbol} from any source`);
    } catch (error) {
      console.error(`[Price Oracle] Failed all sources for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * CoinGecko API - Free, no auth required
   */
  private async getPriceFromCoinGecko(symbol: string): Promise<number> {
    const tokenMap: Record<string, string> = {
      'CELO': 'celo',
      'cUSD': 'celo-dollar',
      'cEUR': 'celo-euro',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'DAI': 'dai',
      'MTAA': 'mtaa-token'
    };

    const tokenId = tokenMap[symbol];
    if (!tokenId) throw new Error(`${symbol} not mapped in CoinGecko`);

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd&include_market_cap=false&include_24hr_vol=false&include_24hr_change=false`,
      { timeout: 5000 }
    );

    if (!response.ok) throw new Error(`CoinGecko API error: ${response.statusText}`);

    const data = await response.json();
    const price = data[tokenId]?.usd;

    if (!price || price <= 0) throw new Error(`Invalid price returned for ${symbol}`);
    return price;
  }

  /**
   * DeFiLlama API - High coverage, free, reliable
   */
  private async getPriceFromDeFiLlama(symbol: string): Promise<number> {
    const tokenMap: Record<string, string> = {
      'CELO': 'celo:0x471EcE3750Da237f93B8E339c536aB0ad0c12b514',
      'cUSD': 'celo:0x765DE816845861e75A25fCA122bb6CAA78443cb53',
      'cEUR': 'celo:0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6CA73',
      'USDT': 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7',
      'USDC': 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'DAI': 'ethereum:0x6b175474e89094c44da98b954eedeac495271d0f'
    };

    const tokenAddress = tokenMap[symbol];
    if (!tokenAddress) throw new Error(`${symbol} not mapped in DeFiLlama`);

    const response = await fetch(
      `https://coins.llama.fi/price/current/${tokenAddress}`,
      { timeout: 5000 }
    );

    if (!response.ok) throw new Error(`DeFiLlama API error: ${response.statusText}`);

    const data = await response.json();
    const price = data.coins?.[tokenAddress]?.price;

    if (!price || price <= 0) throw new Error(`Invalid price returned for ${symbol}`);
    return price;
  }

  /**
   * Chainlink On-Chain Oracle - Most reliable for major tokens
   */
  private async getPriceFromChainlink(symbol: string): Promise<number> {
    // Chainlink oracle addresses on Celo
    const chainlinkOracles: Record<string, { address: string; decimals: number }> = {
      'CELO': {
        address: '0x73a21b91ff537f1d33b38a2c3a0eb5296de659c0', // CELO/USD
        decimals: 8
      },
      'cUSD': {
        address: '0x85823F3F6611Ee4aae636260861e7de47D98d112', // cUSD/USD
        decimals: 8
      }
    };

    const oracle = chainlinkOracles[symbol];
    if (!oracle) throw new Error(`${symbol} not available on Chainlink`);

    const ABI = [
      'function latestAnswer() external view returns (int256)',
      'function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)'
    ];

    const contract = new ethers.Contract(oracle.address, ABI, this.provider);
    
    try {
      const [roundId, answer, startedAt, updatedAt, answeredInRound] = await contract.latestRoundData();
      
      // Validate the data is fresh (within last hour)
      const now = Math.floor(Date.now() / 1000);
      if (now - Number(updatedAt) > 3600) {
        throw new Error(`Chainlink price stale for ${symbol}`);
      }

      const price = Number(answer) / Math.pow(10, oracle.decimals);
      if (price <= 0) throw new Error(`Invalid Chainlink price for ${symbol}`);
      
      return price;
    } catch (error) {
      throw new Error(`Chainlink oracle call failed for ${symbol}: ${error}`);
    }
  }

  // Estimate gas for token transaction
  async estimateTokenGas(
    symbol: string,
    to: string,
    amount: string,
    from: string
  ): Promise<string> {
    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      throw new Error(`Token not supported: ${symbol}`);
    }

    if (symbol === 'CELO') {
      const gasEstimate = await this.provider.estimateGas({
        to,
        value: ethers.parseEther(amount),
        from
      });
      return gasEstimate.toString();
    }

    const contract = this.getTokenContract(symbol);
    if (!contract) {
      throw new Error(`Token contract not found for ${symbol}`);
    }

    const parsedAmount = ethers.parseUnits(amount, token.decimals);
    // Correct ethers v6 syntax for gas estimation
    const gasEstimate = await contract.transfer.estimateGas(to, parsedAmount);
    return gasEstimate.toString();
  }

  // Add new token via governance with real database integration
  async proposeNewToken(
    tokenInfo: TokenInfo,
    proposerId: string,
    description: string
  ): Promise<{ proposalId: string; blockNumber: number }> {
    // Validate token addresses
    if (!TokenRegistry.validateTokenAddress(tokenInfo.address.mainnet)) {
      throw new Error('Invalid mainnet token address');
    }
    if (!TokenRegistry.validateTokenAddress(tokenInfo.address.testnet)) {
      throw new Error('Invalid testnet token address');
    }

    // Get current block for voting end calculation
    const currentBlock = await this.provider.getBlockNumber();
    const votingDuration = 7 * 24 * 60 * 60; // 7 days in seconds
    const votingEndBlock = currentBlock + Math.ceil(votingDuration / 12); // ~12s per block on Celo

    const proposalData = {
      token_address: tokenInfo.address,
      token_name: tokenInfo.name,
      token_symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals,
      risk_level: tokenInfo.riskLevel,
      category: tokenInfo.category
    };

    // Get proposer details from database
    const [proposer] = await db
      .select()
      .from(users)
      .where(eq(users.id, proposerId))
      .limit(1);

    if (!proposer) throw new Error('Proposer not found');

    // Create governance proposal in database
    const [proposal] = await db
      .insert(governanceProposals)
      .values({
        id: crypto.randomUUID(),
        title: `Add ${tokenInfo.symbol} (${tokenInfo.name}) to Treasury`,
        description: description || `Governance proposal to add ${tokenInfo.name} (${tokenInfo.symbol}) to the token treasury`,
        proposerId: proposerId,
        proposalType: 'token_addition',
        details: JSON.stringify(proposalData),
        votingStartBlock: currentBlock,
        votingEndBlock: votingEndBlock,
        minQuorum: 4, // 4% of tokens
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Log proposal creation
    console.log(`📋 Created governance proposal: ${proposal.id} for ${tokenInfo.symbol}`);
    console.log(`   Voting ends at block: ${votingEndBlock} (~7 days)`);
    console.log(`   Proposed by: ${proposer.email || proposer.phone}`);

    return {
      proposalId: proposal.id,
      blockNumber: currentBlock
    };
  }

  // Get yield strategies for a specific token
  getYieldStrategiesForToken(symbol: string) {
    return Object.values(YIELD_STRATEGIES).filter(
      strategy => strategy.supportedTokens.includes(symbol) && strategy.isActive
    );
  }

  // Risk assessment for token operations
  assessTokenRisk(symbol: string, amount: string): {
    riskLevel: 'low' | 'medium' | 'high';
    warnings: string[];
    maxRecommendedAmount?: string;
  } {
    const token = TokenRegistry.getToken(symbol);
    if (!token) {
      return {
        riskLevel: 'high',
        warnings: ['Unknown token']
      };
    }

    const warnings: string[] = [];
    let riskLevel = token.riskLevel;

    // Check volume limits
    if (token.maxDailyVolume) {
      const maxVolume = parseFloat(token.maxDailyVolume);
      const requestedAmount = parseFloat(amount);

      if (requestedAmount > maxVolume) {
        warnings.push(`Amount exceeds daily volume limit of ${token.maxDailyVolume} ${symbol}`);
        riskLevel = 'high';
      }
    }

    // KYC requirements
    if (token.requiresKyc) {
      warnings.push('This token requires KYC verification');
    }

    // Bridged tokens have additional risk
    if (token.category === 'bridged') {
      warnings.push('Bridged tokens may have additional smart contract risks');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }

    return {
      riskLevel,
      warnings,
      maxRecommendedAmount: token.maxDailyVolume
    };
  }

  /**
   * Get vault share value by querying on-chain contract
   */
  async getVaultShareValue(vaultAddress: string, shares: string): Promise<number> {
    return executeWithRetry(async () => {
      // Vault ABI with share value calculation
      const vaultABI = [
        'function previewWithdraw(uint256 shares) external view returns (uint256)',
        'function totalAssets() external view returns (uint256)',
        'function totalSupply() external view returns (uint256)',
        'function asset() external view returns (address)',
        'function convertToAssets(uint256 shares) external view returns (uint256)'
      ];

      const vaultContract = new ethers.Contract(vaultAddress, vaultABI, this.provider);
      
      try {
        // Try ERC4626 standard convertToAssets if available
        const assetsValue = await vaultContract.convertToAssets(shares);
        return Number(ethers.formatEther(assetsValue));
      } catch {
        // Fallback: manual calculation
        const totalAssets = await vaultContract.totalAssets();
        const totalSupply = await vaultContract.totalSupply();
        
        if (totalSupply === 0n) {
          throw new Error('Vault has no shares issued');
        }

        const shareValue = (Number(totalAssets) * Number(shares)) / Number(totalSupply);
        return shareValue / 1e18; // Convert from wei
      }
    }, `getVaultShareValue(${vaultAddress}, ${shares})`);
  }

  /**
   * Get vault APY by calculating yield from recent returns
   */
  async getVaultAPY(vaultAddress: string): Promise<number> {
    return executeWithRetry(async () => {
      const vaultABI = [
        'function totalAssets() external view returns (uint256)',
        'function totalSupply() external view returns (uint256)',
        'function asset() external view returns (address)',
        'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
        'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)'
      ];

      const vaultContract = new ethers.Contract(vaultAddress, vaultABI, this.provider);

      try {
        // Get current vault state
        const currentAssets = await vaultContract.totalAssets();
        const currentSupply = await vaultContract.totalSupply();

        if (currentSupply === 0n || currentAssets === 0n) {
          return 0; // New vault, no history
        }

        // Get historical data from the last 30 days
        const currentBlock = await this.provider.getBlockNumber();
        const blocksPer30Days = Math.floor((30 * 24 * 60 * 60) / 12); // 12s blocks on Celo
        const historicalBlock = Math.max(0, currentBlock - blocksPer30Days);

        // Get vault state 30 days ago
        const historicalAssets = await vaultContract.totalAssets({ blockTag: historicalBlock });
        const historicalSupply = await vaultContract.totalSupply({ blockTag: historicalBlock });

        if (historicalSupply === 0n) {
          // Vault is too new, use 0 APY
          console.warn(`[APY] Vault ${vaultAddress} has no historical data`);
          return 0;
        }

        // Calculate share value change
        const historicalShareValue = Number(historicalAssets) / Number(historicalSupply);
        const currentShareValue = Number(currentAssets) / Number(currentSupply);
        const priceChange = currentShareValue - historicalShareValue;

        // Annualize the yield (30 days → 365 days)
        const annualizedYield = (priceChange / historicalShareValue) * (365 / 30) * 100;
        
        console.log(`[APY] ${vaultAddress.slice(0, 6)}... - 30 day yield: ${((priceChange / historicalShareValue) * 100).toFixed(2)}% → Annualized: ${annualizedYield.toFixed(2)}%`);
        
        return Math.max(0, annualizedYield); // Return 0 if negative yield
      } catch (error) {
        console.error(`[APY Calculation] Error for ${vaultAddress}:`, error);
        throw error;
      }
    }, `getVaultAPY(${vaultAddress})`);
  }

  /**
   * Get real token price from oracle - public wrapper
   */
  async getTokenPrice(symbol: string): Promise<number> {
    return this.getTokenPriceFromOracle(symbol);
  }

}
export const tokenService = new TokenService(
  process.env.RPC_URL || 'https://alfajores-forno.celo-testnet.org',
  process.env.MANAGER_PRIVATE_KEY,
  process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet'
);
