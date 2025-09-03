import { WalletManager } from '../server/agent_wallet.ts';

const wallet = WalletManager.createWallet();
console.log('New wallet generated:');
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey); // WARNING: Do not expose this in production!