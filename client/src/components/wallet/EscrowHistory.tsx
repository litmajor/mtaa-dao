import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, Download, Filter, Search } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface Escrow {
  id: string;
  amount: string;
  currency: string;
  status: 'pending' | 'accepted' | 'funded' | 'completed' | 'disputed' | 'refunded';
  payerId: string;
  payeeId: string;
  payer?: { username: string; email: string };
  payee?: { username: string; email: string };
  metadata?: { description: string };
  createdAt: string;
  updatedAt: string;
  milestones?: any[];
}

interface FilterOptions {
  status: string;
  type: string;
  searchTerm: string;
}

export function EscrowHistory({ userId }: { userId: string }) {
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [filteredEscrows, setFilteredEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    type: 'all',
    searchTerm: '',
  });

  useEffect(() => {
    fetchEscrows();
  }, [userId]);

  useEffect(() => {
    applyFilters();
  }, [escrows, filters]);

  const fetchEscrows = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/escrow/my-escrows');
      const sorted = data.escrows.sort(
        (a: Escrow, b: Escrow) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setEscrows(sorted);
    } catch (error) {
      console.error('Failed to fetch escrows:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...escrows];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((e) => e.status === filters.status);
    }

    // Type filter (payer/payee)
    if (filters.type === 'sent') {
      filtered = filtered.filter((e) => e.payerId === userId);
    } else if (filters.type === 'received') {
      filtered = filtered.filter((e) => e.payeeId === userId);
    }

    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.payer?.username.toLowerCase().includes(term) ||
          e.payee?.username.toLowerCase().includes(term) ||
          e.metadata?.description?.toLowerCase().includes(term)
      );
    }

    setFilteredEscrows(filtered);
  };

  const statusColor = (status: Escrow['status']) => {
    const colors: Record<Escrow['status'], string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-blue-100 text-blue-800',
      funded: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      disputed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const statusIcon = (status: Escrow['status']) => {
    const icons: Record<Escrow['status'], string> = {
      pending: '⏳',
      accepted: '✅',
      funded: '💰',
      completed: '🎉',
      disputed: '⚠️',
      refunded: '↩️',
    };
    return icons[status] || '📋';
  };

  const exportToCsv = () => {
    const headers = [
      'Date',
      'Type',
      'Counterparty',
      'Amount',
      'Status',
      'Description',
      'Milestones',
    ];

    const rows = filteredEscrows.map((e) => {
      const isPayee = e.payeeId === userId;
      return [
        new Date(e.createdAt).toLocaleDateString(),
        isPayee ? 'Received' : 'Sent',
        isPayee ? e.payer?.username : e.payee?.username,
        `${e.amount} ${e.currency}`,
        e.status,
        e.metadata?.description || '-',
        e.milestones?.length || 0,
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escrow-history-${Date.now()}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Escrow History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Escrow History</CardTitle>
            <CardDescription>
              {filteredEscrows.length} escrow{filteredEscrows.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCsv}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          <Select value={filters.status} onValueChange={(v) => 
            setFilters({ ...filters, status: v })
          }>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="funded">Funded</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.type} onValueChange={(v) =>
            setFilters({ ...filters, type: v })
          }>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="sent">Sent (Payer)</SelectItem>
              <SelectItem value="received">Received (Payee)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center">
            <Search className="w-4 h-4 absolute ml-2 text-gray-400" />
            <Input
              placeholder="Search by name..."
              className="pl-8"
              value={filters.searchTerm}
              onChange={(e) =>
                setFilters({ ...filters, searchTerm: e.target.value })
              }
            />
          </div>
        </div>

        {/* Escrow List */}
        <div className="space-y-3">
          {filteredEscrows.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No escrows found matching your filters</p>
            </div>
          ) : (
            filteredEscrows.map((escrow) => {
              const isPayee = escrow.payeeId === userId;
              const otherParty = isPayee ? escrow.payer : escrow.payee;

              return (
                <div
                  key={escrow.id}
                  className="border rounded-lg hover:bg-gray-50 transition"
                >
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === escrow.id ? null : escrow.id)
                    }
                    className="w-full p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-2xl">
                        {statusIcon(escrow.status)}
                      </span>

                      <div className="text-left flex-1">
                        <p className="font-medium">
                          {isPayee ? '↓ Received' : '↑ Sent'} from{' '}
                          <span className="text-blue-600">
                            {otherParty?.username}
                          </span>
                        </p>
                        <p className="text-sm text-gray-500">
                          {escrow.metadata?.description || 'No description'}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-lg">
                          {isPayee ? '+' : '-'}{escrow.amount} {escrow.currency}
                        </p>
                        <Badge className={statusColor(escrow.status)}>
                          {escrow.status}
                        </Badge>
                      </div>
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        expandedId === escrow.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded Details */}
                  {expandedId === escrow.id && (
                    <div className="border-t bg-gray-50 p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Created</p>
                          <p className="font-medium">
                            {new Date(escrow.createdAt).toLocaleDateString()}{' '}
                            <span className="text-gray-500 text-sm">
                              ({formatDistanceToNow(new Date(escrow.createdAt), { addSuffix: true })})
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Last Updated</p>
                          <p className="font-medium">
                            {formatDistanceToNow(new Date(escrow.updatedAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">
                            {isPayee ? 'From' : 'To'}
                          </p>
                          <p className="font-medium">{otherParty?.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Milestones</p>
                          <p className="font-medium">{escrow.milestones?.length || 0}</p>
                        </div>
                      </div>

                      {escrow.milestones && escrow.milestones.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Milestones:</p>
                          <div className="space-y-2">
                            {escrow.milestones.map((m: any, i: number) => (
                              <div
                                key={i}
                                className="p-2 bg-white border rounded text-sm"
                              >
                                <p className="font-medium">{m.description}</p>
                                <p className="text-gray-500">
                                  {m.amount} {escrow.currency} - {m.status}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
