/**
 * Admin - Announcements Management
 * Create, edit, and manage announcements across the platform
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Edit2, Trash2, Send, Eye, RefreshCw, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  audience: 'all' | 'members' | 'admins' | 'builders';
  views: number;
  clicks: number;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  createdAt: string;
  publishedAt?: string;
  expiresAt?: string;
}

const TYPE_COLORS: Record<string, string> = {
  info: 'bg-blue-600',
  warning: 'bg-yellow-600',
  success: 'bg-green-600',
  urgent: 'bg-red-600',
};

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('published');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'info',
    audience: 'all',
    expiresAt: '',
  });

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await authClient.get('/api/admin/announcements');
      setAnnouncements(data.announcements || []);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const handlePublish = async (id: string) => {
    try {
      await authClient.post(`/api/admin/announcements/${id}/publish`, {});
      fetchAnnouncements();
    } catch (error) {
      console.error('Failed to publish:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      try {
        await authClient.delete(`/api/admin/announcements/${id}`);
        fetchAnnouncements();
      } catch (error) {
        console.error('Failed to delete:', error);
      }
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authClient.post('/api/admin/announcements', formData);
      setFormData({ title: '', content: '', type: 'info', audience: 'all', expiresAt: '' });
      setShowForm(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('Failed to create announcement:', error);
    }
  };

  const filteredByTab = announcements.filter(a => {
    if (activeTab === 'published') return a.status === 'published';
    if (activeTab === 'draft') return a.status === 'draft';
    if (activeTab === 'scheduled') return a.status === 'scheduled';
    return a.status === 'archived';
  });

  const stats = {
    totalViews: announcements.reduce((sum, a) => sum + a.views, 0),
    totalClicks: announcements.reduce((sum, a) => sum + a.clicks, 0),
    published: announcements.filter(a => a.status === 'published').length,
    draft: announcements.filter(a => a.status === 'draft').length,
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Announcements</h1>
            <p className="text-slate-400">Create and manage platform announcements</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchAnnouncements}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Announcement
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Announcements</p>
            <p className="text-3xl font-bold text-blue-500">{announcements.length}</p>
            <p className="text-slate-400 text-sm mt-2">All time</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Published</p>
            <p className="text-3xl font-bold text-green-500">{stats.published}</p>
            <p className="text-slate-400 text-sm mt-2">Active</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Views</p>
            <p className="text-3xl font-bold text-purple-500">{(stats.totalViews / 1000).toFixed(1)}K</p>
            <p className="text-slate-400 text-sm mt-2">Page views</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Click Rate</p>
            <p className="text-3xl font-bold text-yellow-500">
              {stats.totalViews > 0 ? ((stats.totalClicks / stats.totalViews) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-slate-400 text-sm mt-2">Engagement</p>
          </Card>
        </div>

        {/* Creation Form */}
        {showForm && (
          <Card className="bg-slate-800 border-slate-700 p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Announcement</h3>
            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm block mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Announcement title"
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 text-sm block mb-2">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Announcement content..."
                  rows={4}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-slate-400 text-sm block mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 text-sm block mb-2">Audience</label>
                  <select
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                  >
                    <option value="all">All Users</option>
                    <option value="members">Members</option>
                    <option value="admins">Admins</option>
                    <option value="builders">Builders</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 text-sm block mb-2">Expires At</label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                  />
                </div>

                <div className="flex items-end">
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                    <Send className="mr-2 h-4 w-4" /> Create
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-full bg-slate-600 hover:bg-slate-700"
              >
                Cancel
              </Button>
            </form>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="published">Published ({stats.published})</TabsTrigger>
            <TabsTrigger value="draft">Draft ({stats.draft})</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>

          {/* Published Tab */}
          <TabsContent value="published" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredByTab.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No published announcements</p>
                ) : (
                  filteredByTab.map((announcement) => (
                    <div key={announcement.id} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex gap-2 items-center mb-1">
                            <Badge className={TYPE_COLORS[announcement.type]}>
                              {announcement.type}
                            </Badge>
                            <Badge className="bg-slate-600">{announcement.audience}</Badge>
                          </div>
                          <h4 className="text-white font-bold text-lg">{announcement.title}</h4>
                          <p className="text-slate-400 text-sm mt-1 line-clamp-2">{announcement.content}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-blue-400 flex items-center justify-end gap-1">
                            <Eye className="h-4 w-4" /> {announcement.views.toLocaleString()}
                          </p>
                          <p className="text-green-400 text-sm">{announcement.clicks} clicks</p>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs text-slate-400 mb-2">
                        <Calendar className="h-3 w-3" />
                        {announcement.publishedAt && new Date(announcement.publishedAt).toLocaleDateString()}
                        {announcement.expiresAt && ` - Expires: ${new Date(announcement.expiresAt).toLocaleDateString()}`}
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1 bg-slate-600 hover:bg-slate-500 h-8 text-sm">
                          <Edit2 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(announcement.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 h-8 text-sm"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Draft Tab */}
          <TabsContent value="draft" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredByTab.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No draft announcements</p>
                ) : (
                  filteredByTab.map((announcement) => (
                    <div key={announcement.id} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <Badge className="mb-2" style={{ backgroundColor: TYPE_COLORS[announcement.type] }}>
                            {announcement.type}
                          </Badge>
                          <h4 className="text-white font-bold">{announcement.title}</h4>
                          <p className="text-slate-400 text-sm mt-1 line-clamp-2">{announcement.content}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handlePublish(announcement.id)}
                          className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-sm"
                        >
                          <Send className="h-3 w-3 mr-1" /> Publish
                        </Button>
                        <Button className="flex-1 bg-slate-600 hover:bg-slate-500 h-8 text-sm">
                          <Edit2 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(announcement.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 h-8 text-sm"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Scheduled Tab */}
          <TabsContent value="scheduled" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredByTab.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No scheduled announcements</p>
                ) : (
                  filteredByTab.map((announcement) => (
                    <div key={announcement.id} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="text-white font-bold">{announcement.title}</h4>
                          <p className="text-slate-400 text-sm mt-1 line-clamp-2">{announcement.content}</p>
                        </div>
                      </div>
                      <p className="text-slate-400 text-xs mb-2">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Scheduled for: {announcement.publishedAt && new Date(announcement.publishedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Archived Tab */}
          <TabsContent value="archived" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredByTab.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No archived announcements</p>
                ) : (
                  filteredByTab.map((announcement) => (
                    <div key={announcement.id} className="bg-slate-700 rounded-lg p-4 opacity-75">
                      <h4 className="text-white font-bold">{announcement.title}</h4>
                      <p className="text-slate-400 text-sm mt-1 line-clamp-2">{announcement.content}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
