/**
 * Admin Recovery Dashboard
 * Day 3 - Manage soft-deleted users, DAOs, and admins
 * 
 * Features:
 * - List soft-deleted items with recovery windows
 * - Restore items within 30-day window
 * - View deletion reason and deleted by
 * - Countdown to permanent deletion
 * - Bulk recovery/deletion actions
 * - Power Checklist: #1 Reversibility, #3 Approval Authority
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { authClient } from '@/utils/authClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/use-toast';
import { 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Trash2,
  Filter,
  ChevronDown,
  Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RecoveryItem {
  id: string;
  type: 'user' | 'dao' | 'admin';
  name: string;
  deletedAt: string;
  deletedBy: string;
  reason: string;
  recoveryDeadline: string;
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export function RecoveryDashboard() {
  const { toast } = useToast();
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'user' | 'dao' | 'admin'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<RecoveryItem | null>(null);
  const [actionType, setActionType] = useState<'restore' | 'delete'>('restore');
  const [restoreReason, setRestoreReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  // Fetch recovery items
  useEffect(() => {
    loadRecoveryItems();
    const interval = setInterval(loadRecoveryItems, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadRecoveryItems = async () => {
    try {
      setLoading(true);
      const data = await authClient.get('/api/admin/soft-delete-recovery/items');
      setItems(data.items);
    } catch (error) {
      console.error('Error loading recovery items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load soft-deleted items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedItem) return;

    try {
      await authClient.post(
        `/api/admin/soft-delete-recovery/items/${selectedItem.type}/${selectedItem.id}/restore`,
        { reason: restoreReason || 'Admin restoration' }
      );

      toast({
        title: 'Success',
        description: `${selectedItem.type} restored successfully`,
      });

      setShowDialog(false);
      loadRecoveryItems();
    } catch (error) {
      console.error('Error restoring item:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to restore item',
        variant: 'destructive',
      });
    }
  };

  const handleForceDelete = async () => {
    if (!selectedItem) return;

    try {
      await authClient.post(
        `/api/admin/soft-delete-recovery/items/${selectedItem.type}/${selectedItem.id}/force-delete`,
        {
          reason: deleteReason || 'Permanent deletion',
          confirmDelete: true,
        }
      );

      toast({
        title: 'Permanent Deletion',
        description: `${selectedItem.type} permanently deleted (cannot be undone)`,
      });

      setShowDialog(false);
      loadRecoveryItems();
    } catch (error) {
      console.error('Error force deleting item:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to permanently delete item',
        variant: 'destructive',
      });
    }
  };

  const filteredItems = items.filter(item => {
    if (filter !== 'all' && item.type !== filter) return false;
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: items.length,
    users: items.filter(i => i.type === 'user').length,
    daos: items.filter(i => i.type === 'dao').length,
    admins: items.filter(i => i.type === 'admin').length,
    expiring: items.filter(i => i.isExpiringSoon).length,
    expired: items.filter(i => i.isExpired).length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recovery Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage soft-deleted users, DAOs, and admins. Items can be recovered within 30 days.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Deleted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">DAOs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.daos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-600">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.expiring}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-600">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="user">Users</TabsTrigger>
                  <TabsTrigger value="dao">DAOs</TabsTrigger>
                  <TabsTrigger value="admin">Admins</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:w-64"
            />

            <Button
              variant="outline"
              onClick={loadRecoveryItems}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Loading recovery items...</p>
            </CardContent>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">No soft-deleted items found</p>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card key={`${item.type}-${item.id}`} className={item.isExpired ? 'opacity-75' : ''}>
              <CardContent className="py-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  {/* Name and Type */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Item</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.type === 'user' ? 'default' : item.type === 'dao' ? 'secondary' : 'outline'}>
                        {item.type.toUpperCase()}
                      </Badge>
                      <p className="font-medium truncate">{item.name}</p>
                    </div>
                  </div>

                  {/* Deletion Info */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Deleted</p>
                    <p className="text-sm">
                      {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-muted-foreground">by {item.deletedBy}</p>
                  </div>

                  {/* Reason */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Reason</p>
                    <p className="text-sm line-clamp-2">{item.reason}</p>
                  </div>

                  {/* Recovery Countdown */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Recovery
                    </p>
                    {item.isExpired ? (
                      <Badge variant="destructive" className="w-fit">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Expired
                      </Badge>
                    ) : item.isExpiringSoon ? (
                      <div>
                        <Badge variant="secondary" className="w-fit mb-1">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {item.daysRemaining} days
                        </Badge>
                        <p className="text-xs text-muted-foreground">Expires soon!</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">{item.daysRemaining} days remaining</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {formatDistanceToNow(new Date(item.recoveryDeadline), { addSuffix: true })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 items-end">
                    <Button
                      size="sm"
                      variant={item.isExpired ? 'outline' : 'default'}
                      onClick={() => {
                        setSelectedItem(item);
                        setActionType('restore');
                        setRestoreReason('');
                        setShowDialog(true);
                      }}
                      disabled={item.isExpired}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Restore
                    </Button>

                    {item.isExpired && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedItem(item);
                          setActionType('delete');
                          setDeleteReason('');
                          setShowDialog(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Action Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {actionType === 'restore'
              ? `Restore ${selectedItem?.type}?`
              : `Permanently Delete ${selectedItem?.type}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {actionType === 'restore' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p>Item: <strong>{selectedItem?.name}</strong></p>
                  <p>Days remaining: <strong>{selectedItem?.daysRemaining}</strong></p>
                  <p className="text-sm text-muted-foreground">
                    Reason for restoration (optional):
                  </p>
                  <Input
                    placeholder="Enter reason..."
                    value={restoreReason}
                    onChange={(e) => setRestoreReason(e.target.value)}
                  />
                </div>
                <p className="text-sm">This action will restore the item and make it available again.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-3">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-destructive">This action is permanent</p>
                    <p className="text-sm">The item cannot be recovered after permanent deletion.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p>Item: <strong>{selectedItem?.name}</strong></p>
                  <p className="text-sm text-muted-foreground">
                    Reason for deletion (optional):
                  </p>
                  <Input
                    placeholder="Enter reason..."
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                  />
                </div>
              </div>
            )}
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => (actionType === 'restore' ? handleRestore() : handleForceDelete())}
              className={actionType === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {actionType === 'restore' ? 'Restore' : 'Permanently Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="w-5 h-5" />
            About Soft Delete Recovery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>30-Day Recovery Window:</strong> All deleted items are kept for 30 days before permanent deletion.
          </p>
          <p>
            <strong>Authority Tracking:</strong> Every deletion is logged with the admin who performed it, reason, and timestamp.
          </p>
          <p>
            <strong>Audit Trail:</strong> All recovery actions are recorded in the audit log for compliance.
          </p>
          <p>
            <strong>Power Checklist:</strong> This system ensures reversibility (#1) and approval authority (#3) compliance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default RecoveryDashboard;
