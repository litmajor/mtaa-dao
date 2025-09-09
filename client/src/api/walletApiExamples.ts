
import * as walletApi from './walletApi';

/**
 * Practical examples showing how to use the Wallet API in real scenarios
 */

// Example 1: Complete wallet setup flow
export async function exampleWalletSetup(userId: string) {
  console.log('🔧 Setting up wallet for user:', userId);
  
  try {
    // 1. Get network information
    const networkInfo = await walletApi.getNetworkInfo();
    console.log('Connected to network:', networkInfo.name);
    
    // 2. Check initial balance
    const balance = await walletApi.getBalance();
    console.log('Initial balance:', balance);
    
    // 3. Get supported tokens
    const allowedTokens = await walletApi.getAllowedTokens();
    console.log('Supported tokens:', allowedTokens);
    
    return { networkInfo, balance, allowedTokens };
  } catch (error) {
    console.error('Wallet setup failed:', error);
    throw error;
  }
}

// Example 2: Send money with risk validation
export async function exampleSendMoney(toAddress: string, amount: number, tokenAddress?: string) {
  console.log('💸 Sending money with safety checks...');
  
  try {
    // 1. Validate the transaction first
    const riskCheck = await walletApi.getRiskValidation(amount, tokenAddress, toAddress);
    console.log('Risk validation:', riskCheck);
    
    if (!riskCheck.isValid) {
      throw new Error(`Transaction blocked: ${riskCheck.reason}`);
    }
    
    // 2. Send the transaction
    let result;
    if (tokenAddress) {
      result = await walletApi.sendToken(tokenAddress, toAddress, amount);
    } else {
      result = await walletApi.sendNativeToken(toAddress, amount);
    }
    
    console.log('Transaction sent:', result);
    
    // 3. Monitor transaction status
    if (result.hash) {
      const status = await walletApi.getTransactionStatus(result.hash);
      console.log('Transaction status:', status);
    }
    
    return result;
  } catch (error) {
    console.error('Send money failed:', error);
    throw error;
  }
}

// Example 3: Portfolio management and analytics
export async function examplePortfolioAnalysis() {
  console.log('📊 Analyzing portfolio...');
  
  try {
    // 1. Get portfolio data
    const celoTokens = [
      '0x765DE816845861e75A25fCA122bb6898B8B1282a', // cUSD
      '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73', // cEUR
    ];
    
    const portfolio = await walletApi.getPortfolio(celoTokens);
    console.log('Portfolio snapshot:', portfolio);
    
    // 2. Get analytics report
    const analytics = await walletApi.getAnalyticsReport(30); // 30 days
    console.log('30-day analytics:', analytics);
    
    // 3. Get transaction history
    const txHistory = await walletApi.getTxHistory(20);
    console.log('Recent transactions:', txHistory);
    
    // 4. Calculate portfolio insights
    const insights = {
      totalValue: portfolio.totalValue || 0,
      transactionCount: txHistory.length,
      averageTransaction: txHistory.length > 0 ? 
        txHistory.reduce((sum: number, tx: { amount?: string }) => sum + parseFloat(tx.amount || '0'), 0) / txHistory.length : 0,
      mostActiveToken: analytics.tokenBreakdown ? 
        Object.keys(analytics.tokenBreakdown).reduce((a, b) => 
          analytics.tokenBreakdown[a] > analytics.tokenBreakdown[b] ? a : b) : 'N/A'
    };
    
    console.log('Portfolio insights:', insights);
    return { portfolio, analytics, txHistory, insights };
    
  } catch (error) {
    console.error('Portfolio analysis failed:', error);
    throw error;
  }
}

// Example 4: DAO contribution workflow
export async function exampleDaoContribution(daoId: string, amount: number, currency = 'cUSD') {
  console.log('🤝 Contributing to DAO:', daoId);
  
  try {
    // 1. Get current contribution history
    const userId = 'current-user'; // Would come from auth context
    // Note: This would be an API call to get contributions
    console.log('Fetching contribution history...');
    
    // 2. Validate contribution amount
    const riskCheck = await walletApi.getRiskValidation(amount);
    if (!riskCheck.isValid) {
      throw new Error('Contribution amount validation failed');
    }
    
    // 3. Process contribution (would involve actual transaction)
    console.log(`Contributing ${amount} ${currency} to DAO ${daoId}`);
    
    // 4. Track contribution analytics
    const contributionData = {
      daoId,
      amount,
      currency,
      timestamp: new Date().toISOString(),
      type: 'dao-contribution'
    };
    
    console.log('Contribution recorded:', contributionData);
    return contributionData;
    
  } catch (error) {
    console.error('DAO contribution failed:', error);
    throw error;
  }
}

// Example 5: Multisig treasury management
export async function exampleMultisigManagement(multisigAddress: string) {
  console.log('🔐 Managing multisig treasury...');
  
  try {
    // 1. Get multisig information
    const multisigInfo = await walletApi.getMultisigInfo(multisigAddress);
    console.log('Multisig details:', multisigInfo);
    
    // 2. Get pending transactions
    const pendingTxs = await walletApi.getMultisigTransactions(multisigAddress, true);
    console.log('Pending transactions:', pendingTxs);
    
    // 3. Create a new multisig wallet (admin function)
    const owners = ['0x123...', '0x456...', '0x789...'];
    const threshold = 2;
    
    try {
      const newMultisig = await walletApi.createMultisigWallet(owners, threshold);
      console.log('New multisig created:', newMultisig);
    } catch (error) {
      console.log('Creating multisig requires admin permissions');
    }
    
    return { multisigInfo, pendingTxs };
    
  } catch (error) {
    console.error('Multisig management failed:', error);
    throw error;
  }
}

