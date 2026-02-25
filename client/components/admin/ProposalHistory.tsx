import React from 'react';
import styles from './ProposalHistory.module.css';

interface HistoryEntry {
  id: string;
  timestamp: Date;
  action: string;
  status: string;
  reason?: string;
  actor?: string;
}

interface ProposalHistoryProps {
  history: HistoryEntry[];
  isLoading?: boolean;
}

const ProposalHistory: React.FC<ProposalHistoryProps> = ({ history, isLoading = false }) => {
  const getActionIcon = (action: string): string => {
    switch (action) {
      case 'CREATED':
        return '📝';
      case 'APPROVED':
        return '✅';
      case 'REJECTED':
        return '❌';
      case 'EXECUTED':
        return '⚡';
      case 'EXPIRED':
        return '⏰';
      default:
        return '📋';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return '#ffc107';
      case 'APPROVED':
        return '#4caf50';
      case 'REJECTED':
        return '#f44336';
      case 'EXECUTED':
        return '#2196f3';
      case 'EXPIRED':
        return '#999';
      default:
        return '#666';
    }
  };

  const formatTime = (date: Date): string => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className={styles.card}>
        <h3>📊 History</h3>
        <div className={styles.loading}>Loading history...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={styles.card}>
        <h3>📊 History</h3>
        <div className={styles.empty}>No history available</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h3>📊 Proposal History</h3>
      <div className={styles.timeline}>
        {history.map((entry, index) => (
          <div key={entry.id} className={styles.timelineItem}>
            <div className={styles.timelineMarker}>
              <div className={styles.timelineDot}>{getActionIcon(entry.action)}</div>
              {index < history.length - 1 && <div className={styles.timelineConnector}></div>}
            </div>
            <div className={styles.timelineContent}>
              <div className={styles.header}>
                <span className={styles.time}>{formatTime(entry.timestamp)}</span>
                <span
                  className={`${styles.status} status-${entry.status}`}
                >
                  {entry.status}
                </span>
              </div>
              <div className={styles.action}>{entry.action}</div>
              {entry.reason && <div className={styles.reason}>{entry.reason}</div>}
              {entry.actor && <div className={styles.actor}>by {entry.actor}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProposalHistory;
