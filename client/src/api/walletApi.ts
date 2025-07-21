// Wallet and DAO API utility functions for frontend wiring

export async function getRiskValidation(amount: number, tokenAddress?: string, toAddress?: string) {
  const res = await fetch('/api/wallet/risk/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, tokenAddress, toAddress })
  });
  return res.json();
}

export async function getAnalyticsReport(timeframe?: number) {
  const url = '/api/wallet/analytics/report' + (timeframe ? `?timeframe=${timeframe}` : '');
  const res = await fetch(url);
  return res.json();
}

export async function getMultisigInfo(multisigAddress: string) {
  const res = await fetch('/api/wallet/multisig/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ multisigAddress })
  });
  return res.json();
}

export async function submitMultisigTx(multisigAddress: string, destination: string, value: string, data?: string) {
  const res = await fetch('/api/wallet/multisig/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ multisigAddress, destination, value, data })
  });
  return res.json();
}

export async function getAllowedTokens() {
  const res = await fetch('/api/wallet/allowed-tokens');
  return res.json();
}

export async function addAllowedToken(tokenAddress: string) {
  const res = await fetch('/api/wallet/allowed-tokens/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress })
  });
  return res.json();
}

export async function removeAllowedToken(tokenAddress: string) {
  const res = await fetch('/api/wallet/allowed-tokens/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress })
  });
  return res.json();
}

export async function approveToken(tokenAddress: string, spender: string, amount: number) {
  const res = await fetch('/api/wallet/approve-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress, spender, amount })
  });
  return res.json();
}

export async function getAllowance(tokenAddress: string, spender: string) {
  const res = await fetch(`/api/wallet/allowance/${tokenAddress}/${spender}`);
  return res.json();
}

export async function getTransactionStatus(txHash: string) {
  const res = await fetch(`/api/wallet/tx-status/${txHash}`);
  return res.json();
}

export async function getPortfolio(tokenAddresses: string[]) {
  const res = await fetch('/api/wallet/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddresses })
  });
  return res.json();
}

export async function batchTransfer(transfers: Array<{ tokenAddress?: string; toAddress: string; amount: number }>) {
  const res = await fetch('/api/wallet/batch-transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transfers })
  });
  return res.json();
}

export async function sendNativeToken(toAddress: string, amount: number) {
  const res = await fetch('/api/wallet/send-native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toAddress, amount })
  });
  return res.json();
}

export async function sendToken(tokenAddress: string, toAddress: string, amount: number) {
  const res = await fetch('/api/wallet/send-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress, toAddress, amount })
  });
  return res.json();
}

export async function getTokenInfo(tokenAddress: string) {
  const res = await fetch(`/api/wallet/token-info/${tokenAddress}`);
  return res.json();
}

export async function getNetworkInfo() {
  const res = await fetch('/api/wallet/network-info');
  return res.json();
}

export async function getBalance(address?: string) {
  const url = address ? `/api/wallet/balance/${address}` : '/api/wallet/balance';
  const res = await fetch(url);
  return res.json();
}

export async function getTxHistory(limit?: number) {
  const url = '/api/wallet/analytics/tx-history' + (limit ? `?limit=${limit}` : '');
  const res = await fetch(url);
  return res.json();
}
