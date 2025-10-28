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
import { Search, CheckCircle, XCircle, Archive, Eye, Loader2, ChevronLeft, ChevronRight, Users, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DAO {
  id: string;
  name: string;
  description: string | null;
  status: string;
  subscriptionPlan: string | null;
  createdAt: string;
  founderId: string;
  memberCount: number;
}

export default function DaoModeration() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDao, setSelectedDao] = useState<DAO | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'suspend' | 'archive' | null>(null);
  const [reason, setReason] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch DAOs
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/admin/daos/list', page, search, statusFilter],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/admin/daos/list?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch DAOs');
      return res.json();
    },
    staleTime: 1 * 60 * 1000,
  });

  // Update DAO status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ daoId, status }: { daoId: string; status: string }) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/daos/${daoId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, reason }),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to update DAO status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/daos/list'] });
      toast({
        title: 'Success',
        description: `DAO status updated successfully`,
      });
      setSelectedDao(null);
      setActionType(null);
      setReason('');
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
    if (!selectedDao || !actionType) return;

    const statusMap = {
      approve: 'active',
      suspend: 'suspended',
      archive: 'archived',
    };

    statusMutation.mutate({ daoId: selectedDao.id, status: statusMap[actionType] });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-500',
      pending: 'bg-yellow-500',
      suspended: 'bg-red-500',
      archived: 'bg-gray-500',
    };

    return (
      <Badge className={statusColors[status] || 'bg-gray-500'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getPlanBadge = (plan: string | null) => {
    const planColors: Record<string, string> = {
      free: 'bg-gray-500',
      basic: 'bg-blue-500',
      pro: 'bg-purple-500',
      enterprise: 'bg-gold-500',
    };

    return (
      <Badge className={planColors[plan || 'free'] || 'bg-gray-500'}>
        {(plan || 'free').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">DAO Moderation</h1>
          <p className="text-white/70">Oversee and manage all DAOs on the platform</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{data?.pagination.total || 0}</div>
                <div className="text-white/70 text-sm mt-1">Total DAOs</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">
                  {data?.daos.filter((d: DAO) => d.status === 'active').length || 0}
                </div>
                <div className="text-white/70 text-sm mt-1">Active</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">
                  {data?.daos.filter((d: DAO) => d.status === 'pending').length || 0}
                </div>
                <div className="text-white/70 text-sm mt-1">Pending</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">
                  {data?.daos.filter((d: DAO) => d.status === 'suspended').length || 0}
                </div>
                <div className="text-white/70 text-sm mt-1">Suspended</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4" />
                <Input
                  placeholder="Search by DAO name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white/5 border-white/20 text-white"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => {
                  setSearch('');
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

        {/* DAOs Table */}
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">DAOs</CardTitle>
            <CardDescription className="text-white/70">
              {data?.pagination.total || 0} total DAOs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                Error loading DAOs. Please try again.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white">DAO Name</TableHead>
                      <TableHead className="text-white">Status</TableHead>
                      <TableHead className="text-white">Plan</TableHead>
                      <TableHead className="text-white">Members</TableHead>
                      <TableHead className="text-white">Created</TableHead>
                      <TableHead className="text-white">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.daos.map((dao: DAO) => (
                      <TableRow key={dao.id} className="border-white/10">
                        <TableCell>
                          <div>
                            <div className="font-semibold text-white">{dao.name}</div>
                            <div className="text-sm text-white/60 truncate max-w-xs">
                              {dao.description || 'No description'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(dao.status)}</TableCell>
                        <TableCell>{getPlanBadge(dao.subscriptionPlan)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-white/80">
                            <Users className="w-4 h-4" />
                            <span>{dao.memberCount}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-white/80">
                          {new Date(dao.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Link to={`/dao/${dao.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-white/20 text-white hover:bg-white/10"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            {dao.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-green-500/50 text-green-400 hover:bg-green-500/20"
                                onClick={() => {
                                  setSelectedDao(dao);
                                  setActionType('approve');
                                }}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {dao.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                                onClick={() => {
                                  setSelectedDao(dao);
                                  setActionType('suspend');
                                }}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-500/50 text-gray-400 hover:bg-gray-500/20"
                              onClick={() => {
                                setSelectedDao(dao);
                                setActionType('archive');
                              }}
                            >
                              <Archive className="w-4 h-4" />
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
        <AlertDialog open={!!selectedDao && !!actionType} onOpenChange={(open) => !open && (setSelectedDao(null), setActionType(null), setReason(''))}>
          <AlertDialogContent className="bg-gray-900 border-white/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {actionType === 'approve' && 'Approve DAO'}
                {actionType === 'suspend' && 'Suspend DAO'}
                {actionType === 'archive' && 'Archive DAO'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                {actionType === 'approve' &&
                  `Approve ${selectedDao?.name} to make it active on the platform?`}
                {actionType === 'suspend' &&
                  `Suspend ${selectedDao?.name}? Members will not be able to access this DAO.`}
                {actionType === 'archive' &&
                  `Archive ${selectedDao?.name}? This DAO will be hidden from public view.`}
                
                <div className="mt-4">
                  <label className="text-white mb-2 block text-sm">Reason (optional):</label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for this action..."
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAction}
                className={`${
                  actionType === 'suspend' ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
                } text-white`}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

