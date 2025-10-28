import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Plus, Edit, Trash2, Eye, EyeOff, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: number;
  isActive: boolean;
  targetAudience: string;
  linkUrl: string | null;
  linkText: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdByEmail: string | null;
  createdByName: string | null;
  views: number;
  dismissed: number;
}

export default function AnnouncementsManagement() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    priority: 0,
    targetAudience: 'all',
    linkUrl: '',
    linkText: '',
    startsAt: '',
    expiresAt: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch announcements
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/announcements/admin/list', page, typeFilter, statusFilter],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/announcements/admin/list?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json();
    },
    staleTime: 1 * 60 * 1000,
  });

  // Create announcement mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/announcements/admin/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to create announcement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/admin/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] }); // Refresh user announcements
      toast({
        title: 'Success',
        description: 'Announcement created successfully',
      });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update announcement mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/announcements/admin/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to update announcement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/admin/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      toast({
        title: 'Success',
        description: 'Announcement updated successfully',
      });
      setShowDialog(false);
      setEditingAnnouncement(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete announcement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/announcements/admin/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete announcement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/admin/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      toast({
        title: 'Success',
        description: 'Announcement deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      type: 'info',
      priority: 0,
      targetAudience: 'all',
      linkUrl: '',
      linkText: '',
      startsAt: '',
      expiresAt: '',
    });
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type,
      priority: announcement.priority,
      targetAudience: announcement.targetAudience,
      linkUrl: announcement.linkUrl || '',
      linkText: announcement.linkText || '',
      startsAt: announcement.startsAt ? new Date(announcement.startsAt).toISOString().slice(0, 16) : '',
      expiresAt: announcement.expiresAt ? new Date(announcement.expiresAt).toISOString().slice(0, 16) : '',
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleActive = (announcement: Announcement) => {
    updateMutation.mutate({
      id: announcement.id,
      data: { isActive: !announcement.isActive },
    });
  };

  const getTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      info: 'bg-blue-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500',
      success: 'bg-green-500',
    };

    return (
      <Badge className={typeColors[type] || 'bg-gray-500'}>
        {type.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Announcements Management</h1>
              <p className="text-white/70">Manage platform-wide announcements</p>
            </div>
            <Button
              onClick={() => {
                setEditingAnnouncement(null);
                resetForm();
                setShowDialog(true);
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Announcement
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{data?.pagination.total || 0}</div>
                <div className="text-white/70 text-sm mt-1">Total Announcements</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">
                  {data?.announcements.filter((a: Announcement) => a.isActive).length || 0}
                </div>
                <div className="text-white/70 text-sm mt-1">Active</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">
                  {data?.announcements.reduce((sum: number, a: Announcement) => sum + a.views, 0) || 0}
                </div>
                <div className="text-white/70 text-sm mt-1">Total Views</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">
                  {data?.announcements.reduce((sum: number, a: Announcement) => sum + a.dismissed, 0) || 0}
                </div>
                <div className="text-white/70 text-sm mt-1">Total Dismissed</div>
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
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => {
                  setTypeFilter('');
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

        {/* Announcements Table */}
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Announcements</CardTitle>
            <CardDescription className="text-white/70">
              {data?.pagination.total || 0} total announcements
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                Error loading announcements. Please try again.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white">Title</TableHead>
                      <TableHead className="text-white">Type</TableHead>
                      <TableHead className="text-white">Status</TableHead>
                      <TableHead className="text-white">Priority</TableHead>
                      <TableHead className="text-white">Views / Dismissed</TableHead>
                      <TableHead className="text-white">Created</TableHead>
                      <TableHead className="text-white">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.announcements.map((announcement: Announcement) => (
                      <TableRow key={announcement.id} className="border-white/10">
                        <TableCell>
                          <div>
                            <div className="font-semibold text-white">{announcement.title}</div>
                            <div className="text-sm text-white/60 truncate max-w-xs">
                              {announcement.message}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(announcement.type)}</TableCell>
                        <TableCell>
                          <Badge className={announcement.isActive ? 'bg-green-500' : 'bg-gray-500'}>
                            {announcement.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white">{announcement.priority}</TableCell>
                        <TableCell className="text-white/80">
                          {announcement.views} / {announcement.dismissed}
                        </TableCell>
                        <TableCell className="text-white/80">
                          {new Date(announcement.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => toggleActive(announcement)}
                            >
                              {announcement.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                              onClick={() => handleEdit(announcement)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this announcement?')) {
                                  deleteMutation.mutate(announcement.id);
                                }
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

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="bg-gray-900 border-white/20 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
              <DialogDescription className="text-white/70">
                {editingAnnouncement ? 'Update announcement details' : 'Create a new platform announcement'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label className="text-white mb-2 block">Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-white/5 border-white/20 text-white"
                  placeholder="Announcement title"
                />
              </div>

              <div>
                <Label className="text-white mb-2 block">Message *</Label>
                <Textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-white/5 border-white/20 text-white"
                  placeholder="Announcement message"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white mb-2 block">Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white mb-2 block">Priority</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    className="bg-white/5 border-white/20 text-white"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white mb-2 block">Link URL</Label>
                  <Input
                    value={formData.linkUrl}
                    onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label className="text-white mb-2 block">Link Text</Label>
                  <Input
                    value={formData.linkText}
                    onChange={(e) => setFormData({ ...formData, linkText: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                    placeholder="Learn More"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white mb-2 block">Starts At</Label>
                  <Input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white mb-2 block">Expires At</Label>
                  <Input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  setEditingAnnouncement(null);
                  resetForm();
                }}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.title || !formData.message || createMutation.isPending || updateMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {editingAnnouncement ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

