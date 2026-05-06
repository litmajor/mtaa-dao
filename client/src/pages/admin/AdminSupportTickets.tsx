/**
 * Admin - Support Ticket Management
 * Organize, process, and track support tickets from users
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, CheckCircle, Clock, Users, MessageSquare, Filter, RefreshCw, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/utils/authClient';

interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  category: 'account' | 'technical' | 'billing' | 'general' | 'trading' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed' | 'escalated';
  createdAt: string;
  updatedAt: string;
  lastResponse: string;
  responseCount: number;
  message: string;
}

interface TicketMetric {
  date: string;
  created: number;
  resolved: number;
  avgResponseTime: number;
  satisfaction: number;
}

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  escalated: number;
  avgResolutionTime: number;
  satisfactionScore: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const STATUS_COLORS: Record<string, string> = {
  open: '#ef4444',
  'in-progress': '#f59e0b',
  resolved: '#10b981',
  closed: '#6b7280',
  escalated: '#8b5cf6',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#6366f1',
};

export default function AdminSupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [metrics, setMetrics] = useState<TicketMetric[]>([]);
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    escalated: 0,
    avgResolutionTime: 0,
    satisfactionScore: 0,
  });

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const fetchTicketData = async () => {
    try {
      setLoading(true);

      const [ticketsRes, metricsRes, statsRes] = await Promise.all([
        authClient.get('/api/admin/support/tickets'),
        authClient.get('/api/admin/support/metrics'),
        authClient.get('/api/admin/support/stats'),
      ]);

      setTickets(ticketsRes.tickets || []);
      setMetrics(metricsRes.metrics || []);
      setStats(statsRes.stats || {});
    } catch (error) {
      console.error('Failed to fetch ticket data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketData();
    const interval = setInterval(fetchTicketData, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await authClient.patch(`/api/admin/support/tickets/${ticketId}`, { status: newStatus });
      fetchTicketData();
    } catch (error) {
      console.error('Failed to update ticket:', error);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const statusMatch = filterStatus === 'all' || ticket.status === filterStatus;
    const priorityMatch = filterPriority === 'all' || ticket.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

  const statusDistribution = [
    { name: 'Open', value: stats.open },
    { name: 'In Progress', value: stats.inProgress },
    { name: 'Resolved', value: stats.resolved },
    { name: 'Closed', value: stats.closed },
    { name: 'Escalated', value: stats.escalated },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Support Ticket Management</h1>
            <p className="text-slate-400">Organize and process user support requests</p>
          </div>
          <Button
            onClick={fetchTicketData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Total Tickets</p>
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="text-slate-400 text-sm mt-2">All time</p>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-2">Open</p>
                <p className="text-3xl font-bold text-red-500">{stats.open}</p>
              </div>
              <AlertCircle className="text-red-500 h-8 w-8" />
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-2">In Progress</p>
                <p className="text-3xl font-bold text-yellow-500">{stats.inProgress}</p>
              </div>
              <Clock className="text-yellow-500 h-8 w-8" />
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-2">Resolved</p>
                <p className="text-3xl font-bold text-green-500">{stats.resolved}</p>
              </div>
              <CheckCircle className="text-green-500 h-8 w-8" />
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 p-6">
            <p className="text-slate-400 text-sm mb-2">Satisfaction</p>
            <p className="text-3xl font-bold text-blue-500">{stats.satisfactionScore.toFixed(1)}/5</p>
            <p className="text-slate-400 text-sm mt-2">Customer score</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="detail">{selectedTicket ? 'Detail' : 'Categories'}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Ticket Status Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-slate-800 border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Metrics</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Average Resolution Time</span>
                      <span className="text-white font-semibold">{stats.avgResolutionTime.toFixed(1)} hours</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }} suppressHydrationWarning />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Resolution Rate</span>
                      <span className="text-white font-semibold">
                        {((stats.resolved / stats.total) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(stats.resolved / stats.total) * 100}%` }} suppressHydrationWarning />
                    </div>
                  </div>

                  <div className="bg-slate-700 rounded-lg p-4 mt-4">
                    <p className="text-slate-400 text-sm mb-1">Open vs In Progress</p>
                    <p className="text-2xl font-bold text-white">{stats.open + stats.inProgress}</p>
                    <p className="text-slate-400 text-xs mt-1">Requires attention</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Tickets Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Line type="monotone" dataKey="created" stroke="#3b82f6" name="Created" strokeWidth={2} />
                  <Line type="monotone" dataKey="resolved" stroke="#10b981" name="Resolved" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <label className="text-slate-400 text-sm block mb-2">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="escalated">Escalated</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-slate-400 text-sm block mb-2">Filter by Priority</label>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                  >
                    <option value="all">All Priority</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredTickets.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No tickets found</p>
                ) : (
                  filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="bg-slate-700 rounded-lg p-4 cursor-pointer hover:bg-slate-600 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex gap-2 mb-2">
                            <Badge style={{ backgroundColor: PRIORITY_COLORS[ticket.priority] }}>
                              {ticket.priority}
                            </Badge>
                            <Badge style={{ backgroundColor: STATUS_COLORS[ticket.status] }}>
                              {ticket.status}
                            </Badge>
                            <Badge className="bg-slate-600">{ticket.category}</Badge>
                          </div>
                          <p className="text-white font-semibold">{ticket.subject}</p>
                          <p className="text-slate-400 text-sm mt-1">
                            {ticket.userName} ({ticket.userEmail})
                          </p>
                          <p className="text-slate-400 text-sm mt-1">
                            Created: {new Date(ticket.createdAt).toLocaleDateString()}
                            {ticket.responseCount > 0 && ` • ${ticket.responseCount} responses`}
                          </p>
                        </div>
                        <ChevronRight className="text-slate-400 h-5 w-5" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Average Response Time Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Line type="monotone" dataKey="avgResponseTime" stroke="#8b5cf6" name="Avg Response (hours)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Satisfaction Score Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 5]} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Line type="monotone" dataKey="satisfaction" stroke="#10b981" name="Satisfaction (out of 5)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* Detail Tab */}
          <TabsContent value="detail">
            {selectedTicket ? (
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{selectedTicket.subject}</h3>
                  <div className="flex gap-2 mb-4">
                    <Badge style={{ backgroundColor: PRIORITY_COLORS[selectedTicket.priority] }}>
                      {selectedTicket.priority}
                    </Badge>
                    <Badge style={{ backgroundColor: STATUS_COLORS[selectedTicket.status] }}>
                      {selectedTicket.status}
                    </Badge>
                    <Badge className="bg-slate-600">{selectedTicket.category}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-slate-400 text-sm">User</p>
                    <p className="text-white">{selectedTicket.userName}</p>
                    <p className="text-slate-400 text-sm">{selectedTicket.userEmail}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Created</p>
                    <p className="text-white">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Last Updated</p>
                    <p className="text-white">{new Date(selectedTicket.updatedAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Responses</p>
                    <p className="text-white">{selectedTicket.responseCount}</p>
                  </div>
                </div>

                <div className="bg-slate-700 rounded-lg p-4 mb-6">
                  <p className="text-slate-400 text-sm mb-2">Message</p>
                  <p className="text-white">{selectedTicket.message}</p>
                </div>

                <div className="flex gap-2">
                  {selectedTicket.status !== 'resolved' && (
                    <Button
                      onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Mark as Resolved
                    </Button>
                  )}
                  {selectedTicket.status !== 'in-progress' && (
                    <Button
                      onClick={() => updateTicketStatus(selectedTicket.id, 'in-progress')}
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      Mark as In Progress
                    </Button>
                  )}
                  {selectedTicket.status !== 'escalated' && (
                    <Button
                      onClick={() => updateTicketStatus(selectedTicket.id, 'escalated')}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Escalate
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700 p-12 text-center">
                <p className="text-slate-400">Select a ticket to view details</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
