
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, Search, Filter } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'contribution' | 'recurring';
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  transactionHash?: string;
  description?: string;
  createdAt: string;
  fromUserId?: string;
  toUserId?: string;
  fromAddress?: string;
  toAddress?: string;
  gasUsed?: string;
  gasFee?: string;
}

interface TransactionHistoryProps {
  userId?: string;
  walletAddress?: string;
}

export default function TransactionHistory({ userId, walletAddress }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: '',
    status: '',
    currency: '',
    search: '',
    dateRange: '30' // days
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTransactions();
  }, [userId, walletAddress, filter, currentPage]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(userId && { userId }),
        ...(walletAddress && { walletAddress }),
        ...(filter.type && { type: filter.type }),
        ...(filter.status && { status: filter.status }),
        ...(filter.currency && { currency: filter.currency }),
        ...(filter.search && { search: filter.search }),
        dateRange: filter.dateRange
      });

      const response = await fetch(`/api/wallet/transactions?${params}`);
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'contribution':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'withdrawal':
      case 'transfer':
        return <ArrowUpRight className="h-4 w-4 text-blue-500" />;
      default:
        return <ArrowUpRight className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const exportTransactions = () => {
    const csv = [
      ['Date', 'Type', 'Amount', 'Currency', 'Status', 'Hash', 'Description'].join(','),
      ...transactions.map(tx => [
        new Date(tx.createdAt).toISOString(),
        tx.type,
        tx.amount,
        tx.currency,
        tx.status,
        tx.transactionHash || '',
        tx.description || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>View and manage your wallet transactions</CardDescription>
          </div>
          <Button onClick={exportTransactions} variant="outline">
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search transactions..."
              className="pl-10"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            />
          </div>

          <Select value={filter.type} onValueChange={(value) => setFilter({ ...filter, type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
              <SelectItem value="withdrawal">Withdrawal</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="contribution">Contribution</SelectItem>
              <SelectItem value="recurring">Recurring</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filter.status} onValueChange={(value) => setFilter({ ...filter, status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filter.currency} onValueChange={(value) => setFilter({ ...filter, currency: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Currencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Currencies</SelectItem>
              <SelectItem value="CELO">CELO</SelectItem>
              <SelectItem value="cUSD">cUSD</SelectItem>
              <SelectItem value="cEUR">cEUR</SelectItem>
              <SelectItem value="KES">KES</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filter.dateRange} onValueChange={(value) => setFilter({ ...filter, dateRange: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex space-x-4 p-4 border rounded">
                <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No transactions found
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(tx.type)}
                    {getStatusIcon(tx.status)}
                  </div>
                  
                  <div>
                    <div className="font-medium flex items-center space-x-2">
                      <span className="capitalize">{tx.type}</span>
                      <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}>
                        {tx.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {tx.description || `${tx.type} transaction`}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(tx.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-medium">
                    {tx.type === 'withdrawal' || tx.type === 'transfer' ? '-' : '+'}
                    {tx.amount} {tx.currency}
                  </div>
                  {tx.transactionHash && (
                    <div className="text-xs text-gray-500">
                      Hash: {formatAddress(tx.transactionHash)}
                    </div>
                  )}
                  {tx.gasFee && (
                    <div className="text-xs text-gray-400">
                      Gas: {tx.gasFee} CELO
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
