import Web3 from 'web3';

const web3 = new Web3();
const account = web3.eth.accounts.create();
console.log('WALLET_PRIVATE_KEY=' + account.privateKey);
console.log('WALLET_ADDRESS=' + account.address);
