'use client';

import React, { useEffect } from 'react';
import styles from './presence-indicator.module.css';
import { useRealtimePresence, useRealtimeDashboard } from '@/hooks/useWebSocket';

interface PresenceIndicatorProps {
  section: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * User Presence Indicator
 * Shows who is currently viewing/editing
 */
export default function PresenceIndicator({
  section,
  size = 'medium'
}: PresenceIndicatorProps) {
  const { presentUsers } = useRealtimePresence(section);
  const { userCount } = useRealtimeDashboard();

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'editing':
        return '✏️';
      case 'searching':
        return '🔍';
      case 'viewing':
      default:
        return '👁️';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'editing':
        return 'Editing';
      case 'searching':
        return 'Searching';
      case 'viewing':
      default:
        return 'Viewing';
    }
  };

  if (presentUsers.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.container} ${styles[size]}`}>
      <div className={styles.header}>
        <span className={styles.title}>Active Users</span>
        <span className={styles.badge}>{presentUsers.length}</span>
      </div>

      <div className={styles.users}>
        {presentUsers.slice(0, 5).map((user, index) => (
          <div key={user.userId} className={styles.userItem}>
            <div className={styles.userAvatar}>
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>
                {user.email?.split('@')[0]}
              </span>
              <span className={styles.userAction}>
                {getActionBadge(user.action)} {getActionLabel(user.action)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {presentUsers.length > 5 && (
        <div className={styles.moreUsers}>
          +{presentUsers.length - 5} more
        </div>
      )}

      <div className={styles.totalUsers}>
        <span>🌐 {userCount} online</span>
      </div>
    </div>
  );
}
