import AgentWallet, { NetworkConfig, WalletManager } from './agent_wallet';

// Replace with your actual private key for testing (never commit real keys!)
const PRIVATE_KEY = 'YOUR_PRIVATE_KEY';
const NETWORK = NetworkConfig.CELO_ALFAJORES; // or CELO_MAINNET, ETHEREUM_MAINNET

// Add your token contract addresses here (as strings)
const TOKEN_ADDRESSES: string[] = [
  // Example: '0xTokenAddress1',
  // Example: '0xTokenAddress2',
];

// Set recipient address and amount (in ether) for native token transfer
const RECIPIENT_ADDRESS = '0xRecipientAddressHere'; // Replace with a valid address
const SEND_AMOUNT = 0.01; // Amount in ether (testnet recommended)

// ERC-20 transfer, approval, and allowance test variables
const ERC20_TOKEN_ADDRESS = '0xTokenAddressHere'; // Replace with a valid ERC-20 token address
const ERC20_RECIPIENT = '0xRecipientAddressHere'; // Replace with a valid recipient address
const ERC20_SEND_AMOUNT = 1; // Amount in human units (e.g., 1 token)
const ERC20_SPENDER = '0xSpenderAddressHere'; // Replace with a valid spender address
const ERC20_APPROVE_AMOUNT = 5; // Amount to approve (in human units)

// Batch Transactions (scaffold) - move to top level to avoid function-in-block error
export async function sendBatchNativeTransfers(wallet: any, recipients: { address: string, amount: number }[]) {
  for (const { address, amount } of recipients) {
    try {
      const tx = await wallet.sendNativeToken(address, amount);
      console.log(`Sent ${amount} ether to ${address}: ${tx.hash}`);
    } catch (err) {
      console.error(`Batch transfer error for ${address}:`, err);
    }
  }
}

