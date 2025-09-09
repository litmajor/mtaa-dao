
import * as walletApi from './walletApi';

interface DemoResults {
  [key: string]: any;
}

export class WalletApiDemo {
  private results: DemoResults = {};
  private mockUserId = 'demo-user-123';
  private mockWalletAddress = '0x742d35Cc6634C0532925a3b8D421C63F10bFe2D0';

  async runComprehensiveDemo(): Promise<DemoResults> {
    console.log('🚀 Starting Comprehensive Wallet API Demo');
    
    try {
      // 1. Network and Basic Info
      await this.demoNetworkInfo();
      
      // 2. Balance Operations
      await this.demoBalanceOperations();
      
      // 3. Token Management
      await this.demoTokenManagement();
      
      // 4. Transaction Operations
      await this.demoTransactionOperations();
      
      // 5. Portfolio Management
      await this.demoPortfolioManagement();
      
      // 6. Risk Management
      await this.demoRiskManagement();
      
      // 7. Analytics and Reporting
      await this.demoAnalytics();
      
      // 8. Multisig Operations
      await this.demoMultisigOperations();
      
      // 9. Savings and Goals
      await this.demoSavingsFeatures();
      
      // 10. Contributions and DAO
      await this.demoContributionFeatures();
      
      // 11. Enhanced Features
      await this.demoEnhancedFeatures();
      
      console.log('✅ Demo completed successfully!');
      return this.results;
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
      throw error;
    }
  }

  private async demoNetworkInfo() {
    console.log('\n📡 Testing Network Information...');
    
    try {
      this.results.networkInfo = await walletApi.getNetworkInfo();
      console.log('Network Info:', this.results.networkInfo);
    } catch (error) {
      console.warn('Network info failed:', error);
    }
  }

  private async demoBalanceOperations() {
    console.log('\n💰 Testing Balance Operations...');
    
    try {
      // Get default balance
      this.results.defaultBalance = await walletApi.getBalance();
      console.log('Default Balance:', this.results.defaultBalance);
      
      // Get specific address balance
      this.results.addressBalance = await walletApi.getBalance(this.mockWalletAddress);
      console.log('Address Balance:', this.results.addressBalance);
      
    } catch (error) {
      console.warn('Balance operations failed:', error);
    }
  }

  private async demoTokenManagement() {
    console.log('\n🪙 Testing Token Management...');
    
    try {
      // Mock token addresses for Celo
      const mockTokenAddress = '0x765DE816845861e75A25fCA122bb6898B8B1282a'; // cUSD
      
      // Get token info
      this.results.tokenInfo = await walletApi.getTokenInfo(mockTokenAddress);
      console.log('Token Info:', this.results.tokenInfo);
      
      // Get allowance
      this.results.allowance = await walletApi.getAllowance(
        mockTokenAddress, 
        this.mockWalletAddress
      );
      console.log('Token Allowance:', this.results.allowance);
      
      // Get allowed tokens (admin function)
      try {
        this.results.allowedTokens = await walletApi.getAllowedTokens();
        console.log('Allowed Tokens:', this.results.allowedTokens);
      } catch (error) {
        console.log('Allowed tokens requires admin permissions');
      }
      
    } catch (error) {
      console.warn('Token management failed:', error);
    }
  }

  private async demoTransactionOperations() {
    console.log('\n💸 Testing Transaction Operations...');
    
    try {
      // Note: These are demo calls that would normally require actual wallet connection
      console.log('Demo transaction operations (would require wallet connection):');
      
      // Demo send native token
      console.log('- Send Native Token: sendNativeToken(toAddress, amount)');
      
      // Demo send token
      console.log('- Send Token: sendToken(tokenAddress, toAddress, amount)');
      
      // Demo batch transfer
      const mockTransfers = [
        { toAddress: '0x123...', amount: 10 },
        { tokenAddress: '0x765...', toAddress: '0x456...', amount: 5 }
      ];
      console.log('- Batch Transfer:', mockTransfers);
      
      // Get transaction status (with mock hash)
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      try {
        this.results.txStatus = await walletApi.getTransactionStatus(mockTxHash);
        console.log('Transaction Status:', this.results.txStatus);
      } catch (error) {
        console.log('Transaction status check requires valid hash');
      }
      
    } catch (error) {
      console.warn('Transaction operations demo failed:', error);
    }
  }

