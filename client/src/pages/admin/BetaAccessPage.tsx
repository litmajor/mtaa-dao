import React, { useEffect, useState } from 'react';
import { useAdminBetaAccess } from '../../hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, Plus, Trash2, CheckCircle } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';

const AVAILABLE_FEATURES = [
  'advanced_analytics',
  'ai_assistant',
  'investment_pools',
  'locked_savings',
  'yield_strategies',
  'cross_chain',
  'nft_marketplace',
];

export function BetaAccessPage() {
  const { users, pagination, loading, error, fetchBetaUsers, grantBetaAccess, revokeBetaAccess } =
    useAdminBetaAccess();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchBetaUsers({ page: 1, limit: 20 });
  }, [fetchBetaUsers]);

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectFeature = (feature: string) => {
    const newSelected = new Set(selectedFeatures);
    if (newSelected.has(feature)) {
      newSelected.delete(feature);
    } else {
      newSelected.add(feature);
    }
    setSelectedFeatures(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map((u) => u.userId)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleGrant = async () => {
    if (selectedUsers.size === 0 || selectedFeatures.size === 0) {
      alert('Please select at least one user and one feature');
      return;
    }

    setIsGranting(true);
    try {
      await grantBetaAccess(Array.from(selectedUsers), Array.from(selectedFeatures));
      setSuccessMessage(
        `Granted ${Array.from(selectedFeatures).join(', ')} to ${selectedUsers.size} user(s)`
      );
      setSelectedUsers(new Set());
      setSelectedFeatures(new Set());
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to grant access:', err);
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevoke = async () => {
    if (selectedUsers.size === 0) {
      alert('Please select at least one user');
      return;
    }

    if (!window.confirm('Are you sure you want to revoke access?')) {
      return;
    }

    setIsRevoking(true);
    try {
      await revokeBetaAccess(
        Array.from(selectedUsers),
        selectedFeatures.size > 0 ? Array.from(selectedFeatures) : undefined
      );
      setSuccessMessage(
        `Revoked access for ${selectedUsers.size} user(s)`
      );
      setSelectedUsers(new Set());
      setSelectedFeatures(new Set());
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to revoke access:', err);
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Beta Access Management</h1>
        <p className="text-muted-foreground mt-2">
          Grant or revoke beta features for users
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

      {/* Feature Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle>Select Features to Grant/Revoke</CardTitle>
          <CardDescription>
            Choose which features to enable for the selected users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {AVAILABLE_FEATURES.map((feature) => (
              <label
                key={feature}
                className="flex items-center gap-2 p-3 border border-input rounded-lg cursor-pointer hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  aria-label={`Select feature: ${feature}`}
                  checked={selectedFeatures.has(feature)}
                  onChange={() => handleSelectFeature(feature)}
                  className="rounded"
                />
                <span className="text-sm font-medium capitalize">
                  {feature.replace(/_/g, ' ')}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Beta Access Users</CardTitle>
              <CardDescription>
                {selectedUsers.size > 0
                  ? `${selectedUsers.size} user(s) selected`
                  : `${pagination.total} total users`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGrant}
                disabled={selectedUsers.size === 0 || selectedFeatures.size === 0 || isGranting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Grant Access
              </button>
              <button
                onClick={handleRevoke}
                disabled={selectedUsers.size === 0 || isRevoking}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Revoke Access
              </button>
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
                  <th className="text-left py-3 px-4 font-semibold">Username</th>
                  <th className="text-left py-3 px-4 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 font-semibold">Features</th>
                  <th className="text-left py-3 px-4 font-semibold">Granted At</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="py-3 px-4">
                          <Skeleton className="h-4 w-4" />
                        </td>
                        <td className="py-3 px-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="py-3 px-4">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="py-3 px-4">
                          <Skeleton className="h-4 w-40" />
                        </td>
                        <td className="py-3 px-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                      </tr>
                    ))
                  : users.map((user) => (
                      <tr
                        key={user.userId}
                        className="border-b border-border hover:bg-muted/50"
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            aria-label={`Select user ${user.username}`}
                            checked={selectedUsers.has(user.userId)}
                            onChange={() => handleSelectUser(user.userId)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{user.username}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-muted-foreground">{user.email}</p>
                          {user.email_verified && (
                            <p className="text-xs text-green-600">✓ Verified</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {user.features.length > 0 ? (
                              user.features.map((feature) => (
                                <span
                                  key={feature}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                                >
                                  {feature}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted-foreground">None</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-muted-foreground text-xs">
                            {new Date(user.grantedAt).toLocaleDateString()}
                          </p>
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
                onClick={() => fetchBetaUsers({ page: Math.max(1, pagination.page - 1), limit: 20 })}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-input rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  fetchBetaUsers({ page: Math.min(pagination.pages, pagination.page + 1), limit: 20 })
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

export default BetaAccessPage;