// Example 6: Savings and goals management
export async function exampleSavingsManagement(userId: string) {
  console.log('🏦 Managing savings and goals...');
  
  try {
    // This example shows the structure for savings management
    // In a real implementation, these would be API calls
    
    const savingsData = {
      lockedSavings: [
        {
          amount: '500.00',
          currency: 'cUSD',
          lockPeriod: 90,
          interestRate: '0.05',
          unlocksAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          status: 'active'
        }
      ],
      savingsGoals: [
        {
          title: 'Emergency Fund',
          targetAmount: '1000.00',
          currentAmount: '250.00',
          targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          category: 'emergency'
        }
      ]
    };
    
    console.log('Savings overview:', savingsData);
    
    // Calculate savings insights
    const insights = {
      totalSaved: savingsData.lockedSavings.reduce((sum, saving) => 
        sum + parseFloat(saving.amount), 0),
      goalsProgress: savingsData.savingsGoals.map(goal => ({
        title: goal.title,
        progress: (parseFloat(goal.currentAmount) / parseFloat(goal.targetAmount)) * 100
      })),
      projectedEarnings: savingsData.lockedSavings.reduce((sum, saving) => 
        sum + (parseFloat(saving.amount) * parseFloat(saving.interestRate)), 0)
    };
    
    console.log('Savings insights:', insights);
    return { savingsData, insights };
    
  } catch (error) {
    console.error('Savings management failed:', error);
    throw error;
  }
}

// Example 7: Batch operations
export async function exampleBatchOperations() {
  console.log('⚡ Performing batch operations...');
  
  try {
    // 1. Batch transfers
    const transfers = [
      { toAddress: '0x123...', amount: 10 }, // Native token
      { tokenAddress: '0x765...', toAddress: '0x456...', amount: 5 }, // cUSD
      { tokenAddress: '0xD87...', toAddress: '0x789...', amount: 3 }  // cEUR
    ];
    
    const batchResult = await walletApi.batchTransfer(transfers);
    console.log('Batch transfer result:', batchResult);
    
    // 2. Token approvals for multiple spenders
    const approvals = [
      { tokenAddress: '0x765...', spender: '0xabc...', amount: 100 },
      { tokenAddress: '0xD87...', spender: '0xdef...', amount: 50 }
    ];
    
    for (const approval of approvals) {
      try {
        const result = await walletApi.approveToken(
          approval.tokenAddress, 
          approval.spender, 
          approval.amount
        );
        console.log('Token approved:', result);
      } catch (error) {
        console.warn('Approval failed:', error);
      }
    }
    
    return { batchResult, approvals };
    
  } catch (error) {
    console.error('Batch operations failed:', error);
    throw error;
  }
}

// Example 8: Real-time monitoring
export async function exampleRealTimeMonitoring(walletAddress: string) {
  console.log('📡 Setting up real-time monitoring...');
  
  try {
    // 1. Monitor balance changes
    const initialBalance = await walletApi.getBalance(walletAddress);
    console.log('Initial balance:', initialBalance);
    
    // 2. Set up periodic checks (in a real app, you'd use WebSockets or SSE)
    const monitoringInterval = setInterval(async () => {
      try {
        const currentBalance = await walletApi.getBalance(walletAddress);
        
        // Check for balance changes
        if (currentBalance.balance !== initialBalance.balance) {
          console.log('Balance changed!', {
            old: initialBalance.balance,
            new: currentBalance.balance
          });
        }
        
        // Get recent transactions
        const recentTxs = await walletApi.getTxHistory(5);
        console.log('Recent activity:', recentTxs.length, 'transactions');
        
      } catch (error) {
        console.warn('Monitoring check failed:', error);
      }
    }, 30000); // Check every 30 seconds
    
    // Clean up after 5 minutes
    setTimeout(() => {
      clearInterval(monitoringInterval);
      console.log('Monitoring stopped');
    }, 5 * 60 * 1000);
    
    return { monitoringActive: true, checkInterval: 30000 };
    
  } catch (error) {
    console.error('Real-time monitoring setup failed:', error);
    throw error;
  }
}

// Export all examples for easy access
export const examples = {
  walletSetup: exampleWalletSetup,
  sendMoney: exampleSendMoney,
  portfolioAnalysis: examplePortfolioAnalysis,
  daoContribution: exampleDaoContribution,
  multisigManagement: exampleMultisigManagement,
  savingsManagement: exampleSavingsManagement,
  batchOperations: exampleBatchOperations,
  realTimeMonitoring: exampleRealTimeMonitoring
};

// Usage instructions
export const USAGE_INSTRUCTIONS = `
Wallet API Examples Usage:

1. Basic Setup:
   import { examples } from './walletApiExamples';
   await examples.walletSetup('user-123');

2. Send Money Safely:
   await examples.sendMoney('0x123...', 10.5, '0x765...');

3. Analyze Portfolio:
   const analysis = await examples.portfolioAnalysis();

4. DAO Contribution:
   await examples.daoContribution('community-dao', 50);

5. Multisig Management:
   await examples.multisigManagement('0xabc...');

6. Savings Management:
   await examples.savingsManagement('user-123');

7. Batch Operations:
   await examples.batchOperations();

8. Real-time Monitoring:
   await examples.realTimeMonitoring('0x123...');

Each example includes error handling and logging for educational purposes.
`;
