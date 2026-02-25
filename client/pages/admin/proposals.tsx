import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminTable from '@/components/admin/AdminTable';
import StatCard from '@/components/admin/StatCard';
import styles from './proposals.module.css';

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: string;
  type: string;
  createdAt: string;
  votingEndDate?: string;
  flagged?: boolean;
}

interface ProposalStats {
  totalProposals: number;
  activeProposals: number;
  passedProposals: number;
  failedProposals: number;
  suspendedProposals: number;
  flaggedProposals: number;
}

export default function ProposalsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState<ProposalStats>({
    totalProposals: 0,
    activeProposals: 0,
    passedProposals: 0,
    failedProposals: 0,
    suspendedProposals: 0,
    flaggedProposals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());
  const [daoName, setDaoName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);

  const daoId = router.query.daoId as string;

  // Fetch proposals
  useEffect(() => {
    if (!daoId || !session) return;

    const fetchProposals = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          ...(statusFilter !== 'all' && { status: statusFilter }),
        });

        const response = await fetch(`/api/admin/daos/${daoId}/proposals?${params}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch proposals: ${response.statusText}`);
        }

        const data = await response.json();
        setProposals(data.proposals);
        setDaoName(data.dao.name);
        setUserRole(data.userRole);
        setCanManage(data.canManage);
        setTotal(data.pagination.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch proposals');
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, [daoId, page, statusFilter, session]);

  // Fetch stats
  useEffect(() => {
    if (!daoId || !session) return;

    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/admin/daos/${daoId}/proposals/stats`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }

        const data = await response.json();
        setStats(data.stats);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchStats();
  }, [daoId, session]);

  const handleFlagProposal = async (proposalId: string) => {
    try {
      setFlaggingId(proposalId);
      const response = await fetch(`/api/admin/daos/${daoId}/proposals/${proposalId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Flagged for review',
          severity: 'high',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to flag proposal');
      }

      // Update proposals list
      setProposals(proposals.map(p => 
        p.id === proposalId ? { ...p, flagged: true } : p
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to flag proposal');
    } finally {
      setFlaggingId(null);
    }
  };

  const handleSuspendProposal = async (proposalId: string) => {
    try {
      setFlaggingId(proposalId);
      const response = await fetch(`/api/admin/daos/${daoId}/proposals/${proposalId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Suspended by super admin',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to suspend proposal');
      }

      // Update proposals list
      setProposals(proposals.map(p => 
        p.id === proposalId ? { ...p, status: 'suspended' } : p
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend proposal');
    } finally {
      setFlaggingId(null);
    }
  };

  const handleViewDetails = (proposalId: string) => {
    router.push(`/admin/proposals/${daoId}/${proposalId}`);
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (value: string) => <span className={styles.titleCell}>{value}</span>,
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
      key: 'type',
      label: 'Type',
      render: (value: string) => <span className={styles.typeCell}>{value}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'flagged',
      label: 'Flagged',
      render: (value: boolean) => (
        <span className={value ? styles.flaggedYes : styles.flaggedNo}>
          {value ? '⚠️ Yes' : 'No'}
        </span>
      ),
    },
  ];

  const actions = [
    {
      label: 'View',
      onClick: (row: Proposal) => handleViewDetails(row.id),
      variant: 'secondary',
    },
    ...(userRole === 'super_admin'
      ? [
          {
            label: 'Flag',
            onClick: (row: Proposal) => handleFlagProposal(row.id),
            variant: 'warning' as const,
            disabled: row.flagged || flaggingId === row.id,
          },
          {
            label: 'Suspend',
            onClick: (row: Proposal) => handleSuspendProposal(row.id),
            variant: 'danger' as const,
            disabled: row.status === 'suspended' || flaggingId === row.id,
          },
        ]
      : []),
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

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>Proposals Management</h1>
            <p className={styles.daoName}>DAO: {daoName}</p>
          </div>
          <div className={styles.accessLevel}>
            <span className={styles.role}>{userRole}</span>
            {userRole === 'super_admin' && (
              <span className={styles.badge}>Platform Admin</span>
            )}
            {canManage && userRole !== 'super_admin' && (
              <span className={styles.badge}>DAO Admin</span>
            )}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.statsGrid}>
          <StatCard
            title="Total Proposals"
            value={stats.totalProposals}
            icon="📋"
            trend={undefined}
          />
          <StatCard
            title="Active"
            value={stats.activeProposals}
            icon="⚡"
            trend={undefined}
          />
          <StatCard
            title="Passed"
            value={stats.passedProposals}
            icon="✅"
            trend={undefined}
          />
          <StatCard
            title="Failed"
            value={stats.failedProposals}
            icon="❌"
            trend={undefined}
          />
          <StatCard
            title="Suspended"
            value={stats.suspendedProposals}
            icon="⛔"
            trend={undefined}
          />
          <StatCard
            title="Flagged"
            value={stats.flaggedProposals}
            icon="🚩"
            trend={undefined}
          />
        </div>

        <div className={styles.filterSection}>
          <label>
            Status Filter:
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={styles.filterSelect}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </div>

        <div className={styles.tableContainer}>
          {loading ? (
            <p className={styles.loading}>Loading proposals...</p>
          ) : proposals.length === 0 ? (
            <p className={styles.emptyState}>No proposals found</p>
          ) : (
            <AdminTable
              data={proposals}
              columns={columns}
              actions={actions}
              selectedRows={selectedProposals}
              onSelectRow={(id) => {
                const newSelected = new Set(selectedProposals);
                if (newSelected.has(id)) {
                  newSelected.delete(id);
                } else {
                  newSelected.add(id);
                }
                setSelectedProposals(newSelected);
              }}
              onSelectAll={(ids) => setSelectedProposals(new Set(ids))}
            />
          )}
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
