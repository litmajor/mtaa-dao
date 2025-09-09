import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, Search, Filter, RefreshCw } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import ErrorBoundary from '../ErrorBoundary'; // Using ErrorBoundary from parent components directory
import { motion, AnimatePresence } from 'framer-motion';

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

// Component for displaying individual transaction items with accessibility in mind
const TransactionItem = ({ tx }: { tx: Transaction }) => {
  const formatAddress = (address: string | undefined): string => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" aria-label="Completed" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" aria-label="Pending" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" aria-label="Failed" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" aria-label="Unknown status" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'contribution':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" aria-label="Inflow" />;
      case 'withdrawal':
      case 'transfer':
        return <ArrowUpRight className="h-4 w-4 text-blue-500" aria-label="Outflow" />;
      default:
        return <ArrowUpRight className="h-4 w-4 text-gray-500" aria-label="Unknown type" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer"
      tabIndex={0}
      role="listitem"
    >
      <div className="flex items-center space-x-4 w-full md:w-auto overflow-hidden">
        <motion.div
          className="flex items-center space-x-2 flex-shrink-0"
          whileHover={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          {getTypeIcon(tx.type)}
          {getStatusIcon(tx.status)}
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="font-medium flex items-center space-x-2 flex-wrap">
            <span className="capitalize truncate max-w-[150px] md:max-w-none" aria-label={`Transaction type: ${tx.type}`}>{tx.type}</span>
            <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'} aria-label={`Status: ${tx.status}`}>
              {tx.status}
            </Badge>
          </div>
          <div className="text-sm text-gray-500 truncate max-w-[200px] md:max-w-none" aria-label={`Description: ${tx.description || 'N/A'}`}>
            {tx.description || `${tx.type} transaction`}
          </div>
          <div className="text-xs text-gray-400" aria-label={`Created at: ${new Date(tx.createdAt).toLocaleString()}`}>
            {new Date(tx.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="text-right flex-shrink-0 ml-4">
        <div className="font-medium" aria-label={`Amount: ${tx.amount} ${tx.currency}`}>
          {tx.type === 'withdrawal' || tx.type === 'transfer' ? '-' : '+'}
          {tx.amount} {tx.currency}
        </div>
        {tx.transactionHash && (
          <div className="text-xs text-gray-500 truncate max-w-[150px]" aria-label={`Transaction Hash: ${tx.transactionHash}`}>
            Hash: {formatAddress(tx.transactionHash)}
          </div>
        )}
        {tx.gasFee && (
          <div className="text-xs text-gray-400" aria-label={`Gas Fee: ${tx.gasFee} CELO`}>
            Gas: {tx.gasFee} CELO
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Skeleton component for transaction items
const TransactionItemSkeleton = () => (
  <div className="flex items-center space-x-4 p-4 border rounded animate-pulse">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="space-y-2 flex-1">
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-3 w-[100px]" />
    </div>
    <Skeleton className="h-4 w-[80px]" />
  </div>
);


export default function TransactionHistory({ userId, walletAddress }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // State for error handling
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
    setError(null); // Clear previous errors
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
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again later.');
      setTransactions([]); // Clear transactions on error
    } finally {
      setLoading(false);
    }
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Optionally, scroll to top or focus on the transaction list
    window.scrollTo(0, 0);
  };

  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  return (
    <ErrorBoundary>
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left">
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>View and manage your wallet transactions</CardDescription>
            </div>
            <Button onClick={exportTransactions} variant="outline" className="w-full sm:w-auto">
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div className="relative col-span-1 md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Search transactions..."
                className="pl-10"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                aria-label="Search transactions"
              />
            </div>

            <Select value={filter.type} onValueChange={(value) => setFilter({ ...filter, type: value })}>
              <SelectTrigger aria-label="Filter by type">
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
              <SelectTrigger aria-label="Filter by status">
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
              <SelectTrigger aria-label="Filter by currency">
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
              <SelectTrigger aria-label="Filter by date range">
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
              {[...Array(itemsPerPage)].map((_, i) => (
                <TransactionItemSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              {error}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found.
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <TransactionItem key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {!loading && transactions.length > 0 && (
          <div className="flex justify-center items-center space-x-4 py-4 px-6 border-t">
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </ErrorBoundary>
  );
}