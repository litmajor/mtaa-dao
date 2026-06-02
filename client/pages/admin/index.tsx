import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatCard } from '@/components/admin/StatCard';
import {
  Users,
  Building,
  FileText,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from '../../src/lib/icons';
import styles from './dashboard.module.css';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalDaos: number;
  activeDaos: number;
  totalVaults: number;
  totalTreasuryBalance: number;
}

interface RecentActivity {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch user stats
      const userStatsRes = await fetch('/api/admin/users/stats');
      const userStats = await userStatsRes.json();

      // Fetch DAO stats
      const daoStatsRes = await fetch('/api/admin/daos/stats');
      const daoStats = await daoStatsRes.json();

      // Fetch recent audit logs
      const logsRes = await fetch('/api/admin/audit?limit=5');
      const logsData = await logsRes.json();

      setStats({
        totalUsers: userStats.stats.totalUsers,
        activeUsers: userStats.stats.activeUsers,
        bannedUsers: userStats.stats.bannedUsers,
        totalDaos: daoStats.stats.totalDaos,
        activeDaos: daoStats.stats.activeDaos,
        totalVaults: daoStats.stats.totalVaults,
        totalTreasuryBalance: daoStats.stats.totalTreasuryBalance,
      });

      setActivities(logsData.logs || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <AdminLayout title="Dashboard">
        <div className={styles.error}>
          <AlertCircle size={24} />
          <p>{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      <div className={styles.container}>
        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <StatCard
            icon={Users}
            label="Total Users"
            value={stats?.totalUsers || 0}
            trend={{ direction: 'up', percentage: 12 }}
          />
          <StatCard
            icon={Users}
            label="Active Users"
            value={stats?.activeUsers || 0}
            trend={{ direction: 'up', percentage: 8 }}
          />
          <StatCard
            icon={Users}
            label="Banned Users"
            value={stats?.bannedUsers || 0}
            trend={{ direction: 'down', percentage: 3 }}
          />
          <StatCard
            icon={Building}
            label="Total DAOs"
            value={stats?.totalDaos || 0}
            trend={{ direction: 'up', percentage: 5 }}
          />
          <StatCard
            icon={Building}
            label="Active DAOs"
            value={stats?.activeDaos || 0}
            trend={{ direction: 'up', percentage: 4 }}
          />
          <StatCard
            icon={DollarSign}
            label="Treasury Value"
            value={`$${(stats?.totalTreasuryBalance || 0).toLocaleString()}`}
            trend={{ direction: 'up', percentage: 15 }}
          />
        </div>

        {/* Recent Activity */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent Activity</h2>
          <div className={styles.activityList}>
            {activities.length === 0 ? (
              <p className={styles.empty}>No recent activity</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityContent}>
                    <p className={styles.activityAction}>{activity.action}</p>
                    <p className={styles.activityUser}>{activity.user}</p>
                  </div>
                  <div className={styles.activityMeta}>
                    <span className={`${styles.severity} ${styles[activity.severity]}`}>
                      {activity.severity}
                    </span>
                    <span className={styles.timestamp}>{activity.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.quickActions}>
            <button className={styles.actionBtn}>Ban User</button>
            <button className={styles.actionBtn}>Suspend DAO</button>
            <button className={styles.actionBtn}>View Audit Logs</button>
            <button className={styles.actionBtn}>System Settings</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
