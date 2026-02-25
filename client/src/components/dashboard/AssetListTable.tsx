import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronUp,
  ChevronDown,
  Search,
  Download,
  Eye,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  price: number;
  value: number;
  change24h: number;
  location: string;
  chain?: string;
}

interface AssetListTableProps {
  assets: Asset[];
  loading?: boolean;
  onAssetClick?: (asset: Asset) => void;
  onExport?: () => void;
}

type SortField = 'symbol' | 'amount' | 'value' | 'change24h' | 'price';
type SortDirection = 'asc' | 'desc';

export function AssetListTable({
  assets,
  loading = false,
  onAssetClick,
  onExport,
}: AssetListTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterLocation, setFilterLocation] = useState('all');

  // Get unique locations
  const locations = useMemo(() => {
    const unique = ['all', ...new Set(assets.map(a => a.location))];
    return unique;
  }, [assets]);

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch =
        asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation = filterLocation === 'all' || asset.location === filterLocation;
      return matchesSearch && matchesLocation;
    });
  }, [assets, searchQuery, filterLocation]);

  // Sort assets
  const sortedAssets = useMemo(() => {
    const sorted = [...filteredAssets].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortField) {
        case 'symbol':
          compareValue = a.symbol.localeCompare(b.symbol);
          break;
        case 'amount':
          compareValue = a.amount - b.amount;
          break;
        case 'value':
          compareValue = a.value - b.value;
          break;
        case 'change24h':
          compareValue = a.change24h - b.change24h;
          break;
        case 'price':
          compareValue = a.price - b.price;
          break;
      }
      
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [filteredAssets, sortField, sortDirection]);

  // Paginate assets
  const totalPages = Math.ceil(sortedAssets.length / itemsPerPage);
  const paginatedAssets = sortedAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <div className="w-4 h-4" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-blue-400" />
    ) : (
      <ChevronDown className="w-4 h-4 text-blue-400" />
    );
  };

  if (loading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  const totalValue = sortedAssets.reduce((sum, asset) => sum + asset.value, 0);

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Assets</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Location Filter */}
          <select
            value={filterLocation}
            onChange={(e) => {
              setFilterLocation(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            {locations.map(location => (
              <option key={location} value={location}>
                {location === 'all' ? 'All Locations' : location}
              </option>
            ))}
          </select>

          {/* Items Per Page */}
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value={10}>10 items</option>
            <option value={25}>25 items</option>
            <option value={50}>50 items</option>
          </select>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span>{sortedAssets.length} assets</span>
          <span className="font-semibold text-white">
            Total Value: ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {paginatedAssets.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-slate-400">No assets found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 font-semibold text-slate-300">
                    <button
                      onClick={() => handleSort('symbol')}
                      className="flex items-center gap-2 hover:text-white transition-colors"
                    >
                      Asset
                      <SortIndicator field="symbol" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-300">
                    <button
                      onClick={() => handleSort('price')}
                      className="flex items-center justify-end gap-2 w-full hover:text-white transition-colors"
                    >
                      Price
                      <SortIndicator field="price" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-300">
                    <button
                      onClick={() => handleSort('amount')}
                      className="flex items-center justify-end gap-2 w-full hover:text-white transition-colors"
                    >
                      Amount
                      <SortIndicator field="amount" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-300">
                    <button
                      onClick={() => handleSort('value')}
                      className="flex items-center justify-end gap-2 w-full hover:text-white transition-colors"
                    >
                      Value
                      <SortIndicator field="value" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-300">
                    <button
                      onClick={() => handleSort('change24h')}
                      className="flex items-center justify-end gap-2 w-full hover:text-white transition-colors"
                    >
                      24h Change
                      <SortIndicator field="change24h" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-300">
                    Location
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {asset.symbol.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{asset.symbol}</p>
                          <p className="text-xs text-slate-400">{asset.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-white font-semibold">
                      ${asset.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-3 px-4 text-white">
                      {asset.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-3 px-4">
                      <p className="text-white font-semibold">
                        ${asset.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(asset.value / totalValue * 100).toFixed(1)}%
                      </p>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span
                        className={`font-semibold ${
                          asset.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-300">{asset.location}</span>
                        {asset.chain && (
                          <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                            {asset.chain}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onAssetClick?.(asset)}
                          className="p-1 hover:bg-slate-600 rounded transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4 text-slate-400 hover:text-white" />
                        </button>
                        <button
                          className="p-1 hover:bg-slate-600 rounded transition-colors"
                          title="View on blockchain"
                        >
                          <ExternalLink className="w-4 h-4 text-slate-400 hover:text-white" />
                        </button>
                        <button
                          className="p-1 hover:bg-slate-600 rounded transition-colors"
                          title="Remove from watchlist"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-700">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              ← Previous
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = currentPage > 3 ? currentPage - 2 + i : i + 1;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded transition-colors ${
                      pageNum === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next →
            </Button>
            <span className="text-xs text-slate-400 ml-4">
              Page {currentPage} of {totalPages}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AssetListTable;
