import React, { useEffect, useState } from 'react';
import { getAnalyticsReport, getAllowedTokens, getPortfolio, getTxHistory } from '../api/walletApi';
import './dao-treasury.css';

export default function DaoTreasury() {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [allowedTokens, setAllowedTokens] = useState<string[]>([]);
  const [txHistory, setTxHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const t = await getAllowedTokens();
        const [p, a, h] = await Promise.all([
          getPortfolio(t.allowedTokens || []),
          getAnalyticsReport(),
          getTxHistory(20)
        ]);
        setPortfolio(p);
        setAnalytics(a);
        setAllowedTokens(t.allowedTokens || []);
        setTxHistory(h);
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="dao-treasury-container">
      <div style={{ padding: 24 }}>
        <h2>DAO Treasury Overview</h2>
        {loading && <div>Loading...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        {portfolio && (
          <div>
            <h3>Portfolio</h3>
            <pre>{JSON.stringify(portfolio, null, 2)}</pre>
          </div>
        )}
        {analytics && (
          <div>
            <h3>Analytics</h3>
            <pre>{JSON.stringify(analytics, null, 2)}</pre>
          </div>
        )}
        <div>
          <h3>Allowed Tokens</h3>
          <ul>
            {allowedTokens.map(addr => (
              <li key={addr}>{addr}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Disbursement History</h3>
          <pre>{JSON.stringify(txHistory, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
