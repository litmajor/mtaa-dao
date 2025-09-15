// Phase 3: Enhanced Token Service with multi-token support
import { ethers } from 'ethers';
import { TOKEN_REGISTRY, TokenInfo, TokenRegistry, YIELD_STRATEGIES } from '../../shared/tokenRegistry';

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
    this.provider = new ethers.JsonRpcProvider(providerUrl);
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

  // Get token balance for an address
  async getTokenBalance(symbol: string, address: string): Promise<string> {
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

  // Get multiple token balances for portfolio view
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
          // TODO: Integrate with price oracle for USD values
          const mockPriceUSD = this.getMockPrice(token.symbol);
          const balanceUSD = (balanceNum * mockPriceUSD).toFixed(2);

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

  // Mock price function - replace with real price oracle in production
  private getMockPrice(symbol: string): number {
    const mockPrices: Record<string, number> = {
      'CELO': 0.65,
      'cUSD': 1.00,
      'cEUR': 1.08,
      'USDT': 1.00,
      'MTAA': 0.10
    };
    return mockPrices[symbol] || 0;
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

  // Add new token via governance (Phase 3)
  async proposeNewToken(tokenInfo: TokenInfo): Promise<void> {
    // This would integrate with the DAO governance system
    // For now, just validate and store
    if (!TokenRegistry.validateTokenAddress(tokenInfo.address.mainnet) ||
        !TokenRegistry.validateTokenAddress(tokenInfo.address.testnet)) {
      throw new Error('Invalid token addresses');
    }

    // TODO: Create governance proposal for token addition
    console.log(`Proposing new token: ${tokenInfo.symbol}`);
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

  // Get vault share value in USD
  async getVaultShareValue(vaultAddress: string, shares: string): Promise<number> {
    try {
      // For demo purposes, calculate based on a fixed share price
      const sharePrice = 1.25; // $1.25 per share
      const shareCount = parseFloat(shares) / 1e18; // Convert from wei
      return shareCount * sharePrice;
    } catch (error) {
      console.error(`Failed to get vault share value: ${error.message}`, error);
      return 0;
    }
  }

  // Get vault APY (Annual Percentage Yield)
  async getVaultAPY(vaultAddress: string): Promise<number> {
    try {
      // For demo purposes, return a fixed APY with some variation
      const baseAPY = 8.5;
      const variation = (Math.random() - 0.5) * 2; // ±1% variation
      return Math.max(baseAPY + variation, 0);
    } catch (error) {
      console.error(`Failed to get vault APY: ${error.message}`, error);
      return 8.5; // Default APY
    }
  }

  // Export singleton instance
  export const tokenService = new TokenService(
    process.env.RPC_URL || 'https://alfajores-forno.celo-testnet.org',
    process.env.MANAGER_PRIVATE_KEY,
    process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet'
  );
}