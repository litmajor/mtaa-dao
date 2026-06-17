import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminTable from '@/components/admin/AdminTable';
import StatCard from '@/components/admin/StatCard';
import styles from './treasury.module.css';

interface Vault {
  id: string;
  tokenAddress: string;
  balance: string;
  isActive: boolean;
}

interface Transaction {
  id: string;
  vaultId: string;
  type: string;
  amount: string;
  description?: string;
  createdAt: string;
  status: string;
}

interface TreasuryHealth {
  status: string;
  isFrozen: boolean;
  totalBalance: number;
  vaultCount: number;
  riskLevel: string;
  recentActivity: {
    transactionCount: number;
    volumeInPeriod: number;
  };
}

export default function TreasuryPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [health, setHealth] = useState<TreasuryHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [daoName, setDaoName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezing, setFreezing] = useState(false);

  const daoId = router.query.daoId as string;

  // Fetch treasury overview
  useEffect(() => {
    if (!daoId || !session) return;

    const fetchTreasuryOverview = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/daos/${daoId}/treasury`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch treasury: ${response.statusText}`);
        }

        const data = await response.json();
        setVaults(data.vaults);
        setDaoName(data.dao.name);
        setUserRole(data.userRole);
        setIsFrozen(data.dao.isFrozen);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch treasury');
      } finally {
        setLoading(false);
      }
    };

    fetchTreasuryOverview();
  }, [daoId, session]);

  // Fetch transactions
  useEffect(() => {
    if (!daoId || !session) return;

    const fetchTransactions = async () => {
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          ...(typeFilter !== 'all' && { type: typeFilter }),
          ...(statusFilter !== 'all' && { status: statusFilter }),
        });

        const response = await fetch(`/api/admin/daos/${daoId}/treasury/transactions?${params}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch transactions: ${response.statusText}`);
        }

        const data = await response.json();
        setTransactions(data.transactions);
        setTotal(data.pagination.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      }
    };

    fetchTransactions();
  }, [daoId, page, typeFilter, statusFilter, session]);

  // Fetch health status
  useEffect(() => {
    if (!daoId || !session) return;

    const fetchHealth = async () => {
      try {
        const response = await fetch(`/api/admin/daos/${daoId}/treasury/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch health: ${response.statusText}`);
        }

        const data = await response.json();
        setHealth(data.health);
      } catch (err) {
        console.error('Failed to fetch treasury health:', err);
      }
    };

    fetchHealth();
  }, [daoId, session]);

  const handleFreezeTreasury = async () => {
    if (!confirm('Are you sure? This will freeze all treasury operations.')) return;

    try {
      setFreezing(true);
      const response = await fetch(`/api/admin/daos/${daoId}/treasury/freeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Emergency freeze by super admin',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to freeze treasury');
      }

      setIsFrozen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to freeze treasury');
    } finally {
      setFreezing(false);
    }
  };

  const handleUnfreezeTreasury = async () => {
    if (!confirm('Are you sure? This will restore treasury operations.')) return;

    try {
      setFreezing(true);
      const response = await fetch(`/api/admin/daos/${daoId}/treasury/unfreeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Restore treasury operations',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to unfreeze treasury');
      }

      setIsFrozen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unfreeze treasury');
    } finally {
      setFreezing(false);
    }
  };

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (value: string) => (
        <span className={styles.typeCell}>{value}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (value: string) => (
        <span className={styles.amountCell}>{parseFloat(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span className={`${styles.statusBadge} ${styles[`status-${value}`]}`}>
          {value}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'description',
      label: 'Description',
      render: (value?: string) => <span className={styles.descriptionCell}>{value || '-'}</span>,
    },
  ];

  if (!session) {
    return (
      <AdminLayout>
        <div className={styles.container}>
          <p>Please log in to access this page.</p>
        </div>
      </AdminLayout>
    );
  }

  const riskColorMap = {
    low: '#059669',
    medium: '#f59e0b',
    high: '#dc2626',
  };

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>Treasury Management</h1>
            <p className={styles.daoName}>DAO: {daoName}</p>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.accessLevel}>
              <span className={styles.role}>{userRole}</span>
              {userRole === 'super_admin' && (
                <span className={styles.badge}>Platform Admin</span>
              )}
            </div>
            {userRole === 'super_admin' && (
              <button
                className={`${styles.emergencyBtn} ${isFrozen ? styles.unfreeze : styles.freeze}`}
                onClick={isFrozen ? handleUnfreezeTreasury : handleFreezeTreasury}
                disabled={freezing}
              >
                {freezing ? '...' : isFrozen ? '🔓 Unfreeze' : '❄️ Emergency Freeze'}
              </button>
            )}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {isFrozen && (
          <div className={styles.frozenAlert}>
            ⚠️ Treasury is FROZEN - All operations are suspended
          </div>
        )}

        {health && (
          <div className={styles.statsGrid}>
            <StatCard
              title="Total Balance"
              value={`$${health.totalBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
              icon="💰"
              trend={undefined}
            />
            <StatCard
              title="Active Vaults"
              value={`${health.vaultCount} total`}
              icon="🏦"
              trend={undefined}
            />
            <StatCard
              title="Status"
              value={health.status.toUpperCase()}
              icon="📊"
              trend={undefined}
            />
            <StatCard
              title="Risk Level"
              value={health.riskLevel.toUpperCase()}
              icon="⚠️"
              trend={undefined}
            />
            <StatCard
              title="30d Volume"
              value={`$${health.recentActivity.volumeInPeriod.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
              icon="📈"
              trend={undefined}
            />
            <StatCard
              title="Recent Transactions"
              value={health.recentActivity.transactionCount}
              icon="📝"
              trend={undefined}
            />
          </div>
        )}

        <div className={styles.section}>
          <h2>Vaults</h2>
          <div className={styles.vaultsGrid}>
            {vaults.length === 0 ? (
              <p className={styles.emptyState}>No vaults found</p>
            ) : (
              vaults.map((vault) => (
                <div key={vault.id} className={`${styles.vaultCard} ${vault.isActive ? styles.active : styles.inactive}`}>
                  <div className={styles.vaultHeader}>
                    <span className={styles.vaultStatus}>
                      {vault.isActive ? '✅ Active' : '⛔ Inactive'}
                    </span>
                  </div>
                  <div className={styles.vaultBody}>
                    <p className={styles.vaultLabel}>Token Address</p>
                    <p className={styles.vaultAddress}>{vault.tokenAddress}</p>
                    <p className={styles.vaultLabel}>Balance</p>
                    <p className={styles.vaultBalance}>
                      {parseFloat(vault.balance).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Recent Transactions</h2>
            <div className={styles.filterSection}>
              <select
                value={typeFilter}
                aria-label="Filter by transaction type"
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className={styles.filterSelect}
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="transfer">Transfer</option>
                <option value="distribution">Distribution</option>
              </select>
              <select
                value={statusFilter}
                aria-label="Filter by transaction status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className={styles.filterSelect}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className={styles.tableContainer}>
            {loading ? (
              <p className={styles.loading}>Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className={styles.emptyState}>No transactions found</p>
            ) : (
              <AdminTable
                data={transactions}
                columns={columns}
                actions={[]}
                selectedRows={new Set()}
                onSelectRow={() => {}}
                onSelectAll={() => {}}
              />
            )}
          </div>
        </div>

        <div className={styles.pagination}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * limit >= total}
          >
            Next
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
