'use client';

import React, { useState } from 'react';
import styles from './search-advanced.module.css';
import { format } from 'date-fns';

interface SearchFilters {
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  changedBy?: string;
  changedFields?: string[];
}

interface SearchResult {
  id: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  configuration: Record<string, any>;
  changedFields: string[];
  changeReason?: string;
  changedBy: string;
  changedAt: Date | string;
}

/**
 * Advanced Search Page
 * Full-text and filtered search across configuration history
 */
export default function AdvancedSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ limit: 20, offset: 0, total: 0 });
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/agents-elders/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery,
          filters,
          limit: pagination.limit,
          offset: pagination.offset
        })
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      if (data.success) {
        const formattedResults = data.data.results.map((r: any) => ({
          ...r,
          changedAt: new Date(r.changedAt)
        }));
        setResults(formattedResults);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>Advanced Configuration Search</h1>
        <p className={styles.subtitle}>
          Search across all configuration changes with advanced filters
        </p>
      </div>

      {/* Search Bar */}
      <div className={styles.searchSection}>
        <div className={styles.searchInput}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && performSearch()}
            placeholder="Search change reasons, descriptions, notes..."
            className={styles.input}
          />
          <button
            onClick={performSearch}
            disabled={loading || !searchQuery.trim()}
            className={styles.searchButton}
          >
            {loading ? '🔍 Searching...' : '🔍 Search'}
          </button>
        </div>

        {/* Filters */}
        <div className={styles.filtersPanel}>
          <details className={styles.filterGroup}>
            <summary>🔽 Advanced Filters</summary>
            
            <div className={styles.filterGrid}>
              <div className={styles.filterField}>
                <label>Entity Type:</label>
                <select
                  value={filters.entityType || ''}
                  onChange={(e) => handleFilterChange('entityType', e.target.value)}
                  className={styles.select}
                >
                  <option value="">All Types</option>
                  <option value="elder">Elder</option>
                  <option value="agent">Agent</option>
                </select>
              </div>

              <div className={styles.filterField}>
                <label>Entity ID:</label>
                <input
                  type="text"
                  value={filters.entityId || ''}
                  onChange={(e) => handleFilterChange('entityId', e.target.value)}
                  placeholder="e.g., kaizen, morio"
                  className={styles.select}
                />
              </div>

              <div className={styles.filterField}>
                <label>Changed By:</label>
                <input
                  type="text"
                  value={filters.changedBy || ''}
                  onChange={(e) => handleFilterChange('changedBy', e.target.value)}
                  placeholder="User email or ID"
                  className={styles.select}
                />
              </div>

              <div className={styles.filterField}>
                <label>Start Date:</label>
                <input
                  type="date"
                  value={filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value ? new Date(e.target.value) : null)}
                  className={styles.select}
                />
              </div>

              <div className={styles.filterField}>
                <label>End Date:</label>
                <input
                  type="date"
                  value={filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value ? new Date(e.target.value) : null)}
                  className={styles.select}
                />
              </div>

              <div className={styles.filterField}>
                <label>Fields Changed:</label>
                <input
                  type="text"
                  value={filters.changedFields?.join(', ') || ''}
                  onChange={(e) => handleFilterChange('changedFields', e.target.value ? e.target.value.split(',').map(f => f.trim()) : null)}
                  placeholder="Comma-separated field names"
                  className={styles.select}
                />
              </div>
            </div>

            <button onClick={() => setFilters({})} className={styles.clearButton}>
              Clear All Filters
            </button>
          </details>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorBox}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className={styles.closeError}>✕</button>
        </div>
      )}

      {/* Results */}
      <div className={styles.resultsSection}>
        {results.length === 0 && !loading && searchQuery ? (
          <div className={styles.noResults}>
            <p>No results found for "{searchQuery}"</p>
            <p className={styles.noResultsHint}>Try different search terms or filters</p>
          </div>
        ) : (
          <>
            <div className={styles.resultsMeta}>
              <h2>Search Results ({pagination.total} found)</h2>
              {pagination.total > 0 && (
                <span className={styles.resultCount}>
                  Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
                </span>
              )}
            </div>

            <div className={styles.resultsList}>
              {results.map((result) => (
                <div
                  key={result.id}
                  className={`${styles.resultItem} ${expandedResult === result.id ? styles.expanded : ''}`}
                >
                  <div
                    className={styles.resultHeader}
                    onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
                  >
                    <div className={styles.resultTitle}>
                      <span className={styles.badge}>{result.entityType}</span>
                      <span className={styles.entityId}>{result.entityId}</span>
                      <span className={styles.version}>v{result.versionNumber}</span>
                    </div>
                    <div className={styles.resultMeta}>
                      <span className={styles.timestamp}>
                        {format(new Date(result.changedAt), 'MMM dd, yyyy HH:mm')}
                      </span>
                      <span className={styles.user}>{result.changedBy}</span>
                    </div>
                    <span className={styles.expandIcon}>
                      {expandedResult === result.id ? '▼' : '▶'}
                    </span>
                  </div>

                  {expandedResult === result.id && (
                    <div className={styles.resultDetails}>
                      {result.changeReason && (
                        <div className={styles.detailField}>
                          <strong>Reason:</strong> {result.changeReason}
                        </div>
                      )}

                      <div className={styles.detailField}>
                        <strong>Fields Changed:</strong>
                        <ul className={styles.fieldList}>
                          {result.changedFields.map(field => (
                            <li key={field}>{field}</li>
                          ))}
                        </ul>
                      </div>

                      <div className={styles.detailField}>
                        <strong>Configuration:</strong>
                        <pre className={styles.configCode}>
                          {JSON.stringify(result.configuration, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })}
                  disabled={pagination.offset === 0}
                >
                  ← Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {Math.floor(pagination.offset / pagination.limit) + 1} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