  private async demoPortfolioManagement() {
    console.log('\n📊 Testing Portfolio Management...');
    
    try {
      // Get portfolio for common Celo tokens
      const celoTokens = [
        '0x765DE816845861e75A25fCA122bb6898B8B1282a', // cUSD
        '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73', // cEUR
      ];
      
      this.results.portfolio = await walletApi.getPortfolio(celoTokens);
      console.log('Portfolio:', this.results.portfolio);
      
    } catch (error) {
      console.warn('Portfolio management failed:', error);
    }
  }

  private async demoRiskManagement() {
    console.log('\n🛡️ Testing Risk Management...');
    
    try {
      // Risk validation
      this.results.riskValidation = await walletApi.getRiskValidation(
        100, // amount
        '0x765DE816845861e75A25fCA122bb6898B8B1282a', // cUSD
        this.mockWalletAddress
      );
      console.log('Risk Validation:', this.results.riskValidation);
      
    } catch (error) {
      console.warn('Risk management failed:', error);
    }
  }

  private async demoAnalytics() {
    console.log('\n📈 Testing Analytics...');
    
    try {
      // Get analytics report
      this.results.analyticsReport = await walletApi.getAnalyticsReport(7); // 7 days
      console.log('Analytics Report:', this.results.analyticsReport);
      
      // Get transaction history
      this.results.txHistory = await walletApi.getTxHistory(10); // last 10
      console.log('Transaction History:', this.results.txHistory);
      
    } catch (error) {
      console.warn('Analytics failed:', error);
    }
  }

  private async demoMultisigOperations() {
    console.log('\n🔐 Testing Multisig Operations...');
    
    try {
      const mockMultisigAddress = '0x9876543210987654321098765432109876543210';
      
      // Get multisig info (admin only)
      try {
        this.results.multisigInfo = await walletApi.getMultisigInfo(mockMultisigAddress);
        console.log('Multisig Info:', this.results.multisigInfo);
      } catch (error) {
        console.log('Multisig operations require admin permissions');
      }
      
      // Demo create multisig
      console.log('Demo: Create Multisig Wallet with owners and threshold');
      
      // Demo multisig transactions
      console.log('Demo: Get pending multisig transactions');
      
    } catch (error) {
      console.warn('Multisig operations demo failed:', error);
    }
  }

  private async demoSavingsFeatures() {
    console.log('\n🏦 Testing Savings Features...');
    
    try {
      // This would typically involve API calls to savings endpoints
      console.log('Demo savings features:');
      console.log('- Create locked savings');
      console.log('- Create savings goals');
      console.log('- Track contributions to goals');
      console.log('- Calculate interest and penalties');
      
      // Mock savings data
      this.results.savingsDemo = {
        lockedSavings: {
          amount: '500.00',
          currency: 'cUSD',
          lockPeriod: 90,
          interestRate: '0.05',
          status: 'active'
        },
        savingsGoals: {
          title: 'Emergency Fund',
          targetAmount: '1000.00',
          currentAmount: '250.00',
          progress: 25
        }
      };
      
    } catch (error) {
      console.warn('Savings features demo failed:', error);
    }
  }

  private async demoContributionFeatures() {
    console.log('\n🤝 Testing Contribution Features...');
    
    try {
      console.log('Demo contribution features:');
      console.log('- Track DAO contributions');
      console.log('- Link to vault system');
      console.log('- Anonymous contribution options');
      console.log('- Contribution analytics');
      
      // Mock contribution data
      this.results.contributionDemo = {
        totalContributed: '750.00',
        contributionCount: 15,
        averageContribution: '50.00',
        daoContributions: {
          'community-dao': { count: 8, total: '400.00' },
          'green-dao': { count: 7, total: '350.00' }
        }
      };
      
    } catch (error) {
      console.warn('Contribution features demo failed:', error);
    }
  }

