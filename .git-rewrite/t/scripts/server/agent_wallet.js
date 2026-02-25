"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionAnalytics = exports.RiskManager = exports.DaoTreasuryManager = exports.WalletManager = exports.NetworkConfig = exports.EnhancedAgentWallet = void 0;
exports.enhancedExample = enhancedExample;
var web3_1 = require("web3");
// Enhanced ERC20 ABI with additional useful functions
var ENHANCED_ERC20_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{ "name": "", "type": "string" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{ "name": "", "type": "string" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "_to", "type": "address" },
            { "name": "_value", "type": "uint256" }
        ],
        "name": "transfer",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "_spender", "type": "address" },
            { "name": "_value", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            { "name": "_owner", "type": "address" },
            { "name": "_spender", "type": "address" }
        ],
        "name": "allowance",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "_from", "type": "address" },
            { "name": "_to", "type": "address" },
            { "name": "_value", "type": "uint256" }
        ],
        "name": "transferFrom",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    }
];
// Multisig Wallet ABI (basic functions)
var MULTISIG_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "getOwners",
        "outputs": [{ "name": "", "type": "address[]" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "required",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "destination", "type": "address" },
            { "name": "value", "type": "uint256" },
            { "name": "data", "type": "bytes" }
        ],
        "name": "submitTransaction",
        "outputs": [{ "name": "transactionId", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{ "name": "transactionId", "type": "uint256" }],
        "name": "confirmTransaction",
        "outputs": [],
        "type": "function"
    }
];
var EnhancedAgentWallet = /** @class */ (function () {
    function EnhancedAgentWallet(privateKey, networkConfig, permissionCheck, contributionLogger, billingLogger, priceOracle) {
        this.transactionCache = new Map();
        this.web3 = new web3_1.default(networkConfig.rpcUrl);
        this.networkConfig = networkConfig;
        // Ensure private key has 0x prefix
        if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
        }
        this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        this.chainId = networkConfig.chainId;
        this.permissionCheck = permissionCheck;
        this.contributionLogger = contributionLogger;
        this.billingLogger = billingLogger;
        this.priceOracle = priceOracle;
    }
    /**
     * Approve a spender to spend a specified amount of ERC-20 tokens.
     * @param tokenAddress ERC-20 token contract address
     * @param spender Spender address
     * @param amount Amount in human units (not wei)
     * @param gasConfig Optional gas config
     */
    EnhancedAgentWallet.prototype.approveToken = function (tokenAddress, spender, amount, gasConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var tokenInfo, amountWei, contract, nonce, optimalGasConfig, _a, transaction, _b, signedTxn, txHash, result, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.web3.utils.isAddress(tokenAddress)) {
                            throw new Error('Invalid token address');
                        }
                        if (!this.web3.utils.isAddress(spender)) {
                            throw new Error('Invalid spender address');
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 9, , 10]);
                        return [4 /*yield*/, this.getTokenInfo(tokenAddress)];
                    case 2:
                        tokenInfo = _c.sent();
                        amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
                        contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
                        return [4 /*yield*/, this.web3.eth.getTransactionCount(this.account.address)];
                    case 3:
                        nonce = _c.sent();
                        _a = gasConfig;
                        if (_a) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.getOptimalGasConfig()];
                    case 4:
                        _a = (_c.sent());
                        _c.label = 5;
                    case 5:
                        optimalGasConfig = _a;
                        transaction = __assign({ to: tokenAddress, data: contract.methods.approve(spender, amountWei.toString()).encodeABI(), chainId: this.chainId, gas: 100000, nonce: Number(nonce) }, optimalGasConfig);
                        _b = transaction;
                        return [4 /*yield*/, this.estimateGasWithBuffer(transaction)];
                    case 6:
                        _b.gas = _c.sent();
                        return [4 /*yield*/, this.account.signTransaction(transaction)];
                    case 7:
                        signedTxn = _c.sent();
                        return [4 /*yield*/, this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction)];
                    case 8:
                        txHash = _c.sent();
                        console.log("Token approval sent: ".concat(txHash.transactionHash));
                        result = {
                            hash: typeof txHash.transactionHash === 'string' ? txHash.transactionHash : '',
                            status: 'pending',
                            timestamp: Date.now()
                        };
                        this.transactionCache.set(result.hash, result);
                        return [2 /*return*/, result];
                    case 9:
                        error_1 = _c.sent();
                        console.error('Token approval failed:', error_1);
                        throw new Error("Token approval failed: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get the allowance for a spender on an ERC-20 token.
     * @param tokenAddress ERC-20 token contract address
     * @param spender Spender address
     * @returns Allowance in human units
     */
    EnhancedAgentWallet.prototype.getAllowance = function (tokenAddress, spender) {
        return __awaiter(this, void 0, void 0, function () {
            var contract, tokenInfo, allowance, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.web3.utils.isAddress(tokenAddress)) {
                            throw new Error('Invalid token address');
                        }
                        if (!this.web3.utils.isAddress(spender)) {
                            throw new Error('Invalid spender address');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
                        return [4 /*yield*/, this.getTokenInfo(tokenAddress)];
                    case 2:
                        tokenInfo = _a.sent();
                        return [4 /*yield*/, contract.methods.allowance(this.account.address, spender).call()];
                    case 3:
                        allowance = _a.sent();
                        return [2 /*return*/, Number(allowance) / Math.pow(10, tokenInfo.decimals)];
                    case 4:
                        error_2 = _a.sent();
                        throw new Error("Failed to get allowance: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)));
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get the status of a transaction by hash.
     * @param txHash Transaction hash
     * @returns TransactionResult with status
     */
    EnhancedAgentWallet.prototype.getTransactionStatus = function (txHash) {
        return __awaiter(this, void 0, void 0, function () {
            var receipt, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.web3.eth.getTransactionReceipt(txHash)];
                    case 1:
                        receipt = _a.sent();
                        if (!receipt) {
                            return [2 /*return*/, {
                                    hash: txHash,
                                    status: 'pending',
                                    timestamp: Date.now()
                                }];
                        }
                        return [2 /*return*/, {
                                hash: txHash,
                                status: receipt.status ? 'success' : 'failed',
                                blockNumber: Number(receipt.blockNumber),
                                gasUsed: Number(receipt.gasUsed),
                                effectiveGasPrice: receipt.effectiveGasPrice ? Number(receipt.effectiveGasPrice) : undefined,
                                timestamp: Date.now()
                            }];
                    case 2:
                        error_3 = _a.sent();
                        return [2 /*return*/, {
                                hash: txHash,
                                status: 'failed',
                                errorReason: error_3 instanceof Error ? error_3.message : String(error_3),
                                timestamp: Date.now()
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Enhanced balance operations
    EnhancedAgentWallet.prototype.getBalance = function () {
        return __awaiter(this, void 0, void 0, function () {
            var balance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.web3.eth.getBalance(this.account.address)];
                    case 1:
                        balance = _a.sent();
                        return [2 /*return*/, BigInt(balance)];
                }
            });
        });
    };
    EnhancedAgentWallet.prototype.getBalanceCelo = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var targetAddress, balance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        targetAddress = address || this.account.address;
                        return [4 /*yield*/, this.web3.eth.getBalance(targetAddress)];
                    case 1:
                        balance = _a.sent();
                        return [2 /*return*/, parseFloat(this.web3.utils.fromWei(balance, 'ether'))];
                }
            });
        });
    };
    EnhancedAgentWallet.prototype.getBalanceEth = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var targetAddress, balance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        targetAddress = address || this.account.address;
                        return [4 /*yield*/, this.web3.eth.getBalance(targetAddress)];
                    case 1:
                        balance = _a.sent();
                        return [2 /*return*/, parseFloat(this.web3.utils.fromWei(balance, 'ether'))];
                }
            });
        });
    };
    EnhancedAgentWallet.prototype.getNetworkInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, latestBlock, gasPrice, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Promise.all([
                                this.web3.eth.getBlockNumber(),
                                this.web3.eth.getGasPrice()
                            ])];
                    case 1:
                        _a = _b.sent(), latestBlock = _a[0], gasPrice = _a[1];
                        return [2 /*return*/, {
                                chainId: this.chainId,
                                latestBlock: Number(latestBlock),
                                gasPrice: Number(gasPrice),
                                connected: true,
                                networkName: this.networkConfig.name,
                                explorerUrl: this.networkConfig.explorerUrl
                            }];
                    case 2:
                        error_4 = _b.sent();
                        return [2 /*return*/, {
                                chainId: this.chainId,
                                connected: false,
                                error: error_4 instanceof Error ? error_4.message : String(error_4),
                                networkName: this.networkConfig.name
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    EnhancedAgentWallet.prototype.getTokenInfo = function (tokenAddress_1) {
        return __awaiter(this, arguments, void 0, function (tokenAddress, includePrice) {
            var contract, _a, symbol, name_1, decimals, balance, totalSupply, decimalCount, balanceFormatted, tokenInfo, _b, error_5, error_6;
            if (includePrice === void 0) { includePrice = false; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 6, , 7]);
                        contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
                        return [4 /*yield*/, Promise.all([
                                contract.methods.symbol().call(),
                                contract.methods.name().call(),
                                contract.methods.decimals().call(),
                                contract.methods.balanceOf(this.account.address).call(),
                                contract.methods.totalSupply().call().catch(function () { return '0'; })
                            ])];
                    case 1:
                        _a = _c.sent(), symbol = _a[0], name_1 = _a[1], decimals = _a[2], balance = _a[3], totalSupply = _a[4];
                        decimalCount = Number(decimals);
                        balanceFormatted = Number(balance) / Math.pow(10, decimalCount);
                        tokenInfo = {
                            symbol: String(symbol),
                            name: String(name_1),
                            decimals: decimalCount,
                            balance: String(balance),
                            balanceFormatted: balanceFormatted,
                            totalSupply: String(totalSupply)
                        };
                        if (!(includePrice && this.priceOracle)) return [3 /*break*/, 5];
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        _b = tokenInfo;
                        return [4 /*yield*/, this.priceOracle(tokenAddress)];
                    case 3:
                        _b.priceUsd = _c.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_5 = _c.sent();
                        console.warn("Failed to get price for ".concat(tokenAddress, ":"), error_5);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, tokenInfo];
                    case 6:
                        error_6 = _c.sent();
                        throw new Error("Failed to get token info: ".concat(error_6 instanceof Error ? error_6.message : String(error_6)));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // Enhanced gas estimation with EIP-1559 support
    EnhancedAgentWallet.prototype.getOptimalGasConfig = function () {
        return __awaiter(this, void 0, void 0, function () {
            var block, baseFee, priorityFee, maxFee, gasPrice, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        if (!this.supportsEIP1559()) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.web3.eth.getBlock('latest')];
                    case 1:
                        block = _a.sent();
                        if (block.baseFeePerGas) {
                            baseFee = BigInt(block.baseFeePerGas);
                            priorityFee = BigInt(this.web3.utils.toWei('2', 'gwei'));
                            maxFee = baseFee * BigInt(2) + priorityFee;
                            return [2 /*return*/, {
                                    maxFeePerGas: maxFee.toString(),
                                    maxPriorityFeePerGas: priorityFee.toString()
                                }];
                        }
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.web3.eth.getGasPrice()];
                    case 3:
                        gasPrice = _a.sent();
                        return [2 /*return*/, { gasPrice: gasPrice.toString() }];
                    case 4:
                        error_7 = _a.sent();
                        console.warn('Failed to get optimal gas config:', error_7);
                        return [2 /*return*/, { gasPrice: this.web3.utils.toWei('20', 'gwei') }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    EnhancedAgentWallet.prototype.supportsEIP1559 = function () {
        // Networks that support EIP-1559
        var eip1559Networks = [1, 5, 137, 80001, 42161, 421613];
        return eip1559Networks.includes(this.chainId);
    };
    EnhancedAgentWallet.prototype.estimateGasWithBuffer = function (transaction) {
        return __awaiter(this, void 0, void 0, function () {
            var estimated, buffered, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.web3.eth.estimateGas(transaction)];
                    case 1:
                        estimated = _a.sent();
                        buffered = Math.floor(Number(estimated) * 1.2);
                        console.log("Gas estimate: ".concat(estimated, ", with buffer: ").concat(buffered));
                        return [2 /*return*/, buffered];
                    case 2:
                        error_8 = _a.sent();
                        console.warn('Gas estimation failed, using default:', error_8);
                        return [2 /*return*/, 100000]; // Default fallback
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Enhanced transaction methods
    EnhancedAgentWallet.prototype.sendNativeToken = function (toAddress, amountEth, gasConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var amountWei, balance, balanceEth, nonce, optimalGasConfig, _a, transaction, signedTxn, txHash, result, error_9;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.web3.utils.isAddress(toAddress)) {
                            throw new Error('Invalid recipient address');
                        }
                        amountWei = this.web3.utils.toWei(amountEth.toString(), 'ether');
                        return [4 /*yield*/, this.getBalance()];
                    case 1:
                        balance = _b.sent();
                        if (balance < BigInt(amountWei)) {
                            balanceEth = this.web3.utils.fromWei(balance.toString(), 'ether');
                            throw new Error("Insufficient balance. Have ".concat(balanceEth, " ETH, need ").concat(amountEth));
                        }
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 8, , 9]);
                        return [4 /*yield*/, this.web3.eth.getTransactionCount(this.account.address)];
                    case 3:
                        nonce = _b.sent();
                        _a = gasConfig;
                        if (_a) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.getOptimalGasConfig()];
                    case 4:
                        _a = (_b.sent());
                        _b.label = 5;
                    case 5:
                        optimalGasConfig = _a;
                        transaction = __assign({ to: toAddress, value: amountWei, gas: 21000, nonce: Number(nonce), chainId: this.chainId }, optimalGasConfig);
                        return [4 /*yield*/, this.account.signTransaction(transaction)];
                    case 6:
                        signedTxn = _b.sent();
                        return [4 /*yield*/, this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction)];
                    case 7:
                        txHash = _b.sent();
                        console.log("Native token transfer sent: ".concat(txHash.transactionHash));
                        result = {
                            hash: typeof txHash.transactionHash === 'string' ? txHash.transactionHash : '',
                            status: 'pending',
                            timestamp: Date.now()
                        };
                        this.transactionCache.set(result.hash, result);
                        return [2 /*return*/, result];
                    case 8:
                        error_9 = _b.sent();
                        console.error('Native token transfer failed:', error_9);
                        throw new Error("Transaction failed: ".concat(error_9 instanceof Error ? error_9.message : String(error_9)));
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    EnhancedAgentWallet.prototype.sendTokenHuman = function (tokenAddress, toAddress, amount, gasConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var tokenInfo, amountWei, contract, nonce, optimalGasConfig, _a, transaction, _b, signedTxn, txHash, result, error_10;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.web3.utils.isAddress(tokenAddress)) {
                            throw new Error('Invalid token address');
                        }
                        if (!this.web3.utils.isAddress(toAddress)) {
                            throw new Error('Invalid recipient address');
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 9, , 10]);
                        return [4 /*yield*/, this.getTokenInfo(tokenAddress)];
                    case 2:
                        tokenInfo = _c.sent();
                        amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
                        if (BigInt(tokenInfo.balance) < amountWei) {
                            throw new Error("Insufficient token balance. Have ".concat(tokenInfo.balanceFormatted.toFixed(6), " ").concat(tokenInfo.symbol, ", need ").concat(amount));
                        }
                        contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
                        return [4 /*yield*/, this.web3.eth.getTransactionCount(this.account.address)];
                    case 3:
                        nonce = _c.sent();
                        _a = gasConfig;
                        if (_a) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.getOptimalGasConfig()];
                    case 4:
                        _a = (_c.sent());
                        _c.label = 5;
                    case 5:
                        optimalGasConfig = _a;
                        transaction = __assign({ to: tokenAddress, data: contract.methods.transfer(toAddress, amountWei.toString()).encodeABI(), chainId: this.chainId, gas: 100000, nonce: Number(nonce) }, optimalGasConfig);
                        _b = transaction;
                        return [4 /*yield*/, this.estimateGasWithBuffer(transaction)];
                    case 6:
                        _b.gas = _c.sent();
                        return [4 /*yield*/, this.account.signTransaction(transaction)];
                    case 7:
                        signedTxn = _c.sent();
                        return [4 /*yield*/, this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction)];
                    case 8:
                        txHash = _c.sent();
                        console.log("Token transfer sent: ".concat(txHash.transactionHash));
                        result = {
                            hash: typeof txHash.transactionHash === 'string' ? txHash.transactionHash : '',
                            status: 'pending',
                            timestamp: Date.now()
                        };
                        this.transactionCache.set(result.hash, result);
                        return [2 /*return*/, result];
                    case 9:
                        error_10 = _c.sent();
                        console.error('Token transfer failed:', error_10);
                        throw new Error("Token transfer failed: ".concat(error_10 instanceof Error ? error_10.message : String(error_10)));
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    // Batch operations
    EnhancedAgentWallet.prototype.batchTransfer = function (transfers) {
        return __awaiter(this, void 0, void 0, function () {
            var results, _i, transfers_1, transfer, result, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = [];
                        _i = 0, transfers_1 = transfers;
                        _a.label = 1;
                    case 1:
                        if (!(_i < transfers_1.length)) return [3 /*break*/, 10];
                        transfer = transfers_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 8, , 9]);
                        result = void 0;
                        if (!transfer.tokenAddress) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.sendTokenHuman(transfer.tokenAddress, transfer.toAddress, transfer.amount)];
                    case 3:
                        result = _a.sent();
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, this.sendNativeToken(transfer.toAddress, transfer.amount)];
                    case 5:
                        result = _a.sent();
                        _a.label = 6;
                    case 6:
                        results.push(result);
                        // Small delay between transactions to avoid nonce issues
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 7:
                        // Small delay between transactions to avoid nonce issues
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        error_11 = _a.sent();
                        console.error("Batch transfer failed for ".concat(transfer.toAddress, ":"), error_11);
                        results.push({
                            hash: '',
                            status: 'failed',
                            errorReason: error_11 instanceof Error ? error_11.message : String(error_11),
                            timestamp: Date.now()
                        });
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 1];
                    case 10: return [2 /*return*/, results];
                }
            });
        });
    };
    // Enhanced portfolio management
    EnhancedAgentWallet.prototype.getEnhancedPortfolio = function (tokenAddresses) {
        return __awaiter(this, void 0, void 0, function () {
            var portfolio, totalValueUsd, nativeTokenPrice, error_12, _i, tokenAddresses_1, tokenAddress, tokenInfo, error_13;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = {
                            address: this.account.address
                        };
                        return [4 /*yield*/, this.getBalanceEth()];
                    case 1:
                        _a.nativeBalance = _b.sent(),
                            _a.tokens = {};
                        return [4 /*yield*/, this.getNetworkInfo()];
                    case 2:
                        portfolio = (_a.networkInfo = _b.sent(),
                            _a.lastUpdated = Date.now(),
                            _a);
                        totalValueUsd = 0;
                        if (!this.priceOracle) return [3 /*break*/, 6];
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.priceOracle('native')];
                    case 4:
                        nativeTokenPrice = _b.sent();
                        portfolio.nativeBalanceUsd = portfolio.nativeBalance * nativeTokenPrice;
                        totalValueUsd += portfolio.nativeBalanceUsd;
                        return [3 /*break*/, 6];
                    case 5:
                        error_12 = _b.sent();
                        console.warn('Failed to get native token price:', error_12);
                        return [3 /*break*/, 6];
                    case 6:
                        _i = 0, tokenAddresses_1 = tokenAddresses;
                        _b.label = 7;
                    case 7:
                        if (!(_i < tokenAddresses_1.length)) return [3 /*break*/, 12];
                        tokenAddress = tokenAddresses_1[_i];
                        _b.label = 8;
                    case 8:
                        _b.trys.push([8, 10, , 11]);
                        return [4 /*yield*/, this.getTokenInfo(tokenAddress, true)];
                    case 9:
                        tokenInfo = _b.sent();
                        portfolio.tokens[tokenAddress] = tokenInfo;
                        if (tokenInfo.priceUsd && tokenInfo.balanceFormatted > 0) {
                            totalValueUsd += tokenInfo.balanceFormatted * tokenInfo.priceUsd;
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        error_13 = _b.sent();
                        console.warn("Failed to get info for token ".concat(tokenAddress, ":"), error_13);
                        portfolio.tokens[tokenAddress] = {
                            error: error_13 instanceof Error ? error_13.message : String(error_13)
                        };
                        return [3 /*break*/, 11];
                    case 11:
                        _i++;
                        return [3 /*break*/, 7];
                    case 12:
                        if (totalValueUsd > 0) {
                            portfolio.totalValueUsd = totalValueUsd;
                        }
                        return [2 /*return*/, portfolio];
                }
            });
        });
    };
    // Multisig support
    EnhancedAgentWallet.prototype.getMultisigInfo = function (multisigAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var contract, _a, ownersRaw, required, owners, isOwner, error_14;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        contract = new this.web3.eth.Contract(MULTISIG_ABI, multisigAddress);
                        return [4 /*yield*/, Promise.all([
                                contract.methods.getOwners().call(),
                                contract.methods.required().call()
                            ])];
                    case 1:
                        _a = _b.sent(), ownersRaw = _a[0], required = _a[1];
                        owners = Array.isArray(ownersRaw) ? ownersRaw : [];
                        isOwner = owners.includes(this.account.address);
                        return [2 /*return*/, {
                                owners: owners,
                                required: Number(required),
                                isOwner: isOwner
                            }];
                    case 2:
                        error_14 = _b.sent();
                        throw new Error("Failed to get multisig info: ".concat(error_14 instanceof Error ? error_14.message : String(error_14)));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    EnhancedAgentWallet.prototype.submitMultisigTransaction = function (multisigAddress_1, destination_1, value_1) {
        return __awaiter(this, arguments, void 0, function (multisigAddress, destination, value, data) {
            var contract, nonce, gasConfig, transaction, _a, signedTxn, txHash, error_15;
            if (data === void 0) { data = '0x'; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 7]);
                        contract = new this.web3.eth.Contract(MULTISIG_ABI, multisigAddress);
                        return [4 /*yield*/, this.web3.eth.getTransactionCount(this.account.address)];
                    case 1:
                        nonce = _b.sent();
                        return [4 /*yield*/, this.getOptimalGasConfig()];
                    case 2:
                        gasConfig = _b.sent();
                        transaction = __assign({ to: multisigAddress, data: contract.methods.submitTransaction(destination, value, data).encodeABI(), chainId: this.chainId, gas: 200000, nonce: Number(nonce) }, gasConfig);
                        _a = transaction;
                        return [4 /*yield*/, this.estimateGasWithBuffer(transaction)];
                    case 3:
                        _a.gas = _b.sent();
                        return [4 /*yield*/, this.account.signTransaction(transaction)];
                    case 4:
                        signedTxn = _b.sent();
                        return [4 /*yield*/, this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction)];
                    case 5:
                        txHash = _b.sent();
                        console.log("Multisig transaction submitted: ".concat(txHash.transactionHash));
                        return [2 /*return*/, {
                                hash: typeof txHash.transactionHash === 'string' ? txHash.transactionHash : '',
                                status: 'pending',
                                timestamp: Date.now()
                            }];
                    case 6:
                        error_15 = _b.sent();
                        throw new Error("Multisig transaction failed: ".concat(error_15 instanceof Error ? error_15.message : String(error_15)));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // Enhanced transaction monitoring
    EnhancedAgentWallet.prototype.waitForTransaction = function (txHash_1) {
        return __awaiter(this, arguments, void 0, function (txHash, timeout, pollLatency) {
            var receipt, result, error_16, failedResult;
            var _this = this;
            if (timeout === void 0) { timeout = 120; }
            if (pollLatency === void 0) { pollLatency = 2.0; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        console.log("Waiting for transaction: ".concat(txHash));
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                var startTime = Date.now();
                                var poll = function () { return __awaiter(_this, void 0, void 0, function () {
                                    var receipt_1, error_17;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                _a.trys.push([0, 2, , 3]);
                                                return [4 /*yield*/, this.web3.eth.getTransactionReceipt(txHash)];
                                            case 1:
                                                receipt_1 = _a.sent();
                                                if (receipt_1) {
                                                    resolve(receipt_1);
                                                    return [2 /*return*/];
                                                }
                                                return [3 /*break*/, 3];
                                            case 2:
                                                error_17 = _a.sent();
                                                return [3 /*break*/, 3];
                                            case 3:
                                                if (Date.now() - startTime > timeout * 1000) {
                                                    reject(new Error('Transaction timeout'));
                                                    return [2 /*return*/];
                                                }
                                                setTimeout(poll, pollLatency * 1000);
                                                return [2 /*return*/];
                                        }
                                    });
                                }); };
                                poll();
                            })];
                    case 1:
                        receipt = _a.sent();
                        result = {
                            hash: txHash,
                            status: receipt.status ? 'success' : 'failed',
                            blockNumber: Number(receipt.blockNumber),
                            gasUsed: Number(receipt.gasUsed),
                            effectiveGasPrice: receipt.effectiveGasPrice ? Number(receipt.effectiveGasPrice) : undefined,
                            timestamp: Date.now()
                        };
                        // Update cache
                        this.transactionCache.set(txHash, result);
                        console.log("Transaction ".concat(txHash, " ").concat(result.status, " in block ").concat(result.blockNumber));
                        return [2 /*return*/, result];
                    case 2:
                        error_16 = _a.sent();
                        failedResult = {
                            hash: txHash,
                            status: 'failed',
                            errorReason: error_16 instanceof Error ? error_16.message : String(error_16),
                            timestamp: Date.now()
                        };
                        this.transactionCache.set(txHash, failedResult);
                        throw new Error("Transaction confirmation failed: ".concat(error_16 instanceof Error ? error_16.message : String(error_16)));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // DAO Treasury Management with enhanced features
    EnhancedAgentWallet.prototype.scheduleDisburse = function (daoId, userId, disbursements, executeAt) {
        return __awaiter(this, void 0, void 0, function () {
            var scheduledId, scheduledDisbursements;
            return __generator(this, function (_a) {
                scheduledId = "".concat(daoId, "-").concat(Date.now());
                scheduledDisbursements = disbursements.map(function (d) { return (__assign(__assign({}, d), { scheduledAt: executeAt || Date.now() })); });
                // This would integrate with your scheduling system
                console.log("Scheduled disbursement ".concat(scheduledId, " for ").concat(new Date(executeAt || Date.now())));
                return [2 /*return*/, { scheduledId: scheduledId, disbursements: scheduledDisbursements }];
            });
        });
    };
    EnhancedAgentWallet.prototype.estimateDisbursementCost = function (disbursements) {
        return __awaiter(this, void 0, void 0, function () {
            var breakdown, totalGasCost, i, d, gasEstimate, gasPrice, gasCost, result, ethPrice, error_18;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        breakdown = [];
                        totalGasCost = 0;
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < disbursements.length)) return [3 /*break*/, 4];
                        d = disbursements[i];
                        gasEstimate = void 0;
                        if (d.tokenAddress) {
                            // Token transfer gas estimate
                            gasEstimate = 65000;
                        }
                        else {
                            // Native token transfer
                            gasEstimate = 21000;
                        }
                        return [4 /*yield*/, this.web3.eth.getGasPrice()];
                    case 2:
                        gasPrice = _a.sent();
                        gasCost = Number(gasPrice) * gasEstimate;
                        breakdown.push({ index: i, gasCost: gasCost });
                        totalGasCost += gasCost;
                        _a.label = 3;
                    case 3:
                        i++;
                        return [3 /*break*/, 1];
                    case 4:
                        result = { totalGasCost: totalGasCost, breakdown: breakdown };
                        if (!this.priceOracle) return [3 /*break*/, 8];
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.priceOracle('native')];
                    case 6:
                        ethPrice = _a.sent();
                        result.totalGasCostUsd = (totalGasCost / 1e18) * ethPrice;
                        return [3 /*break*/, 8];
                    case 7:
                        error_18 = _a.sent();
                        console.warn('Failed to get ETH price for cost estimation:', error_18);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, result];
                }
            });
        });
    };
    // Utility methods
    EnhancedAgentWallet.prototype.getTransactionHistory = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.transactionCache.values())
                        .sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); })
                        .slice(0, limit)];
            });
        });
    };
    EnhancedAgentWallet.prototype.clearTransactionCache = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.transactionCache.clear();
                return [2 /*return*/];
            });
        });
    };
    EnhancedAgentWallet.prototype.getExplorerUrl = function (txHash) {
        return "".concat(this.networkConfig.explorerUrl, "/tx/").concat(txHash);
    };
    Object.defineProperty(EnhancedAgentWallet.prototype, "address", {
        // Getters
        get: function () {
            return this.account.address;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnhancedAgentWallet.prototype, "privateKey", {
        get: function () {
            return this.account.privateKey;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnhancedAgentWallet.prototype, "network", {
        get: function () {
            return this.networkConfig;
        },
        enumerable: false,
        configurable: true
    });
    return EnhancedAgentWallet;
}());
exports.EnhancedAgentWallet = EnhancedAgentWallet;
// Enhanced Network Configuration
var NetworkConfig = /** @class */ (function () {
    function NetworkConfig(rpcUrl, chainId, name, explorerUrl) {
        if (explorerUrl === void 0) { explorerUrl = ''; }
        this.rpcUrl = rpcUrl;
        this.chainId = chainId;
        this.name = name;
        this.explorerUrl = explorerUrl;
    }
    NetworkConfig.CELO_MAINNET = new NetworkConfig('https://forno.celo.org', 42220, 'Celo Mainnet', 'https://explorer.celo.org');
    NetworkConfig.CELO_ALFAJORES = new NetworkConfig('https://alfajores-forno.celo-testnet.org', 44787, 'Celo Alfajores Testnet', 'https://alfajores-blockscout.celo-testnet.org');
    NetworkConfig.ETHEREUM_MAINNET = new NetworkConfig('https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY', 1, 'Ethereum Mainnet', 'https://etherscan.io');
    NetworkConfig.POLYGON_MAINNET = new NetworkConfig('https://polygon-rpc.com', 137, 'Polygon Mainnet', 'https://polygonscan.com');
    NetworkConfig.ARBITRUM_ONE = new NetworkConfig('https://arb1.arbitrum.io/rpc', 42161, 'Arbitrum One', 'https://arbiscan.io');
    return NetworkConfig;
}());
exports.NetworkConfig = NetworkConfig;
// Enhanced Wallet Manager
var WalletManager = /** @class */ (function () {
    function WalletManager() {
    }
    WalletManager.createWallet = function () {
        var account = new web3_1.default().eth.accounts.create();
        return {
            address: account.address,
            privateKey: account.privateKey
        };
    };
    WalletManager.validateAddress = function (address) {
        return web3_1.default.utils.isAddress(address);
    };
    WalletManager.validatePrivateKey = function (privateKey) {
        try {
            if (!privateKey.startsWith('0x')) {
                privateKey = '0x' + privateKey;
            }
            new web3_1.default().eth.accounts.privateKeyToAccount(privateKey);
            return true;
        }
        catch (_a) {
            return false;
        }
    };
    WalletManager.checksumAddress = function (address) {
        return web3_1.default.utils.toChecksumAddress(address);
    };
    WalletManager.isContract = function (web3, address) {
        return web3.eth.getCode(address).then(function (code) { return code !== '0x'; });
    };
    return WalletManager;
}());
exports.WalletManager = WalletManager;
// Example usage with enhanced features
function enhancedExample() {
    return __awaiter(this, void 0, void 0, function () {
        var config, mockPriceOracle;
        var _this = this;
        return __generator(this, function (_a) {
            try {
                config = NetworkConfig.CELO_ALFAJORES;
                mockPriceOracle = function (tokenAddress) { return __awaiter(_this, void 0, void 0, function () {
                    var prices;
                    return __generator(this, function (_a) {
                        prices = {
                            'native': 2500, // ETH price
                            '0x...': 1.0 // USDC price
                        };
                        return [2 /*return*/, prices[tokenAddress] || 0];
                    });
                }); };
                // Uncomment to test with real private key
                // const wallet = new EnhancedAgentWallet(
                //   "YOUR_PRIVATE_KEY", 
                //   config,
                //   undefined, // permissionCheck
                //   undefined, // contributionLogger  
                //   undefined, // billingLogger
                //   mockPriceOracle
                // );
                // // Enhanced portfolio with USD values
                // const portfolio = await wallet.getEnhancedPortfolio(['TOKEN_ADDRESS_1']);
                // console.log('Enhanced Portfolio:', JSON.stringify(portfolio, null, 2));
                // // Batch transfer example
                // const transfers = [
                //   { toAddress: '0x...', amount: 0.1 },
                //   { tokenAddress: '0x...', toAddress: '0x...', amount: 100 }
                // ];
                // const batchResults = await wallet.batchTransfer(transfers);
                // console.log('Batch Results:', batchResults);
                console.log('Enhanced AgentWallet ready with advanced features');
            }
            catch (error) {
                console.error('Enhanced example failed:', error);
            }
            return [2 /*return*/];
        });
    });
}
// Advanced DAO Treasury Management Class
var DaoTreasuryManager = /** @class */ (function () {
    function DaoTreasuryManager(wallet, treasuryAddress, allowedTokens) {
        if (allowedTokens === void 0) { allowedTokens = []; }
        this.wallet = wallet;
        this.treasuryAddress = treasuryAddress;
        this.allowedTokens = new Set(allowedTokens);
    }
    DaoTreasuryManager.prototype.getTreasurySnapshot = function () {
        return __awaiter(this, void 0, void 0, function () {
            var nativeBalance, tokenBalances, totalValueUsd, _i, _a, tokenAddress, contract, balance, _b, symbol, name_2, decimals, decimalCount, balanceFormatted, tokenInfo, price, error_19, error_20, nativePrice, error_21;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.wallet.getBalanceEth(this.treasuryAddress)];
                    case 1:
                        nativeBalance = _c.sent();
                        tokenBalances = {};
                        totalValueUsd = 0;
                        _i = 0, _a = Array.from(this.allowedTokens);
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 12];
                        tokenAddress = _a[_i];
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 10, , 11]);
                        contract = new this.wallet['web3'].eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
                        return [4 /*yield*/, contract.methods.balanceOf(this.treasuryAddress).call()];
                    case 4:
                        balance = _c.sent();
                        return [4 /*yield*/, Promise.all([
                                contract.methods.symbol().call(),
                                contract.methods.name().call(),
                                contract.methods.decimals().call()
                            ])];
                    case 5:
                        _b = _c.sent(), symbol = _b[0], name_2 = _b[1], decimals = _b[2];
                        decimalCount = Number(decimals);
                        balanceFormatted = Number(balance) / Math.pow(10, decimalCount);
                        tokenInfo = {
                            symbol: String(symbol),
                            name: String(name_2),
                            decimals: decimalCount,
                            balance: String(balance),
                            balanceFormatted: balanceFormatted
                        };
                        if (!(this.wallet['priceOracle'] && balanceFormatted > 0)) return [3 /*break*/, 9];
                        _c.label = 6;
                    case 6:
                        _c.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.wallet['priceOracle'](tokenAddress)];
                    case 7:
                        price = _c.sent();
                        tokenInfo.priceUsd = price;
                        totalValueUsd += balanceFormatted * price;
                        return [3 /*break*/, 9];
                    case 8:
                        error_19 = _c.sent();
                        console.warn("Failed to get price for ".concat(tokenAddress, ":"), error_19);
                        return [3 /*break*/, 9];
                    case 9:
                        tokenBalances[tokenAddress] = tokenInfo;
                        return [3 /*break*/, 11];
                    case 10:
                        error_20 = _c.sent();
                        console.warn("Failed to get treasury balance for ".concat(tokenAddress, ":"), error_20);
                        return [3 /*break*/, 11];
                    case 11:
                        _i++;
                        return [3 /*break*/, 2];
                    case 12:
                        if (!this.wallet['priceOracle']) return [3 /*break*/, 16];
                        _c.label = 13;
                    case 13:
                        _c.trys.push([13, 15, , 16]);
                        return [4 /*yield*/, this.wallet['priceOracle']('native')];
                    case 14:
                        nativePrice = _c.sent();
                        totalValueUsd += nativeBalance * nativePrice;
                        return [3 /*break*/, 16];
                    case 15:
                        error_21 = _c.sent();
                        console.warn('Failed to get native token price:', error_21);
                        return [3 /*break*/, 16];
                    case 16: return [2 /*return*/, {
                            nativeBalance: nativeBalance,
                            tokenBalances: tokenBalances,
                            totalValueUsd: totalValueUsd > 0 ? totalValueUsd : undefined,
                            lastUpdated: Date.now()
                        }];
                }
            });
        });
    };
    DaoTreasuryManager.prototype.generateTreasuryReport = function () {
        return __awaiter(this, arguments, void 0, function (period) {
            var currentSnapshot, topHoldings, recommendations, totalValue, nativePrice, nativeValue, error_22, _i, _a, _b, address, token, value, largestHolding;
            if (period === void 0) { period = 'monthly'; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.getTreasurySnapshot()];
                    case 1:
                        currentSnapshot = _c.sent();
                        topHoldings = [];
                        recommendations = [];
                        totalValue = currentSnapshot.totalValueUsd || 0;
                        if (!(totalValue > 0)) return [3 /*break*/, 6];
                        if (!this.wallet['priceOracle']) return [3 /*break*/, 5];
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.wallet['priceOracle']('native')];
                    case 3:
                        nativePrice = _c.sent();
                        nativeValue = currentSnapshot.nativeBalance * nativePrice;
                        topHoldings.push({
                            token: 'Native Token',
                            value: nativeValue,
                            percentage: (nativeValue / totalValue) * 100
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        error_22 = _c.sent();
                        console.warn('Failed to calculate native token value:', error_22);
                        return [3 /*break*/, 5];
                    case 5:
                        // Token holdings
                        for (_i = 0, _a = Object.entries(currentSnapshot.tokenBalances); _i < _a.length; _i++) {
                            _b = _a[_i], address = _b[0], token = _b[1];
                            if (token.priceUsd && token.balanceFormatted > 0) {
                                value = token.balanceFormatted * token.priceUsd;
                                topHoldings.push({
                                    token: "".concat(token.symbol, " (").concat(token.name, ")"),
                                    value: value,
                                    percentage: (value / totalValue) * 100
                                });
                            }
                        }
                        // Sort by value
                        topHoldings.sort(function (a, b) { return b.value - a.value; });
                        _c.label = 6;
                    case 6:
                        // Generate basic recommendations
                        if (topHoldings.length > 0) {
                            largestHolding = topHoldings[0];
                            if (largestHolding.percentage > 70) {
                                recommendations.push("Consider diversifying: ".concat(largestHolding.token, " represents ").concat(largestHolding.percentage.toFixed(1), "% of treasury"));
                            }
                            if (currentSnapshot.nativeBalance < 0.1) {
                                recommendations.push('Treasury has low native token balance, consider maintaining more for gas fees');
                            }
                        }
                        return [2 /*return*/, {
                                period: period,
                                currentSnapshot: currentSnapshot,
                                topHoldings: topHoldings,
                                recommendations: recommendations
                            }];
                }
            });
        });
    };
    DaoTreasuryManager.prototype.addAllowedToken = function (tokenAddress) {
        if (WalletManager.validateAddress(tokenAddress)) {
            this.allowedTokens.add(tokenAddress);
        }
        else {
            throw new Error('Invalid token address');
        }
    };
    DaoTreasuryManager.prototype.removeAllowedToken = function (tokenAddress) {
        this.allowedTokens.delete(tokenAddress);
    };
    DaoTreasuryManager.prototype.getAllowedTokens = function () {
        return Array.from(this.allowedTokens);
    };
    return DaoTreasuryManager;
}());
exports.DaoTreasuryManager = DaoTreasuryManager;
// Risk Management and Compliance Features
var RiskManager = /** @class */ (function () {
    function RiskManager(wallet, maxDailyVolume, // USD
    maxSingleTransfer // USD
    ) {
        if (maxDailyVolume === void 0) { maxDailyVolume = 10000; }
        if (maxSingleTransfer === void 0) { maxSingleTransfer = 5000; }
        this.dailyVolumeTracking = new Map();
        this.wallet = wallet;
        this.maxDailyVolume = maxDailyVolume;
        this.maxSingleTransfer = maxSingleTransfer;
    }
    RiskManager.prototype.validateTransfer = function (amount, tokenAddress, toAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var riskScore, amountUsd, price, error_23, today, dailyKey, dailyData, isContract, error_24, amountRisk;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        riskScore = 0;
                        amountUsd = amount;
                        if (!this.wallet['priceOracle']) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.wallet['priceOracle'](tokenAddress || 'native')];
                    case 2:
                        price = _a.sent();
                        amountUsd = amount * price;
                        return [3 /*break*/, 4];
                    case 3:
                        error_23 = _a.sent();
                        console.warn('Failed to get price for risk assessment:', error_23);
                        riskScore += 10; // Unknown price increases risk
                        return [3 /*break*/, 4];
                    case 4:
                        // Single transfer limit check
                        if (amountUsd > this.maxSingleTransfer) {
                            return [2 /*return*/, {
                                    allowed: false,
                                    reason: "Transfer amount ".concat(amountUsd.toFixed(2), " exceeds single transfer limit of ").concat(this.maxSingleTransfer),
                                    riskScore: 100
                                }];
                        }
                        today = new Date().toISOString().split('T')[0];
                        dailyKey = "".concat(this.wallet.address, "-").concat(today);
                        dailyData = this.dailyVolumeTracking.get(dailyKey) || { date: today, volume: 0 };
                        if (dailyData.volume + amountUsd > this.maxDailyVolume) {
                            return [2 /*return*/, {
                                    allowed: false,
                                    reason: "Transfer would exceed daily volume limit. Current: ".concat(dailyData.volume.toFixed(2), ", Limit: ").concat(this.maxDailyVolume),
                                    riskScore: 100
                                }];
                        }
                        // Address validation
                        if (toAddress && !WalletManager.validateAddress(toAddress)) {
                            return [2 /*return*/, {
                                    allowed: false,
                                    reason: 'Invalid recipient address',
                                    riskScore: 100
                                }];
                        }
                        if (!(toAddress && this.wallet['web3'])) return [3 /*break*/, 8];
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, WalletManager.isContract(this.wallet['web3'], toAddress)];
                    case 6:
                        isContract = _a.sent();
                        if (isContract) {
                            riskScore += 20;
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        error_24 = _a.sent();
                        riskScore += 10;
                        return [3 /*break*/, 8];
                    case 8:
                        amountRisk = (amountUsd / this.maxSingleTransfer) * 30;
                        riskScore += Math.min(amountRisk, 30);
                        // Update daily volume tracking
                        dailyData.volume += amountUsd;
                        this.dailyVolumeTracking.set(dailyKey, dailyData);
                        return [2 /*return*/, {
                                allowed: true,
                                riskScore: Math.min(riskScore, 100)
                            }];
                }
            });
        });
    };
    RiskManager.prototype.getDailyVolumeReport = function () {
        var _this = this;
        return Array.from(this.dailyVolumeTracking.values())
            .map(function (data) { return ({
            date: data.date,
            volume: data.volume,
            percentage: (data.volume / _this.maxDailyVolume) * 100
        }); })
            .sort(function (a, b) { return b.date.localeCompare(a.date); });
    };
    RiskManager.prototype.setLimits = function (maxDailyVolume, maxSingleTransfer) {
        if (maxDailyVolume !== undefined)
            this.maxDailyVolume = maxDailyVolume;
        if (maxSingleTransfer !== undefined)
            this.maxSingleTransfer = maxSingleTransfer;
    };
    RiskManager.prototype.getLimits = function () {
        return {
            maxDailyVolume: this.maxDailyVolume,
            maxSingleTransfer: this.maxSingleTransfer
        };
    };
    return RiskManager;
}());
exports.RiskManager = RiskManager;
// Analytics and Reporting
var TransactionAnalytics = /** @class */ (function () {
    function TransactionAnalytics() {
        this.transactions = [];
    }
    TransactionAnalytics.prototype.addTransaction = function (tx) {
        this.transactions.push(tx);
        // Keep only last 1000 transactions
        if (this.transactions.length > 1000) {
            this.transactions = this.transactions.slice(-1000);
        }
    };
    TransactionAnalytics.prototype.getSuccessRate = function (timeframe) {
        if (timeframe === void 0) { timeframe = 24 * 60 * 60 * 1000; }
        var since = Date.now() - timeframe;
        var recentTxs = this.transactions.filter(function (tx) { return (tx.timestamp || 0) > since; });
        if (recentTxs.length === 0)
            return 100;
        var successful = recentTxs.filter(function (tx) { return tx.status === 'success'; }).length;
        return (successful / recentTxs.length) * 100;
    };
    TransactionAnalytics.prototype.getAverageGasUsed = function (timeframe) {
        if (timeframe === void 0) { timeframe = 24 * 60 * 60 * 1000; }
        var since = Date.now() - timeframe;
        var recentTxs = this.transactions.filter(function (tx) { return (tx.timestamp || 0) > since && tx.gasUsed && tx.status === 'success'; });
        if (recentTxs.length === 0)
            return 0;
        var totalGas = recentTxs.reduce(function (sum, tx) { return sum + (tx.gasUsed || 0); }, 0);
        return totalGas / recentTxs.length;
    };
    TransactionAnalytics.prototype.getFailureReasons = function () {
        var reasons = {};
        this.transactions
            .filter(function (tx) { return tx.status === 'failed' && tx.errorReason; })
            .forEach(function (tx) {
            var reason = tx.errorReason;
            reasons[reason] = (reasons[reason] || 0) + 1;
        });
        return reasons;
    };
    TransactionAnalytics.prototype.generateReport = function (timeframe) {
        if (timeframe === void 0) { timeframe = 7 * 24 * 60 * 60 * 1000; }
        var since = Date.now() - timeframe;
        var recentTxs = this.transactions.filter(function (tx) { return (tx.timestamp || 0) > since; });
        // Gas efficiency trend (daily averages)
        var dailyGas = {};
        recentTxs
            .filter(function (tx) { return tx.gasUsed && tx.status === 'success'; })
            .forEach(function (tx) {
            var date = new Date(tx.timestamp || 0).toISOString().split('T')[0];
            if (!dailyGas[date])
                dailyGas[date] = [];
            dailyGas[date].push(tx.gasUsed);
        });
        var gasEfficiencyTrend = Object.entries(dailyGas)
            .map(function (_a) {
            var date = _a[0], gasValues = _a[1];
            return ({
                date: date,
                avgGas: gasValues.reduce(function (a, b) { return a + b; }, 0) / gasValues.length
            });
        })
            .sort(function (a, b) { return a.date.localeCompare(b.date); });
        return {
            totalTransactions: recentTxs.length,
            successRate: this.getSuccessRate(timeframe),
            averageGasUsed: this.getAverageGasUsed(timeframe),
            failureReasons: this.getFailureReasons(),
            gasEfficiencyTrend: gasEfficiencyTrend
        };
    };
    return TransactionAnalytics;
}());
exports.TransactionAnalytics = TransactionAnalytics;
// Export enhanced wallet as default
exports.default = EnhancedAgentWallet;
