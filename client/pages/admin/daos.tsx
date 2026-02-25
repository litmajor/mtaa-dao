import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminTable } from '@/components/admin/AdminTable';
import { Search, AlertTriangle } from 'lucide-react';
import styles from './daos.module.css';

interface DAO {
  id: string;
  name: string;
  description: string;
  status: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

const AdminDAOs: React.FC = () => {
  const [daos, setDaos] = useState<DAO[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    fetchDAOs();
  }, [page, search, status]);

  const fetchDAOs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(status !== 'all' && { status }),
      });

      const res = await fetch(`/api/admin/daos/list?${params}`);
      const data = await res.json();

      setDaos(data.daos);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('Failed to fetch DAOs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (daoId: string) => {
    if (!confirm('Are you sure you want to suspend this DAO?')) return;

    try {
      const res = await fetch(`/api/admin/daos/${daoId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin action' }),
      });

      if (res.ok) {
        fetchDAOs();
      }
    } catch (err) {
      console.error('Failed to suspend DAO:', err);
    }
  };

  const handleRestore = async (daoId: string) => {
    try {
      const res = await fetch(`/api/admin/daos/${daoId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        fetchDAOs();
      }
    } catch (err) {
      console.error('Failed to restore DAO:', err);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'DAO Name',
      render: (value: string, row: DAO) => (
        <div>
          <p className={styles.daoName}>{value}</p>
          <p className={styles.daoId}>{row.id.substring(0, 8)}...</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span className={`${styles.badge} ${styles[value]}`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (value: string) => <span>{value || 'Free'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
  ];

  return (
    <AdminLayout title="DAOs Management">
      <div className={styles.container}>
        {/* Filters */}
        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search DAOs..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={styles.select}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Alerts */}
        <div className={styles.alerts}>
          <div className={styles.alert}>
            <AlertTriangle size={20} />
            <div>
              <p className={styles.alertTitle}>Suspended DAOs</p>
              <p className={styles.alertText}>There are currently suspended DAOs that may need review.</p>
            </div>
          </div>
        </div>

        {/* Table with Actions */}
        <div className={styles.tableWrapper}>
          <AdminTable
            columns={columns}
            rows={daos}
            loading={loading}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              onChange: setPage,
            }}
            onRowClick={(row) => {
              // TODO: Open DAO detail modal
            }}
          />
        </div>

        {/* Action buttons would be in the context menu */}
      </div>
    </AdminLayout>
  );
};

export default AdminDAOs;
