'use client';

import React, { useState, useEffect } from 'react';
import styles from './analytics-dashboard.module.css';
import { format } from 'date-fns';

interface ChangeMetrics {
  totalChanges: number;
  changesLast24h: number;
  changesLast7d: number;
  changesLast30d: number;
  changesByUser: Array<{ user: string; count: number }>;
  mostChangedFields: Array<{ field: string; count: number }>;
  changesByType: { elder: number; agent: number };
}

interface Trend {
  date: string;
  metrics: {
    changes: number;
    users: number;
    fields: number;
  };
}

/**
 * Analytics Dashboard
 * Comprehensive configuration change metrics and trends
 */
export default function AnalyticsDashboardPage() {
  const [metrics, setMetrics] = useState<ChangeMetrics | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>();
  const [trendDays, setTrendDays] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [entityTypeFilter]);

  useEffect(() => {
    fetchTrends();
  }, [trendDays]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (entityTypeFilter) params.append('entityType', entityTypeFilter);

      const response = await fetch(
        `/api/admin/agents-elders/analytics?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch analytics');

      const data = await response.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async () => {
    try {
      const response = await fetch(
        `/api/admin/agents-elders/analytics/trends?days=${trendDays}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch trends');

      const data = await response.json();
      if (data.success) {
        setTrends(data.data.trends);
      }
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    }
  };

  if (loading && !metrics) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>Configuration Analytics</h1>
          <p className={styles.subtitle}>
            Comprehensive metrics on configuration changes and system activity
          </p>
        </div>
        <div className={styles.controls}>
          <select
            value={entityTypeFilter || ''}
            onChange={(e) => setEntityTypeFilter(e.target.value || undefined)}
            className={styles.filterSelect}
          >
            <option value="">All Entity Types</option>
            <option value="elder">Elders Only</option>
            <option value="agent">Agents Only</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorBox}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Metrics Grid */}
      {metrics && (
        <>
          {/* Key Metrics Cards */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Total Changes</div>
              <div className={styles.metricValue}>
                {metrics.totalChanges.toLocaleString()}
              </div>
              <div className={styles.metricTrend}>All time</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Last 24 Hours</div>
              <div className={styles.metricValue}>
                {metrics.changesLast24h}
              </div>
              <div className={styles.metricTrend}>
                {metrics.changesLast24h > 0 ? '📈' : '➡️'} Recent activity
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Last 7 Days</div>
              <div className={styles.metricValue}>
                {metrics.changesLast7d}
              </div>
              <div className={styles.metricTrend}>
                ~{Math.round(metrics.changesLast7d / 7)}/day
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Last 30 Days</div>
              <div className={styles.metricValue}>
                {metrics.changesLast30d}
              </div>
              <div className={styles.metricTrend}>
                ~{Math.round(metrics.changesLast30d / 30)}/day
              </div>
            </div>
          </div>

          {/* Main Analytics Section */}
          <div className={styles.analyticsGrid}>
            {/* Changes by Type */}
            <div className={styles.card}>
              <h2>Changes by Entity Type</h2>
              <div className={styles.chartContainer}>
                <div className={styles.donutChart}>
                  <div
                    className={styles.donutSegment}
                    style={{
                      background: `conic-gradient(
                        #3b82f6 0deg ${(metrics.changesByType.elder / (metrics.changesByType.elder + metrics.changesByType.agent)) * 360}deg,
                        #8b5cf6 ${(metrics.changesByType.elder / (metrics.changesByType.elder + metrics.changesByType.agent)) * 360}deg
                      )`,
                      width: '200px',
                      height: '200px'
                    }}
                  >
                    <div className={styles.donutCenter}>
                      <span className={styles.donutText}>{metrics.totalChanges}</span>
                      <span className={styles.donutSubtext}>Total</span>
                    </div>
                  </div>
                </div>
                <div className={styles.chartLegend}>
                  <div className={styles.legendItem}>
                    <span
                      className={styles.legendColor}
                      style={{ backgroundColor: '#3b82f6' }}
                    ></span>
                    <span>Elders: {metrics.changesByType.elder}</span>
                  </div>
                  <div className={styles.legendItem}>
                    <span
                      className={styles.legendColor}
                      style={{ backgroundColor: '#8b5cf6' }}
                    ></span>
                    <span>Agents: {metrics.changesByType.agent}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Changed Fields */}
            <div className={styles.card}>
              <h2>Most Changed Fields</h2>
              <div className={styles.listContainer}>
                {metrics.mostChangedFields.map((field, idx) => (
                  <div key={field.field} className={styles.listItem}>
                    <span className={styles.listRank}>{idx + 1}</span>
                    <span className={styles.listLabel}>{field.field}</span>
                    <span className={styles.listValue}>{field.count}</span>
                    <div
                      className={styles.listBar}
                      style={{
                        width: `${(field.count / metrics.mostChangedFields[0].count) * 100}%`
                      }}
                    ></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Changes by User */}
            <div className={`${styles.card} ${styles.wideCard}`}>
              <h2>Top Contributors</h2>
              <div className={styles.userGrid}>
                {metrics.changesByUser.slice(0, 6).map((user, idx) => (
                  <div key={user.user} className={styles.userCard}>
                    <div className={styles.userRank}>{idx + 1}</div>
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>{user.user}</div>
                      <div className={styles.userChanges}>{user.count} changes</div>
                    </div>
                    <div className={styles.userBar}>
                      <div
                        className={styles.userBarFill}
                        style={{
                          width: `${(user.count / metrics.changesByUser[0].count) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trends Section */}
          {trends.length > 0 && (
            <div className={styles.trendsSection}>
              <div className={styles.trendsHeader}>
                <h2>Activity Trends</h2>
                <select
                  value={trendDays}
                  onChange={(e) => setTrendDays(Number(e.target.value))}
                  className={styles.trendSelect}
                >
                  <option value={7}>Last 7 Days</option>
                  <option value={14}>Last 14 Days</option>
                  <option value={30}>Last 30 Days</option>
                  <option value={90}>Last 90 Days</option>
                </select>
              </div>

              <div className={styles.trendChart}>
                <div className={styles.trendGrid}>
                  {/* Y-axis labels */}
                  <div className={styles.yAxis}>
                    <div className={styles.axisLabel}></div>
                    <div className={styles.axisLabel}>
                      {Math.max(...trends.map(t => t.metrics.changes))}
                    </div>
                    <div className={styles.axisLabel}>
                      {Math.max(...trends.map(t => t.metrics.changes)) / 2}
                    </div>
                    <div className={styles.axisLabel}>0</div>
                  </div>

                  {/* Bars */}
                  <div className={styles.bars}>
                    {trends.map((trend, idx) => (
                      <div key={idx} className={styles.barColumn}>
                        <div className={styles.barContainer}>
                          <div
                            className={styles.bar}
                            style={{
                              height: `${(trend.metrics.changes / Math.max(...trends.map(t => t.metrics.changes))) * 100}%`
                            }}
                          >
                            <span className={styles.barValue}>
                              {trend.metrics.changes}
                            </span>
                          </div>
                        </div>
                        <span className={styles.barLabel}>
                          {format(new Date(trend.date), 'MMM dd')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.trendLegend}>
                <div className={styles.trendLegendItem}>
                  <span className={styles.trendDot}></span>
                  <span>Changes per day</span>
                </div>
              </div>
            </div>
          )}

          {/* Statistics Summary */}
          <div className={styles.summarySection}>
            <h2>Summary Statistics</h2>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Average Changes Per Day (30d)</span>
                <span className={styles.summaryValue}>
                  {(metrics.changesLast30d / 30).toFixed(1)}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Most Active User</span>
                <span className={styles.summaryValue}>
                  {metrics.changesByUser[0]?.user || 'N/A'}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Most Changed Field</span>
                <span className={styles.summaryValue}>
                  {metrics.mostChangedFields[0]?.field || 'N/A'}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Peak Activity Period</span>
                <span className={styles.summaryValue}>
                  {trends.length > 0
                    ? format(new Date(trends[0].date), 'MMM dd')
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
