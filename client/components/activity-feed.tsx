'use client';

import React, { useState } from 'react';
import styles from './activity-feed.module.css';
import { useRealtimeActivity } from '@/hooks/useWebSocket';
import { format } from 'date-fns';

interface ActivityFeedProps {
  entityType?: string;
  entityId?: string;
  maxItems?: number;
}

/**
 * Real-time Activity Feed Component
 * Stream of live activity events
 */
export default function ActivityFeed({
  entityType,
  entityId,
  maxItems = 50
}: ActivityFeedProps) {
  const { activities } = useRealtimeActivity(entityType, entityId);
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null);

  const getActivityIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'created':
        return '➕';
      case 'updated':
        return '✏️';
      case 'deleted':
        return '🗑️';
      case 'viewed':
        return '👁️';
      case 'submitted':
        return '📤';
      case 'approved':
        return '✅';
      case 'rejected':
        return '❌';
      default:
        return '📝';
    }
  };

  const getActivityColor = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Live Activity Feed</h3>
        <span className={styles.count}>{activities.length} events</span>
      </div>

      {activities.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No activity yet</p>
          <span className={styles.hint}>Activity will appear here as it happens</span>
        </div>
      ) : (
        <div className={styles.feed}>
          {activities.slice(0, maxItems).map((activity, index) => (
            <div
              key={`${activity.timestamp}-${index}`}
              className={`${styles.activityItem} ${styles[getActivityColor(activity.severity)]}`}
            >
              <div className={styles.activityIcon}>
                {getActivityIcon(activity.action)}
              </div>

              <div
                className={styles.activityContent}
                onClick={() => setExpandedActivity(expandedActivity === index ? null : index)}
              >
                <div className={styles.activityHeader}>
                  <span className={styles.action}>
                    {activity.action}
                  </span>
                  {activity.entityId && (
                    <span className={styles.entity}>
                      {activity.entityType} / {activity.entityId}
                    </span>
                  )}
                  <span className={styles.time}>
                    {format(new Date(activity.timestamp), 'HH:mm:ss')}
                  </span>
                </div>

                {activity.user && (
                  <div className={styles.user}>
                    👤 {activity.user}
                  </div>
                )}

                {expandedActivity === index && activity.details && (
                  <div className={styles.details}>
                    <pre className={styles.detailsCode}>
                      {JSON.stringify(activity.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {activity.details && (
                <span className={styles.expandIcon}>
                  {expandedActivity === index ? '▼' : '▶'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {activities.length > maxItems && (
        <div className={styles.moreIndicator}>
          +{activities.length - maxItems} more events
        </div>
      )}
    </div>
  );
}
