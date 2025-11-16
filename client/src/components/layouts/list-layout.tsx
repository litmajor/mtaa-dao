import React, { useState } from 'react';
import { Input } from '../ui/input-design';
import { Button } from '../ui/button-design';
import { Card } from '../ui/card-design';
import { Icon } from '../ui/icon-design';

export interface ListLayoutProps {
  // Metadata
  title?: string;
  subtitle?: string;
  
  // Data
  items: any[];
  isLoading?: boolean;
  total?: number;
  
  // Display
  viewMode?: 'table' | 'grid' | 'list';
  
  // Search
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  searchDelay?: number;
  
  // Filters
  filters?: FilterDefinition[];
  onFilterChange?: (filters: any) => void;
  
  // Pagination
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  
  // Columns (for table/list view)
  columns?: ColumnDefinition[];
  
  // Actions
  actions?: ActionDefinition[];
  onAction?: (action: string, item: any) => void;
  
  // Empty state
  emptyMessage?: string;
  
  // Styling
  className?: string;
}

export interface FilterDefinition {
  id: string;
  label: string;
  type: 'text' | 'select' | 'checkbox' | 'range';
  options?: { label: string; value: string }[];
}

export interface ColumnDefinition {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, item: any) => React.ReactNode;
}

export interface ActionDefinition {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: string;
}

export const ListLayout = React.forwardRef<HTMLDivElement, ListLayoutProps>(
  (
    {
      title,
      subtitle,
      items,
      isLoading = false,
      total,
      viewMode = 'table',
      searchPlaceholder = 'Search...',
      onSearch,
      searchDelay = 300,
      filters = [],
      onFilterChange,
      page = 1,
      pageSize = 10,
      onPageChange,
      columns = [],
      actions = [],
      onAction,
      emptyMessage = 'No items found',
      className,
    },
    ref
  ) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState({});

    const handleSearch = (value: string) => {
      setSearchQuery(value);
      const timer = setTimeout(() => {
        onSearch?.(value);
      }, searchDelay);
      return () => clearTimeout(timer);
    };

    const handleFilterChange = (filterId: string, value: any) => {
      const newFilters = { ...activeFilters, [filterId]: value };
      setActiveFilters(newFilters);
      onFilterChange?.(newFilters);
    };

    return (
      <div ref={ref} className={`w-full flex flex-col gap-6 ${className || ''}`}>
        {/* Header */}
        {(title || subtitle) && (
          <div className="pb-6 border-b border-neutral-200">
            {title && (
              <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-2 text-neutral-600">{subtitle}</p>
            )}
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-full md:w-64"
            icon="search"
          />

          {/* View Toggle */}
          <div className="flex gap-2">
            {(['table', 'grid', 'list'] as const).map(mode => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'primary' : 'outline'}
                size="sm"
                title={`${mode} view`}
              >
                <Icon
                  name={mode === 'table' ? 'table' : mode === 'grid' ? 'grid' : 'list'}
                  size="sm"
                />
              </Button>
            ))}
          </div>
        </div>

        {/* Filters */}
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
            {filters.map(filter => (
              <div key={filter.id} className="flex gap-2 items-center">
                <span className="text-sm font-medium text-neutral-700">{filter.label}:</span>
                {filter.type === 'select' && (
                  <select
                    value={activeFilters[filter.id] || ''}
                    onChange={e => handleFilterChange(filter.id, e.target.value)}
                    className="text-sm px-2 py-1 border border-neutral-300 rounded"
                  >
                    <option value="">All</option>
                    {filter.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                {filter.type === 'text' && (
                  <input
                    type="text"
                    value={activeFilters[filter.id] || ''}
                    onChange={e => handleFilterChange(filter.id, e.target.value)}
                    className="text-sm px-2 py-1 border border-neutral-300 rounded"
                    placeholder="Enter value"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-500">Loading...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-neutral-500">{emptyMessage}</p>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-sm font-semibold text-neutral-900"
                      style={{ width: col.width }}
                    >
                      {col.label}
                      {col.sortable && (
                        <Icon name="arrow-up-down" size="sm" className="ml-2 inline opacity-50" />
                      )}
                    </th>
                  ))}
                  {actions.length > 0 && (
                    <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-900">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-neutral-200 hover:bg-neutral-50">
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-sm text-neutral-900">
                        {col.render ? col.render(item[col.key], item) : item[col.key]}
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className="px-4 py-3 text-right flex gap-2 justify-end">
                        {actions.map(action => (
                          <Button
                            key={action.id}
                            size="sm"
                            variant={action.variant || 'outline'}
                            onClick={() => onAction?.(action.id, item)}
                          >
                            {action.icon && (
                              <Icon name={action.icon} size="sm" className="mr-1" />
                            )}
                            {action.label}
                          </Button>
                        ))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, idx) => (
              <Card key={idx} className="flex flex-col">
                <div className="flex-1">
                  {columns.slice(0, 3).map(col => (
                    <div key={col.key} className="mb-2">
                      <p className="text-xs font-medium text-neutral-600">{col.label}</p>
                      <p className="text-sm text-neutral-900">
                        {col.render ? col.render(item[col.key], item) : item[col.key]}
                      </p>
                    </div>
                  ))}
                </div>
                {actions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-neutral-200 flex gap-2">
                    {actions.map(action => (
                      <Button
                        key={action.id}
                        size="sm"
                        variant={action.variant || 'outline'}
                        onClick={() => onAction?.(action.id, item)}
                        className="flex-1"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <Card key={idx} className="flex items-center justify-between p-4">
                <div className="flex-1">
                  {columns.map(col => (
                    <span key={col.key} className="mr-4 text-sm">
                      <span className="font-medium">{col.label}:</span>{' '}
                      {col.render ? col.render(item[col.key], item) : item[col.key]}
                    </span>
                  ))}
                </div>
                {actions.length > 0 && (
                  <div className="flex gap-2 flex-shrink-0">
                    {actions.map(action => (
                      <Button
                        key={action.id}
                        size="sm"
                        variant={action.variant || 'outline'}
                        onClick={() => onAction?.(action.id, item)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total && pageSize && (
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
            <p className="text-sm text-neutral-600">
              Showing {(page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, total)} of {total} items
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              {Array.from({ length: Math.ceil(total / pageSize) }, (_, i) => (
                <Button
                  key={i}
                  variant={page === i + 1 ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange?.(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(page + 1)}
                disabled={page >= Math.ceil(total / pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ListLayout.displayName = 'ListLayout';
