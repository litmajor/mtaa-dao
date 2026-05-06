// Wallet and DAO API utility functions for frontend wiring

export async function getRiskValidation(amount: number, tokenAddress?: string, toAddress?: string) {
  const res = await fetch('/api/v1/wallets/risk/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, tokenAddress, toAddress })
  });
  return res.json();
}

export async function getAnalyticsReport(timeframe?: number) {
  const url = '/api/v1/wallets/analytics/report' + (timeframe ? `?timeframe=${timeframe}` : '');
  const res = await fetch(url);
  return res.json();
}

export async function getMultisigInfo(multisigAddress: string) {
  const res = await fetch('/api/v1/wallets/multisig/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ multisigAddress })
  });
  return res.json();
}

export async function submitMultisigTx(multisigAddress: string, destination: string, value: string, data?: string) {
  const res = await fetch('/api/v1/wallets/multisig/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ multisigAddress, destination, value, data })
  });
  return res.json();
}

export async function getAllowedTokens() {
  const res = await fetch('/api/v1/wallets/tokens/allowed');
  return res.json();
}

// Enhanced Multisig Functions
export async function createMultisigWallet(owners: string[], threshold: number) {
  const res = await fetch('/api/v1/wallets/multisig/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owners, threshold })
  });
  return res.json();
}

export async function getMultisigTransactions(multisigAddress: string, pending = false) {
  const res = await fetch(`/api/v1/wallets/multisig/${multisigAddress}/transactions?pending=${pending}`);
  return res.json();
}

export async function confirmMultisigTransaction(multisigAddress: string, transactionId: string) {
  const res = await fetch('/api/v1/wallets/multisig/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ multisigAddress, transactionId })
  });
  return res.json();
}

export async function executeMultisigTransaction(multisigAddress: string, transactionId: string) {
  const res = await fetch('/api/v1/wallets/multisig/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ multisigAddress, transactionId })
  });
  return res.json();
}

export async function addAllowedToken(tokenAddress: string) {
  const res = await fetch('/api/v1/wallets/tokens/allowed/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress })
  });
  return res.json();
}

export async function removeAllowedToken(tokenAddress: string) {
  const res = await fetch('/api/v1/wallets/tokens/allowed/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress })
  });
  return res.json();
}

export async function approveToken(tokenAddress: string, spender: string, amount: number) {
  const res = await fetch('/api/v1/wallets/tokens/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress, spender, amount })
  });
  return res.json();
}

export async function getAllowance(tokenAddress: string, spender: string) {
  const res = await fetch(`/api/v1/wallets/tokens/allowance/${tokenAddress}/${spender}`);
  return res.json();
}

export async function getTransactionStatus(txHash: string) {
  const res = await fetch(`/api/v1/wallets/transactions/status/${txHash}`);
  return res.json();
}

export async function getPortfolio(tokenAddresses: string[]) {
  const res = await fetch('/api/v1/wallets/balance/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddresses })
  });
  return res.json();
}

export async function batchTransfer(transfers: Array<{ tokenAddress?: string; toAddress: string; amount: number }>) {
  const res = await fetch('/api/v1/wallets/transfers/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transfers })
  });
  return res.json();
}

export async function sendNativeToken(toAddress: string, amount: number) {
  const res = await fetch('/api/v1/wallets/transfers/send-native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toAddress, amount })
  });
  return res.json();
}

export async function sendToken(tokenAddress: string, toAddress: string, amount: number) {
  const res = await fetch('/api/v1/wallets/transfers/send-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress, toAddress, amount })
  });
  return res.json();
}

export async function getTokenInfo(tokenAddress: string) {
  const res = await fetch(`/api/v1/wallets/tokens/info/${tokenAddress}`);
  return res.json();
}

export async function getNetworkInfo() {
  const res = await fetch('/api/v1/wallets/network/info');
  return res.json();
}

export async function getBalance(address?: string) {
  const url = address ? `/api/v1/wallets/balance/${address}` : '/api/v1/wallets/balance';
  const res = await fetch(url);
  return res.json();
}

export async function getTxHistory(limit?: number) {
  const url = '/api/v1/wallets/analytics/tx-history' + (limit ? `?limit=${limit}` : '');
  const res = await fetch(url);
  return res.json();
}