async function main() {
  try {
    const wallet = new AgentWallet(PRIVATE_KEY, NETWORK.rpcUrl, NETWORK.chainId);
    console.log('Wallet address:', wallet.address);

    const networkInfo = await wallet.getNetworkInfo();
    console.log('Network info:', networkInfo);

    // Fetch and log native token balance
    const balanceWei = await wallet.getBalance();
    const balanceEth = await wallet.getBalanceEth();
    console.log(`Native token balance: ${balanceWei.toString()} wei (${balanceEth} ether)`);

    // Fetch and log ERC-20 token info and balances
    if (TOKEN_ADDRESSES.length > 0) {
      for (const tokenAddress of TOKEN_ADDRESSES) {
        try {
          const tokenInfo = await wallet.getTokenInfo(tokenAddress);
          console.log(`Token: ${tokenInfo.name} (${tokenInfo.symbol})`);
          console.log(`  Address: ${tokenInfo.address}`);
          console.log(`  Decimals: ${tokenInfo.decimals}`);
          console.log(`  Balance: ${tokenInfo.balance} (${tokenInfo.balanceFormatted} ${tokenInfo.symbol})`);
        } catch (err) {
          console.error(`Error fetching token info for ${tokenAddress}:`, err);
        }
      }
    } else {
      console.log('No token addresses provided. Add ERC-20 addresses to TOKEN_ADDRESSES array to test.');
    }

    // Native token transfer example
    if (RECIPIENT_ADDRESS && RECIPIENT_ADDRESS !== '0xRecipientAddressHere') {
      try {
        console.log(`\nSending ${SEND_AMOUNT} ether to ${RECIPIENT_ADDRESS}...`);
        const txResult = await wallet.sendNativeToken(RECIPIENT_ADDRESS, SEND_AMOUNT);
        console.log('Native token transfer tx hash:', txResult.hash);
        console.log('Status:', txResult.status);
      } catch (err) {
        console.error('Error sending native token:', err);
      }
    } else {
      console.log('\nSet RECIPIENT_ADDRESS to a valid address to test native token transfer.');
    }

    // ERC-20 token transfer example
    if (
      ERC20_TOKEN_ADDRESS !== '0xTokenAddressHere' &&
      ERC20_RECIPIENT !== '0xRecipientAddressHere'
    ) {
      try {
        console.log(`\nSending ${ERC20_SEND_AMOUNT} tokens to ${ERC20_RECIPIENT} from ${ERC20_TOKEN_ADDRESS}...`);
        const txResult = await wallet.sendTokenHuman(ERC20_TOKEN_ADDRESS, ERC20_RECIPIENT, ERC20_SEND_AMOUNT);
        console.log('ERC-20 token transfer tx hash:', txResult.hash);
        console.log('Status:', txResult.status);
      } catch (err) {
        console.error('Error sending ERC-20 token:', err);
      }
    } else {
      console.log('\nSet ERC20_TOKEN_ADDRESS and ERC20_RECIPIENT to valid addresses to test ERC-20 token transfer.');
    }

    // ERC-20 token approval example
    if (
      ERC20_TOKEN_ADDRESS !== '0xTokenAddressHere' &&
      ERC20_SPENDER !== '0xSpenderAddressHere'
    ) {
      try {
        console.log(`\nApproving ${ERC20_APPROVE_AMOUNT} tokens for ${ERC20_SPENDER} on ${ERC20_TOKEN_ADDRESS}...`);
        const txResult = await wallet.approveToken(ERC20_TOKEN_ADDRESS, ERC20_SPENDER, ERC20_APPROVE_AMOUNT);
        console.log('ERC-20 token approval tx hash:', txResult.hash);
        console.log('Status:', txResult.status);
      } catch (err) {
        console.error('Error approving ERC-20 token:', err);
      }
    } else {
      console.log('\nSet ERC20_TOKEN_ADDRESS and ERC20_SPENDER to valid addresses to test ERC-20 token approval.');
    }

    // ERC-20 token allowance check example
    if (
      ERC20_TOKEN_ADDRESS !== '0xTokenAddressHere' &&
      ERC20_SPENDER !== '0xSpenderAddressHere'
    ) {
      try {
        console.log(`\nChecking allowance for ${ERC20_SPENDER} on ${ERC20_TOKEN_ADDRESS}...`);
        const allowance = await wallet.getAllowance(ERC20_TOKEN_ADDRESS, ERC20_SPENDER);
        console.log(`Allowance: ${allowance}`);
      } catch (err) {
        console.error('Error checking ERC-20 allowance:', err);
      }
    } else {
      console.log('\nSet ERC20_TOKEN_ADDRESS and ERC20_SPENDER to valid addresses to test ERC-20 allowance check.');
    }
    // Transaction status and monitoring examples
    // Set a transaction hash to test these features
    const TX_HASH = '0xTransactionHashHere'; // Replace with a real transaction hash

    // Wait for transaction confirmation
    if (TX_HASH !== '0xTransactionHashHere') {
      try {
        console.log(`\nWaiting for transaction confirmation: ${TX_HASH}`);
        const txResult = await wallet.waitForTransaction(TX_HASH);
        console.log('Transaction confirmation result:', txResult);
      } catch (err) {
        console.error('Error waiting for transaction confirmation:', err);
      }
    } else {
      console.log('\nSet TX_HASH to a real transaction hash to test waitForTransaction.');
    }

    // Get transaction status by hash
    if (TX_HASH !== '0xTransactionHashHere') {
      try {
        console.log(`\nGetting transaction status for: ${TX_HASH}`);
        const txStatus = await wallet.getTransactionStatus(TX_HASH);
        console.log('Transaction status:', txStatus);
      } catch (err) {
        console.error('Error getting transaction status:', err);
      }
    } else {
      console.log('\nSet TX_HASH to a real transaction hash to test getTransactionStatus.');
    }
    // Portfolio overview example
    if (TOKEN_ADDRESSES.length > 0) {
      try {
        console.log('\nFetching portfolio overview...');
        const portfolio = await wallet.getPortfolio(TOKEN_ADDRESSES);
        console.log('Portfolio:', JSON.stringify(portfolio, null, 2));
      } catch (err) {
        console.error('Error fetching portfolio:', err);
      }
    } else {
      console.log('\nSet TOKEN_ADDRESSES to fetch portfolio overview.');
    }

    // Wallet utilities
    // Create a new wallet
    const newWallet = WalletManager.createWallet();
    if (newWallet) {
      console.log('\nNew wallet created:', newWallet);
    } else {
      console.log('\nWalletManager.createWallet not available.');
    }

    // Validate address
    const testAddress = newWallet?.address || '0x0000000000000000000000000000000000000000';
    const isValid = WalletManager.validateAddress(testAddress);
    console.log(`\nAddress ${testAddress} is valid:`, isValid);

    // Validate private key
    const testPrivateKey = newWallet?.privateKey || '0x';
    const isPKValid = WalletManager.validatePrivateKey(testPrivateKey);
    console.log(`Private key is valid:`, isPKValid);

    // Mnemonic support (will throw if not supported)
    try {
      const mnemonic = 'test test test test test test test test test test test junk';
      const mnemonicWallet = WalletManager.fromMnemonic(mnemonic);
      if (mnemonicWallet) {
        console.log('\nWallet from mnemonic:', mnemonicWallet);
      } else {
        console.log('\nMnemonic wallet creation not available.');
      }
    } catch (err) {
      console.error('Mnemonic wallet creation error:', err);
    }

    // =====================
    // Batch 4: Advanced Features
    // =====================

    // 1. Event/Log Monitoring (scaffold)
    // Example: Listen for Transfer events on an ERC-20 token
    if (ERC20_TOKEN_ADDRESS !== '0xTokenAddressHere') {
      try {
        const web3 = (wallet as any).web3;
        const contract = new web3.eth.Contract((wallet as any).constructor.ERC20_ABI || [], ERC20_TOKEN_ADDRESS);
        console.log(`\nListening for Transfer events on ${ERC20_TOKEN_ADDRESS} (Ctrl+C to stop)...`);
        contract.events.Transfer({})
          .on('data', (event: any) => {
            console.log('Transfer event:', event.returnValues);
          })
          .on('error', (err: any) => {
            console.error('Event error:', err);
          });
        // Note: This will keep the process running. In production, run in a separate process or with a timeout.
      } catch (err) {
        console.error('Error setting up event monitoring:', err);
      }
    } else {
      console.log('\nSet ERC20_TOKEN_ADDRESS to listen for events.');
    }

    // 2. Batch Transactions (scaffold)
    // Usage example (uncomment and fill addresses to test):
    // await sendBatchNativeTransfers(wallet, [
    //   { address: '0x...', amount: 0.01 },
    //   { address: '0x...', amount: 0.02 },
    // ]);

    // 3. Gas Estimation & Fee Analytics (scaffold)
    // Example: Estimate gas for a native token transfer
    if (RECIPIENT_ADDRESS && RECIPIENT_ADDRESS !== '0xRecipientAddressHere') {
      try {
        const txConfig = {
          to: RECIPIENT_ADDRESS,
          value: (wallet as any).web3.utils.toWei(SEND_AMOUNT.toString(), 'ether'),
        };
        const gas = await (wallet as any).web3.eth.estimateGas(txConfig);
        const gasPrice = await (wallet as any).web3.eth.getGasPrice();
        const feeEth = (Number(gas) * Number(gasPrice)) / 1e18;
        console.log(`\nEstimated gas: ${gas}, gas price: ${gasPrice}, fee: ${feeEth} ether`);
      } catch (err) {
        console.error('Gas estimation error:', err);
      }
    }

    // 4. Multi-sig Wallet Support (placeholder)
    // Note: Full multi-sig support requires integration with a multi-sig contract or SDK (e.g., Gnosis Safe)
    // Scaffold: Document integration point
    console.log('\n[Multi-sig Wallet Support] To integrate, use a multi-sig SDK or contract interaction here.');
  } catch (error) {
    console.error('Error initializing wallet or fetching network info:', error);
  }
}

main();
