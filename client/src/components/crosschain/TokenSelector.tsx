import React, { useEffect, useState } from 'react';

type Props = {
  value?: string;
  onSelect: (symbol: string, address?: string) => void;
  address?: string;
  onAddressChange?: (addr: string) => void;
  chain?: string;
};

const COMMON_TOKENS = ['USDC', 'USDT', 'DAI', 'ETH', 'MATIC', 'BNB'];

// Map chain names used in the app to common chain IDs used in tokenlists
const CHAIN_NAME_TO_ID: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  optimism: 10,
  arbitrum: 42161,
  celo: 42220
};

// In-memory cache of tokens by chain name
type TokenEntry = { address: string; symbol: string; name?: string };

export default function TokenSelector({ value, onSelect, address, onAddressChange, chain }: Props) {
  const [tokensByChain, setTokensByChain] = useState<Record<string, TokenEntry[]>>({});

  useEffect(() => {
    let mounted = true;
    // Fetch a canonical token list (Uniswap tokenlist)
    fetch('https://tokens.uniswap.org/')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted || !data?.tokens) return;
        const map: Record<number, TokenEntry[]> = {};
        for (const t of data.tokens) {
          const cid: number = t.chainId;
          map[cid] = map[cid] || [];
          map[cid].push({ address: t.address, symbol: t.symbol, name: t.name });
        }
        // convert to chain-name keys
        const byName: Record<string, TokenEntry[]> = {};
        for (const [name, id] of Object.entries(CHAIN_NAME_TO_ID)) {
          byName[name] = (map[id] || []).sort((a, b) => a.symbol.localeCompare(b.symbol));
        }
        setTokensByChain(byName);
      })
      .catch(() => {
        // ignore fetch errors — we still have COMMON_TOKENS fallback
      });
    return () => { mounted = false; };
  }, []);

  const available = (chain && tokensByChain[chain]) || [];

  return (
    <div>
      <label className="text-sm font-medium mb-2 block">Token</label>
      <div className="flex gap-2">
        <select 
          value={value || ''} 
          onChange={(e) => {
            const sym = e.target.value;
            // prefer token list address when available
            const found = available.find((t) => t.symbol === sym);
            const addr = found ? found.address : undefined;
            onSelect(sym, addr);
          }} 
          className="border rounded px-2 py-1"
          aria-label="Select token"
          title="Select a token">

          <option value="">Select token</option>
          {available.length > 0 ? (
            available.map((t) => <option key={`${t.address}`} value={t.symbol}>{t.symbol} — {t.name}</option>)
          ) : (
            COMMON_TOKENS.map((t) => <option key={t} value={t}>{t}</option>)
          )}
        </select>
        <input placeholder="Token address (optional)" value={address || ''} onChange={(e) => onAddressChange?.(e.target.value)} className="flex-1 border rounded px-2 py-1" />
      </div>
    </div>
  );
}