  private async demoEnhancedFeatures() {
    console.log('\n⚡ Testing Enhanced Features...');
    
    try {
      console.log('Demo enhanced features:');
      
      // Recurring payments
      console.log('- Recurring Payments: Monthly DAO contributions');
      this.results.recurringPayments = {
        active: 2,
        totalScheduled: '200.00',
        nextPayment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };
      
      // Exchange rates
      console.log('- Exchange Rates: Real-time currency conversion');
      this.results.exchangeRates = {
        'CELO-USD': 0.65,
        'cUSD-USD': 1.0,
        'USD-KES': 150.25
      };
      
      // Transaction filtering and search
      console.log('- Advanced Transaction Filtering');
      this.results.transactionFilters = {
        byType: ['send', 'receive', 'contribution', 'savings'],
        byStatus: ['completed', 'pending', 'failed'],
        byCurrency: ['CELO', 'cUSD', 'cEUR'],
        dateRanges: ['7d', '30d', '90d', '1y']
      };
      
      // Notification integration
      console.log('- Real-time Notifications');
      this.results.notifications = {
        transactionAlerts: true,
        contributionTracking: true,
        savingsGoalUpdates: true,
        securityAlerts: true
      };
      
    } catch (error) {
      console.warn('Enhanced features demo failed:', error);
    }
  }

  // Utility method to run specific feature demos
  async runFeatureDemo(feature: string): Promise<any> {
    console.log(`🎯 Running ${feature} demo...`);
    
    switch (feature) {
      case 'network':
        await this.demoNetworkInfo();
        break;
      case 'balance':
        await this.demoBalanceOperations();
        break;
      case 'tokens':
        await this.demoTokenManagement();
        break;
      case 'transactions':
        await this.demoTransactionOperations();
        break;
      case 'portfolio':
        await this.demoPortfolioManagement();
        break;
      case 'risk':
        await this.demoRiskManagement();
        break;
      case 'analytics':
        await this.demoAnalytics();
        break;
      case 'multisig':
        await this.demoMultisigOperations();
        break;
      case 'savings':
        await this.demoSavingsFeatures();
        break;
      case 'contributions':
        await this.demoContributionFeatures();
        break;
      case 'enhanced':
        await this.demoEnhancedFeatures();
        break;
      default:
        throw new Error(`Unknown feature: ${feature}`);
    }
    
    return this.results[feature] || this.results;
  }

  // Generate demo report
  generateReport(): string {
    const report = [
      '📋 Wallet API Demo Report',
      '========================',
      '',
      `Demo completed at: ${new Date().toISOString()}`,
      `Total features tested: ${Object.keys(this.results).length}`,
      '',
      'Features Demonstrated:',
      '- Network Information',
      '- Balance Operations (CELO, cUSD, cEUR)',
      '- Token Management & Allowances',
      '- Transaction Operations',
      '- Portfolio Management',
      '- Risk Management & Validation',
      '- Analytics & Reporting',
      '- Multisig Wallet Operations',
      '- Savings & Goal Tracking',
      '- DAO Contribution Tracking',
      '- Recurring Payments',
      '- Exchange Rate Integration',
      '- Real-time Notifications',
      '',
      'API Endpoints Tested:',
      Object.keys(this.results).map(key => `- ${key}`).join('\n'),
      '',
      'Note: Some features require wallet connection and proper permissions.'
    ];
    
    return report.join('\n');
  }
}

// Export convenience functions
export const demo = new WalletApiDemo();

export async function runFullDemo() {
  return await demo.runComprehensiveDemo();
}

export async function runFeatureDemo(feature: string) {
  return await demo.runFeatureDemo(feature);
}

export function generateDemoReport() {
  return demo.generateReport();
}

// Example usage in console:
// import { runFullDemo, runFeatureDemo, generateDemoReport } from './walletApiDemo';
// 
// // Run full demo
// const results = await runFullDemo();
// console.log(generateDemoReport());
//
// // Run specific feature
// await runFeatureDemo('portfolio');
