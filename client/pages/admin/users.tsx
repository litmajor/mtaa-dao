import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminTable } from '@/components/admin/AdminTable';
import { Search, Plus } from 'lucide-react';
import styles from './users.module.css';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  roles: string;
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
  }, [page, search, role, status]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(role !== 'all' && { role }),
        ...(status !== 'all' && { status }),
      });

      const res = await fetch(`/api/admin/users/list?${params}`);
      const data = await res.json();

      setUsers(data.users);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (userId: string) => {
    if (!confirm('Are you sure you want to ban this user?')) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banned: true, reason: 'Admin action' }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to ban user:', err);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to update user role:', err);
    }
  };

  const handleBulkBan = async () => {
    if (selectedUsers.length === 0) return;
    if (!confirm(`Ban ${selectedUsers.length} users?`)) return;

    try {
      const res = await fetch('/api/admin/users/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUsers,
          action: 'ban',
          reason: 'Bulk admin action',
        }),
      });

      if (res.ok) {
        setSelectedUsers([]);
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to ban users:', err);
    }
  };

  const columns = [
    {
      key: 'email',
      label: 'Email',
      render: (value: string) => <span>{value}</span>,
    },
    {
      key: 'username',
      label: 'Username',
      render: (value: string) => <span>{value}</span>,
    },
    {
      key: 'roles',
      label: 'Role',
      render: (value: string, row: User) => (
        <select
          value={value}
          onChange={(e) => handleChangeRole(row.id, e.target.value)}
          className={styles.roleSelect}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      ),
    },
    {
      key: 'isBanned',
      label: 'Status',
      render: (value: boolean) => (
        <span className={`${styles.badge} ${value ? styles.banned : styles.active}`}>
          {value ? 'Banned' : 'Active'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Joined',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
  ];

  return (
    <AdminLayout title="Users Management">
      <div className={styles.container}>
        {/* Filters */}
        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className={styles.select}
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>

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
            <option value="banned">Banned</option>
          </select>

          {selectedUsers.length > 0 && (
            <button className={styles.bulkActionBtn} onClick={handleBulkBan}>
              Ban {selectedUsers.length} Selected
            </button>
          )}
        </div>

        {/* Table */}
        <AdminTable
          columns={columns}
          rows={users}
          loading={loading}
          selectable={true}
          onSelectionChange={setSelectedUsers}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
          }}
          onRowClick={(row) => {
            // TODO: Open user detail modal
          }}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
