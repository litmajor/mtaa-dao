import React, { useState, useEffect } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useRouter } from 'next/router';
import { useAuth } from '@clerk/nextjs';
import Head from 'next/head';
import styles from './members.module.css';

interface Member {
  id: string;
  userId: string;
  daoId: string;
  role: 'member' | 'contributor' | 'elder' | 'admin';
  joinedAt: string;
  isActive: boolean;
  memberCount?: number;
  votingPower?: number;
  userName?: string;
  userEmail?: string;
}

interface MembersStats {
  total: number;
  admins: number;
  elders: number;
  contributors: number;
  members: number;
  active: number;
  inactive: number;
}

export default function MembersPage() {
  const router = useRouter();
  const { daoId } = router.query;
  const { userId } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<MembersStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('joinedAt');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  useEffect(() => {
    if (daoId && userId) {
      fetchMembers();
      fetchStats();
    }
  }, [daoId, userId, filterRole, filterStatus, page, searchQuery]);

  const fetchMembers = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (searchQuery) params.append('search', searchQuery);
      if (filterRole !== 'all') params.append('role', filterRole);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (sortBy) params.append('sort', sortBy);

      const response = await fetch(
        `/api/admin/daos/${daoId}/members?${params.toString()}`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/members/stats`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handlePromote = async (memberId: string) => {
    setActionInProgress(true);
    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/members/${memberId}/promote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to promote member');
      }

      await fetchMembers();
      await fetchStats();
      setSelectedMember(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDemote = async (memberId: string) => {
    setActionInProgress(true);
    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/members/${memberId}/demote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to demote member');
      }

      await fetchMembers();
      await fetchStats();
      setSelectedMember(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setPendingRemove(memberId);
    setConfirmRemoveOpen(true);
  };

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setActionInProgress(true);
    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/members/${pendingRemove}/remove`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      await fetchMembers();
      await fetchStats();
      setSelectedMember(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionInProgress(false);
      setPendingRemove(null);
      setConfirmRemoveOpen(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#dc2626';
      case 'elder':
        return '#9333ea';
      case 'contributor':
        return '#2563eb';
      case 'member':
        return '#64748b';
      default:
        return '#6b7280';
    }
  };

  const getRoleLabel = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <>
      <Head>
        <title>Member Management</title>
        <meta name="description" content="Manage DAO members and roles" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Member Management</h1>
          <p>Manage DAO members, roles, and permissions</p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}
        <ConfirmDialog
          open={confirmRemoveOpen}
          title="Remove member"
          description="Are you sure you want to remove this member from the DAO?"
          confirmLabel="Remove"
          cancelLabel="Cancel"
          onClose={(open: boolean) => setConfirmRemoveOpen(open)}
          onConfirm={confirmRemove}
        />

        {/* Statistics */}
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.total}</div>
              <div className={styles.statLabel}>Total Members</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.active}</div>
              <div className={styles.statLabel}>Active</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.admins}</div>
              <div className={styles.statLabel}>Admins</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.elders}</div>
              <div className={styles.statLabel}>Elders</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.contributors}</div>
              <div className={styles.statLabel}>Contributors</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.members}</div>
              <div className={styles.statLabel}>Members</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={styles.filtersPanel}>
          <div className={styles.filterGroup}>
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setPage(1);
              }}
              className={styles.filterSelect}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="elder">Elder</option>
              <option value="contributor">Contributor</option>
              <option value="member">Member</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className={styles.filterSelect}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="joinedAt">Sort: Newest Joined</option>
              <option value="joinedAt-asc">Sort: Oldest Joined</option>
              <option value="role">Sort: Role</option>
            </select>
          </div>
        </div>

        {/* Members Table */}
        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}>Loading members...</div>
          </div>
        ) : members.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No members found</p>
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className={styles.tableRow}>
                      <td className={styles.memberCell}>
                        <div className={styles.memberInfo}>
                          <div className={styles.memberName}>
                            {member.userName || `User #${member.userId.slice(0, 8)}`}
                          </div>
                          <div className={styles.memberEmail}>
                            {member.userEmail || 'No email'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={styles.roleBadge}
                          style={{ backgroundColor: getRoleColor(member.role) }}
                        >
                          {getRoleLabel(member.role)}
                        </span>
                      </td>
                      <td className={styles.dateCell}>
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      <td>
                        <span
                          className={styles.statusBadge}
                          style={{
                            backgroundColor: member.isActive ? '#10b981' : '#6b7280',
                          }}
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className={styles.actionCell}>
                        {member.isActive && (
                          <div className={styles.actionButtons}>
                            {member.role !== 'admin' && (
                              <button
                                onClick={() => handlePromote(member.id)}
                                disabled={actionInProgress}
                                className={styles.buttonSmall}
                                style={{ backgroundColor: '#2563eb' }}
                                title="Promote to next role"
                              >
                                ↑ Promote
                              </button>
                            )}
                            {member.role !== 'member' && (
                              <button
                                onClick={() => handleDemote(member.id)}
                                disabled={actionInProgress}
                                className={styles.buttonSmall}
                                style={{ backgroundColor: '#f59e0b' }}
                                title="Demote to previous role"
                              >
                                ↓ Demote
                              </button>
                            )}
                            <button
                              onClick={() => handleRemove(member.id)}
                              disabled={actionInProgress}
                              className={styles.buttonSmall}
                              style={{ backgroundColor: '#dc2626' }}
                              title="Remove member"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={styles.pagination}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={styles.paginationButton}
              >
                ← Previous
              </button>
              <span className={styles.pageInfo}>
                Page {page}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={members.length < pageSize}
                className={styles.paginationButton}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
