import React, { useEffect, useState } from 'react';
import { useAdminUsers } from '../../hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, Ban, Trash2, CheckCircle } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';

export function UsersPage() {
  const { users, pagination, loading, error, fetchUsers, banUser, deleteUser } = useAdminUsers();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [showBanModal, setShowBanModal] = useState(false);
  const [userToBan, setUserToBan] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers({ page: 1, limit: 20, sortBy, sortOrder });
  }, [fetchUsers]);

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleBan = async () => {
    if (!userToBan) return;
    if (!banReason.trim()) {
      alert('Please provide a reason for banning');
      return;
    }

    setActionInProgress(true);
    try {
      await banUser(userToBan, banReason);
      setSuccessMessage(`User ${userToBan} has been banned`);
      setBanReason('');
      setShowBanModal(false);
      setUserToBan(null);
      setSelectedUsers(new Set());
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to ban user:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this user and all their data?')) {
      return;
    }

    setActionInProgress(true);
    try {
      await deleteUser(userId);
      setSuccessMessage(`User ${userId} has been deleted`);
      setSelectedUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to delete user:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-2">
          View and manage user accounts
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500 rounded-lg text-green-700 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Ban User</CardTitle>
              <CardDescription>
                Provide a reason for banning this user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Reason</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason for ban..."
                  className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowBanModal(false);
                    setUserToBan(null);
                    setBanReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-input rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBan}
                  disabled={actionInProgress || !banReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {actionInProgress ? 'Banning...' : 'Ban User'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                {selectedUsers.size > 0
                  ? `${selectedUsers.size} user(s) selected`
                  : `${pagination.total} total users`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">
                    <input
                      type="checkbox"
                      aria-label="Select all users"
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted">
                    <button
                      onClick={() => {
                        setSortBy('username');
                        setSortOrder(sortBy === 'username' && sortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      className="flex items-center gap-1"
                    >
                      Username
                      {sortBy === 'username' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 font-semibold">Role</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Reputation</th>
                  <th className="text-left py-3 px-4 font-semibold">Activity</th>
                  <th className="text-left py-3 px-4 font-semibold">Created</th>
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="py-3 px-4">
                          <Skeleton className="h-4 w-4" />
                        </td>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="py-3 px-4">
                            <Skeleton className="h-4 w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-border hover:bg-muted/50"
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            aria-label={`Select user ${user.username}`}
                            checked={selectedUsers.has(user.id)}
                            onChange={() => handleSelectUser(user.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{user.username}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-muted-foreground text-xs">{user.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs capitalize">
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs capitalize ${
                              user.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : user.status === 'inactive'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{user.reputation.toFixed(2)}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-muted-foreground">{user.activityCount}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-muted-foreground text-xs">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {user.status !== 'banned' && (
                              <button
                                onClick={() => {
                                  setUserToBan(user.id);
                                  setShowBanModal(true);
                                }}
                                disabled={actionInProgress}
                                className="p-1 text-orange-600 hover:bg-orange-100 rounded disabled:opacity-50"
                                title="Ban user"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(user.id)}
                              disabled={actionInProgress}
                              className="p-1 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  fetchUsers({
                    page: Math.max(1, pagination.page - 1),
                    limit: 20,
                    sortBy,
                    sortOrder,
                  })
                }
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-input rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  fetchUsers({
                    page: Math.min(pagination.pages, pagination.page + 1),
                    limit: 20,
                    sortBy,
                    sortOrder,
                  })
                }
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 border border-input rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UsersPage;
