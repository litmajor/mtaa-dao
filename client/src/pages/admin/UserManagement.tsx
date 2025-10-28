import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, UserX, UserCheck, Trash2, Shield, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  roles: string;
  createdAt: string;
  lastLoginAt: string | null;
  isBanned: boolean;
  votingTokenBalance: string | number;
}

export default function UserManagement() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'ban' | 'unban' | 'delete' | 'role' | null>(null);
  const [newRole, setNewRole] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/admin/users/list', page, search, roleFilter, statusFilter],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/admin/users/list?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    staleTime: 1 * 60 * 1000,
  });

  // Ban/unban user mutation
  const banMutation = useMutation({
    mutationFn: async ({ userId, banned }: { userId: string; banned: boolean }) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ banned }),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to update user ban status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/list'] });
      toast({
        title: 'Success',
        description: `User ${actionType === 'ban' ? 'banned' : 'unbanned'} successfully`,
      });
      setSelectedUser(null);
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/list'] });
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
      setSelectedUser(null);
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update role mutation
  const roleUpdateMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to update user role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/list'] });
      toast({
        title: 'Success',
        description: 'User role updated successfully',
      });
      setSelectedUser(null);
      setActionType(null);
      setNewRole('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAction = () => {
    if (!selectedUser) return;

    if (actionType === 'ban') {
      banMutation.mutate({ userId: selectedUser.id, banned: true });
    } else if (actionType === 'unban') {
      banMutation.mutate({ userId: selectedUser.id, banned: false });
    } else if (actionType === 'delete') {
      deleteMutation.mutate(selectedUser.id);
    } else if (actionType === 'role' && newRole) {
      roleUpdateMutation.mutate({ userId: selectedUser.id, role: newRole });
    }
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      super_admin: 'bg-red-500',
      admin: 'bg-purple-500',
      moderator: 'bg-blue-500',
      user: 'bg-gray-500',
    };

    return (
      <Badge className={roleColors[role] || 'bg-gray-500'}>
        {role.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-white/70">Manage users, roles, and permissions</p>
        </div>

        {/* Filters */}
        <Card className="mb-6 bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4" />
                <Input
                  placeholder="Search by email, name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white/5 border-white/20 text-white"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => {
                  setSearch('');
                  setRoleFilter('');
                  setStatusFilter('');
                  setPage(1);
                }}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Users</CardTitle>
            <CardDescription className="text-white/70">
              {data?.pagination.total || 0} total users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                Error loading users. Please try again.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white">User</TableHead>
                      <TableHead className="text-white">Email</TableHead>
                      <TableHead className="text-white">Role</TableHead>
                      <TableHead className="text-white">Status</TableHead>
                      <TableHead className="text-white">Joined</TableHead>
                      <TableHead className="text-white">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.users.map((user: User) => (
                      <TableRow key={user.id} className="border-white/10">
                        <TableCell className="text-white">
                          {user.username ||
                            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                            'Anonymous'}
                        </TableCell>
                        <TableCell className="text-white/80">{user.email}</TableCell>
                        <TableCell>{getRoleBadge(user.roles)}</TableCell>
                        <TableCell>
                          {user.isBanned ? (
                            <Badge className="bg-red-500">Banned</Badge>
                          ) : (
                            <Badge className="bg-green-500">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-white/80">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('role');
                                setNewRole(user.roles);
                              }}
                            >
                              <Shield className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className={`border-white/20 hover:bg-white/10 ${
                                user.isBanned ? 'text-green-400' : 'text-yellow-400'
                              }`}
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType(user.isBanned ? 'unban' : 'ban');
                              }}
                            >
                              {user.isBanned ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('delete');
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-white/70 text-sm">
                    Page {data?.pagination.page} of {data?.pagination.pages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= (data?.pagination.pages || 1)}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <AlertDialog open={!!selectedUser && !!actionType} onOpenChange={(open) => !open && (setSelectedUser(null), setActionType(null))}>
          <AlertDialogContent className="bg-gray-900 border-white/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {actionType === 'ban' && 'Ban User'}
                {actionType === 'unban' && 'Unban User'}
                {actionType === 'delete' && 'Delete User'}
                {actionType === 'role' && 'Change User Role'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                {actionType === 'ban' &&
                  `Are you sure you want to ban ${selectedUser?.email}? They will no longer be able to access the platform.`}
                {actionType === 'unban' &&
                  `Are you sure you want to unban ${selectedUser?.email}? They will regain access to the platform.`}
                {actionType === 'delete' &&
                  `Are you sure you want to permanently delete ${selectedUser?.email}? This action cannot be undone.`}
                {actionType === 'role' && (
                  <div className="mt-4">
                    <label className="text-white mb-2 block">Select new role for {selectedUser?.email}:</label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAction}
                className={`${
                  actionType === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
                } text-white`}
              >
                {actionType === 'delete' ? 'Delete' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

