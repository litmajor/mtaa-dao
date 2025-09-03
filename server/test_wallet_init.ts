import AgentWallet, { NetworkConfig, WalletManager } from './agent_wallet';
// NOTE: Some dependencies in the project are deprecated (see npm warnings).
// TODO: Update project dependencies in package.json to replace deprecated packages (e.g., inflight, lodash.isequal, glob, @esbuild-kit/*, @paulmillr/qr).
// For deep equality, use: require('node:util').isDeepStrictEqual instead of lodash.isequal.

// Load private key from environment variable for security
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
if (!PRIVATE_KEY || PRIVATE_KEY === 'YOUR_PRIVATE_KEY') {
  throw new Error('Please set a valid PRIVATE_KEY environment variable.');
}
const NETWORK = NetworkConfig.CELO_ALFAJORES; // or CELO_MAINNET, ETHEREUM_MAINNET

// Add your token contract addresses here (as strings)
const TOKEN_ADDRESSES: string[] = [
  // Example: '0xTokenAddress1',
  // Example: '0xTokenAddress2',
]; // TODO: Add valid ERC-20 token addresses for testing.

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
  // Pass the NetworkConfig object directly, not its properties
  const wallet = new AgentWallet(PRIVATE_KEY, NETWORK);
    console.log('Wallet address:', wallet.address);

    const networkInfo = await wallet.getNetworkInfo();
    console.log('Network info:', networkInfo);
  } catch (error) {
    console.error('Error initializing wallet or fetching network info:', error);
  }
}

main();
