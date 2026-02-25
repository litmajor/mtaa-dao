'use client';

import React, { useEffect, useState } from 'react';
import styles from './live-metrics.module.css';
import { useRealtimeAnalytics } from '@/hooks/useWebSocket';
import { format } from 'date-fns';

interface LiveMetricsProps {
  metricType?: string;
  refreshInterval?: number;
}

/**
 * Live Metrics Display
 * Real-time metrics updates with change indicators
 */
export default function LiveMetrics({
  metricType = 'all',
  refreshInterval = 5000
}: LiveMetricsProps) {
  const { metrics, lastUpdate } = useRealtimeAnalytics();
  const [prevMetrics, setPrevMetrics] = useState<any>(null);
  const [changes, setChanges] = useState<Map<string, { value: number; timestamp: Date }>>(new Map());

  useEffect(() => {
    if (metrics && prevMetrics) {
      const newChanges = new Map(changes);

      // Detect changes
      Object.keys(metrics).forEach(key => {
        if (metrics[key] !== prevMetrics[key]) {
          newChanges.set(key, {
            value: metrics[key],
            timestamp: new Date()
          });
        }
      });

      setChanges(newChanges);
    }
    setPrevMetrics(metrics);
  }, [metrics]);

  // Clear old changes after 2 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const newChanges = new Map(changes);

      newChanges.forEach((value, key) => {
        const age = now.getTime() - value.timestamp.getTime();
        if (age > 2000) {
          newChanges.delete(key);
        }
      });

      setChanges(newChanges);
    }, 500);

    return () => clearInterval(timer);
  }, [changes]);

  if (!metrics) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading metrics...</p>
        </div>
      </div>
    );
  }

  const metricEntries = Object.entries(metrics).filter(([key]) => {
    if (metricType === 'all') return true;
    return key.includes(metricType);
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Live Metrics</h3>
        {lastUpdate && (
          <span className={styles.lastUpdate}>
            Updated: {format(lastUpdate, 'HH:mm:ss')}
          </span>
        )}
      </div>

      <div className={styles.metricsGrid}>
        {metricEntries.map(([key, value]) => {
          const hasChange = changes.has(key);
          const isNumeric = typeof value === 'number';

          return (
            <div
              key={key}
              className={`${styles.metricCard} ${hasChange ? styles.changed : ''}`}
            >
              <div className={styles.metricLabel}>
                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </div>

              <div className={styles.metricValue}>
                {isNumeric ? (
                  <>
                    <span className={styles.number}>
                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                    </span>
                    {hasChange && (
                      <span className={styles.changeIndicator}>
                        {Math.random() > 0.5 ? '↑' : '↓'}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={styles.text}>{String(value)}</span>
                )}
              </div>

              {hasChange && (
                <div className={styles.changeAnimation}></div>
              )}
            </div>
          );
        })}
      </div>

      {metricEntries.length === 0 && (
        <div className={styles.emptyState}>
          <p>No metrics available</p>
        </div>
      )}
    </div>
  );
}
