"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var agent_wallet_1 = require("../server/agent_wallet");
var wallet = agent_wallet_1.WalletManager.createWallet();
console.log('New wallet generated:');
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
