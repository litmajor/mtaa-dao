'use client';

import React, { useState, useEffect } from 'react';
import styles from './config-history.module.css';
import { format } from 'date-fns';

interface ConfigHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  configuration: Record<string, any>;
  previousConfiguration?: Record<string, any>;
  changedFields: string[];
  changeReason?: string;
  changedBy: string;
  changedAt: Date | string;
  createdAt: Date | string;
}

interface ComparisonResult {
  versionA: ConfigHistoryEntry | null;
  versionB: ConfigHistoryEntry | null;
  differences: Record<string, { from: any; to: any }>;
}

/**
 * Configuration History Page
 * Shows version control, history timeline, and rollback capabilities
 */
export default function ConfigHistoryPage() {
  const [entityType, setEntityType] = useState<'elder' | 'agent'>('elder');
  const [entityId, setEntityId] = useState('kaizen');
  const [history, setHistory] = useState<ConfigHistoryEntry[]>([]);
  const [selectedVersionA, setSelectedVersionA] = useState<number | null>(null);
  const [selectedVersionB, setSelectedVersionB] = useState<number | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [pagination, setPagination] = useState({ limit: 20, offset: 0 });

  // Fetch configuration history
  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/agents-elders/history/${entityType}/${entityId}?limit=${pagination.limit}&offset=${pagination.offset}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch history');

      const data = await response.json();
      if (data.success) {
        // Convert string dates to Date objects
        const entries = data.data.entries.map((entry: any) => ({
          ...entry,
          changedAt: new Date(entry.changedAt),
          createdAt: new Date(entry.createdAt)
        }));
        setHistory(entries);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching history');
    } finally {
      setLoading(false);
    }
  };

  // Compare two versions
  const compareVersions = async (vA: number, vB: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/agents-elders/history/${entityType}/${entityId}/compare?versionA=${vA}&versionB=${vB}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to compare versions');

      const data = await response.json();
      if (data.success) {
        setComparison(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error comparing versions');
    } finally {
      setLoading(false);
    }
  };

  // Rollback to a specific version
  const performRollback = async () => {
    if (!rollbackTarget) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/agents-elders/history/${entityType}/${entityId}/rollback`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            targetVersion: rollbackTarget,
            rollbackReason: rollbackReason || 'Manual rollback'
          })
        }
      );

      if (!response.ok) throw new Error('Failed to rollback');

      const data = await response.json();
      if (data.success) {
        // Refresh history
        await fetchHistory();
        setShowRollbackConfirm(false);
        setRollbackTarget(null);
        setRollbackReason('');
        // Show success message
        alert('Rollback completed successfully');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error performing rollback');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchHistory();
  }, [entityType, entityId, pagination.offset]);

  // Auto-compare when versions are selected
  useEffect(() => {
    if (selectedVersionA && selectedVersionB) {
      compareVersions(selectedVersionA, selectedVersionB);
    }
  }, [selectedVersionA, selectedVersionB]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>Configuration History & Version Control</h1>
        <p className={styles.subtitle}>
          View, compare, and rollback configuration changes
        </p>
      </div>

      {/* Entity Selection */}
      <div className={styles.selectionPanel}>
        <div className={styles.selectorGroup}>
          <label>Entity Type:</label>
          <select 
            value={entityType} 
            onChange={(e) => {
              setEntityType(e.target.value as 'elder' | 'agent');
              setSelectedVersionA(null);
              setSelectedVersionB(null);
              setComparison(null);
            }}
            className={styles.select}
          >
            <option value="elder">Elder</option>
            <option value="agent">Agent</option>
          </select>
        </div>

        <div className={styles.selectorGroup}>
          <label>Entity ID:</label>
          <input
            type="text"
            value={entityId}
            onChange={(e) => {
              setEntityId(e.target.value);
              setSelectedVersionA(null);
              setSelectedVersionB(null);
              setComparison(null);
            }}
            placeholder="Enter entity ID"
            className={styles.input}
          />
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className={styles.refreshButton}
        >
          {loading ? 'Loading...' : 'Refresh History'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorBox}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className={styles.closeError}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* History Timeline */}
        <div className={styles.timelineSection}>
          <h2>Version Timeline</h2>
          
          {history.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No history available for this entity</p>
            </div>
          ) : (
            <div className={styles.timeline}>
              {history.map((entry, index) => (
                <div 
                  key={entry.id} 
                  className={`${styles.timelineItem} ${
                    selectedVersionA === entry.versionNumber ? styles.selectedA : ''
                  } ${selectedVersionB === entry.versionNumber ? styles.selectedB : ''}`}
                >
                  {/* Timeline marker */}
                  <div className={styles.timelineMarker}>
                    <div className={styles.markerCircle}>
                      <span className={styles.versionNumber}>v{entry.versionNumber}</span>
                    </div>
                    {index < history.length - 1 && <div className={styles.markerLine}></div>}
                  </div>

                  {/* Timeline content */}
                  <div className={styles.timelineContent}>
                    <div className={styles.contentHeader}>
                      <h3>Version {entry.versionNumber}</h3>
                      <span className={styles.timestamp}>
                        {format(new Date(entry.changedAt), 'MMM dd, yyyy HH:mm:ss')}
                      </span>
                    </div>

                    <div className={styles.contentBody}>
                      <p className={styles.changedBy}>
                        Changed by: <strong>{entry.changedBy}</strong>
                      </p>
                      
                      {entry.changeReason && (
                        <p className={styles.changeReason}>
                          Reason: {entry.changeReason}
                        </p>
                      )}

                      <div className={styles.changedFields}>
                        <strong>Fields changed:</strong>
                        <ul>
                          {entry.changedFields.map((field) => (
                            <li key={field}>{field}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Selection buttons */}
                    <div className={styles.contentFooter}>
                      <button
                        onClick={() => setSelectedVersionA(entry.versionNumber)}
                        className={`${styles.selectButton} ${selectedVersionA === entry.versionNumber ? styles.active : ''}`}
                      >
                        {selectedVersionA === entry.versionNumber ? '✓' : ''} Compare A
                      </button>
                      
                      <button
                        onClick={() => setSelectedVersionB(entry.versionNumber)}
                        className={`${styles.selectButton} ${selectedVersionB === entry.versionNumber ? styles.active : ''}`}
                      >
                        {selectedVersionB === entry.versionNumber ? '✓' : ''} Compare B
                      </button>

                      <button
                        onClick={() => {
                          setRollbackTarget(entry.versionNumber);
                          setShowRollbackConfirm(true);
                        }}
                        className={styles.rollbackButton}
                      >
                        🔄 Rollback
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
        </div>

        {/* Comparison Panel */}
        {comparison && selectedVersionA && selectedVersionB && (
          <div className={styles.comparisonSection}>
            <h2>Version Comparison</h2>
            
            <div className={styles.comparisonHeader}>
              <div className={styles.comparisonTitle}>
                <span className={styles.versionLabel}>Version {selectedVersionA}</span>
                <span className={styles.comparisonArrow}>→</span>
                <span className={styles.versionLabel}>Version {selectedVersionB}</span>
              </div>
            </div>

            {Object.keys(comparison.differences).length === 0 ? (
              <div className={styles.noChanges}>
                No differences found between these versions
              </div>
            ) : (
              <div className={styles.differencesList}>
                {Object.entries(comparison.differences).map(([key, diff]) => (
                  <div key={key} className={styles.differenceItem}>
                    <div className={styles.fieldName}>{key}</div>
                    
                    <div className={styles.valueComparison}>
                      <div className={styles.fromValue}>
                        <span className={styles.label}>From:</span>
                        <code className={styles.code}>
                          {typeof diff.from === 'object' 
                            ? JSON.stringify(diff.from, null, 2) 
                            : String(diff.from)}
                        </code>
                      </div>
                      
                      <div className={styles.toValue}>
                        <span className={styles.label}>To:</span>
                        <code className={styles.code}>
                          {typeof diff.to === 'object' 
                            ? JSON.stringify(diff.to, null, 2) 
                            : String(diff.to)}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rollback Confirmation Modal */}
      {showRollbackConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Confirm Rollback</h2>
            
            <div className={styles.warningBox}>
              <span className={styles.warningIcon}>⚠️</span>
              <p>
                This will restore the configuration to version {rollbackTarget}.
                Current configuration will be preserved in history.
              </p>
            </div>

            <div className={styles.formGroup}>
              <label>Rollback Reason (optional):</label>
              <textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Why are you rolling back?"
                className={styles.textarea}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={() => setShowRollbackConfirm(false)}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              
              <button
                onClick={performRollback}
                disabled={loading}
                className={styles.confirmButton}
              >
                {loading ? 'Rolling back...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
