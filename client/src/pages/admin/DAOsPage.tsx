import React, { useEffect, useState } from 'react';
import { useAdminDAOs } from '../../hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, CheckCircle, Edit2 } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';

export function DAOsPage() {
  const { daos, pagination, loading, error, fetchDAOs, updateDAOStatus } = useAdminDAOs();
  const [selectedDAO, setSelectedDAO] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchDAOs({ page: 1, limit: 20 });
  }, [fetchDAOs]);

  const handleOpenStatusModal = (daoId: string, currentStatus: 'active' | 'inactive' | 'suspended') => {
    setSelectedDAO(daoId);
    setNewStatus(currentStatus);
    setShowStatusModal(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedDAO) return;

    setIsUpdating(true);
    try {
      await updateDAOStatus(selectedDAO, newStatus);
      setSuccessMessage(`DAO status updated to ${newStatus}`);
      setShowStatusModal(false);
      setSelectedDAO(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update DAO status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">DAO Management</h1>
        <p className="text-muted-foreground mt-2">
          View and manage DAO status
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

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Update DAO Status</CardTitle>
              <CardDescription>
                Change the status of this DAO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">New Status</label>
                <select
                  aria-label="New DAO Status"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as 'active' | 'inactive' | 'suspended')}
                  className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setSelectedDAO(null);
                  }}
                  className="flex-1 px-4 py-2 border border-input rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUpdating ? 'Updating...' : 'Update'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DAOs Grid */}
      <div className="grid gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))
          : daos.map((dao) => (
              <Card key={dao.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{dao.name}</h3>
                        <p className="text-sm text-muted-foreground">{dao.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusBadgeColor(
                            dao.status
                          )}`}
                        >
                          {dao.status}
                        </span>
                        <button
                          onClick={() =>
                            handleOpenStatusModal(
                              dao.id,
                              dao.status as 'active' | 'inactive' | 'suspended'
                            )
                          }
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Update status"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-foreground">{dao.description}</p>

                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Members</p>
                        <p className="text-lg font-semibold">{dao.memberCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Treasury</p>
                        <p className="text-lg font-semibold">${dao.treasuryBalance.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm font-semibold">
                          {new Date(dao.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">Creator</p>
                      <p className="text-sm font-mono">{dao.creator}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchDAOs({ page: Math.max(1, pagination.page - 1), limit: 20 })}
              disabled={pagination.page === 1}
              className="px-3 py-1 border border-input rounded disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <button
              onClick={() =>
                fetchDAOs({ page: Math.min(pagination.pages, pagination.page + 1), limit: 20 })
              }
              disabled={pagination.page === pagination.pages}
              className="px-3 py-1 border border-input rounded disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DAOsPage;
