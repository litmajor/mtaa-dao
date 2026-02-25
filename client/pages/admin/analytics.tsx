import React, { useState, useEffect } from 'react';
import styles from './analytics.module.css';

interface TrendData {
  date: string;
  participationRate: number;
  proposalCount: number;
}

interface Member {
  name: string;
  voteCount: number;
}

export default function AnalyticsDashboard() {
  const [daoId, setDaoId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [healthStatus, setHealthStatus] = useState('');
  const [healthComponents, setHealthComponents] = useState<Record<string, number>>({});
  const [engagement, setEngagement] = useState<any>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [roleDistribution, setRoleDistribution] = useState<any>(null);
  const [votingPatterns, setVotingPatterns] = useState<any>(null);
  const [growth, setGrowth] = useState<any>(null);
  const [selectedView, setSelectedView] = useState<'health' | 'engagement' | 'trends' | 'roles' | 'voting' | 'growth'>('health');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('daoId') || localStorage.getItem('currentDaoId') || '';
    setDaoId(id);

    if (id) {
      loadAnalyticsData(id);
    }
  }, []);

  const loadAnalyticsData = async (id: string) => {
    setLoading(true);
    try {
      const [
        healthRes,
        engagementRes,
        trendsRes,
        rolesRes,
        votingRes,
        growthRes,
      ] = await Promise.all([
        fetch(`/api/admin/daos/${id}/analytics/governance-health`),
        fetch(`/api/admin/daos/${id}/analytics/engagement`),
        fetch(`/api/admin/daos/${id}/analytics/participation-trends?days=30`),
        fetch(`/api/admin/daos/${id}/analytics/role-distribution`),
        fetch(`/api/admin/daos/${id}/analytics/voting-patterns`),
        fetch(`/api/admin/daos/${id}/analytics/growth`),
      ]);

      const health = await healthRes.json();
      const eng = await engagementRes.json();
      const tr = await trendsRes.json();
      const roles = await rolesRes.json();
      const voting = await votingRes.json();
      const gr = await growthRes.json();

      setHealthScore(health.healthScore);
      setHealthStatus(health.status);
      setHealthComponents(health.components || {});
      setEngagement(eng.engagement || {});
      setTrends(tr.trends || []);
      setRoleDistribution(roles);
      setVotingPatterns(voting.patterns || {});
      setGrowth(gr);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#4caf50'; // Green
    if (score >= 60) return '#fbc02d'; // Yellow
    if (score >= 40) return '#ff9800'; // Orange
    return '#d32f2f'; // Red
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Advanced Analytics Dashboard</h1>
        <button className={styles.refreshBtn} onClick={() => loadAnalyticsData(daoId)} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Quick Metrics */}
      <div className={styles.quickMetrics}>
        <div className={styles.metric}>
          <div className={styles.label}>Health Score</div>
          <div
            className={styles.value}
            style={{ color: getHealthColor(healthScore || 0) }}
          >
            {healthScore !== null ? healthScore : '--'}
          </div>
          <div className={styles.status}>{healthStatus || 'Loading...'}</div>
        </div>

        {engagement.totalVoters && (
          <div className={styles.metric}>
            <div className={styles.label}>Active Voters</div>
            <div className={styles.value}>{engagement.totalVoters}</div>
            <div className={styles.status}>Avg {(engagement.avgVotesPerMember || 0).toFixed(1)} votes</div>
          </div>
        )}

        {roleDistribution?.total && (
          <div className={styles.metric}>
            <div className={styles.label}>Members</div>
            <div className={styles.value}>{roleDistribution.total}</div>
            <div className={styles.status}>
              {roleDistribution.distribution.admin || 0} admins
            </div>
          </div>
        )}

        {votingPatterns.totalVotes && (
          <div className={styles.metric}>
            <div className={styles.label}>Total Votes</div>
            <div className={styles.value}>{votingPatterns.totalVotes}</div>
            <div className={styles.status}>{votingPatterns.consensus} consensus</div>
          </div>
        )}
      </div>

      {/* View Selector */}
      <div className={styles.viewSelector}>
        <button
          className={`${styles.viewBtn} ${selectedView === 'health' ? styles.active : ''}`}
          onClick={() => setSelectedView('health')}
        >
          Governance Health
        </button>
        <button
          className={`${styles.viewBtn} ${selectedView === 'engagement' ? styles.active : ''}`}
          onClick={() => setSelectedView('engagement')}
        >
          Member Engagement
        </button>
        <button
          className={`${styles.viewBtn} ${selectedView === 'trends' ? styles.active : ''}`}
          onClick={() => setSelectedView('trends')}
        >
          Participation Trends
        </button>
        <button
          className={`${styles.viewBtn} ${selectedView === 'roles' ? styles.active : ''}`}
          onClick={() => setSelectedView('roles')}
        >
          Role Distribution
        </button>
        <button
          className={`${styles.viewBtn} ${selectedView === 'voting' ? styles.active : ''}`}
          onClick={() => setSelectedView('voting')}
        >
          Voting Patterns
        </button>
        <button
          className={`${styles.viewBtn} ${selectedView === 'growth' ? styles.active : ''}`}
          onClick={() => setSelectedView('growth')}
        >
          Growth Metrics
        </button>
      </div>

      {/* Content Views */}
      <div className={styles.viewContent}>
        {/* Governance Health */}
        {selectedView === 'health' && (
          <div className={styles.section}>
            <h2>Governance Health Score</h2>
            <div className={styles.healthGrid}>
              <div className={styles.healthCircle}>
                <div
                  className={styles.circle}
                  style={{ backgroundColor: getHealthColor(healthScore || 0) }}
                >
                  <div className={styles.scoreText}>{healthScore}</div>
                </div>
                <p className={styles.scoreLabel}>Overall Score</p>
              </div>

              <div className={styles.componentsGrid}>
                {Object.entries(healthComponents).map(([key, value]) => (
                  <div key={key} className={styles.componentCard}>
                    <h4>{key.charAt(0).toUpperCase() + key.slice(1)}</h4>
                    <div className={styles.componentScore}>
                      <div className={styles.componentBar}>
                        <div
                          className={styles.componentFill}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span>{value?.toFixed(1)}/25</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Member Engagement */}
        {selectedView === 'engagement' && engagement && (
          <div className={styles.section}>
            <h2>Member Engagement Metrics</h2>
            <div className={styles.engagementGrid}>
              <div className={styles.engagementCard}>
                <h3>Total Voters</h3>
                <p className={styles.largeNumber}>{engagement.totalVoters || 0}</p>
              </div>
              <div className={styles.engagementCard}>
                <h3>Avg Votes/Member</h3>
                <p className={styles.largeNumber}>
                  {(engagement.avgVotesPerMember || 0).toFixed(1)}
                </p>
              </div>
              <div className={styles.engagementCard}>
                <h3>Participation Trend</h3>
                <div className={styles.trend}>
                  {engagement.participation_trend?.slice(-3).map((p: number, i: number) => (
                    <div
                      key={i}
                      className={styles.trendBar}
                      style={{ height: `${p * 100}%` }}
                      title={`${(p * 100).toFixed(0)}%`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {engagement.topVoters && engagement.topVoters.length > 0 && (
              <div className={styles.topVotersSection}>
                <h3>Top Voters</h3>
                <div className={styles.topVotersList}>
                  {engagement.topVoters.slice(0, 10).map((voter: any, idx: number) => (
                    <div key={idx} className={styles.voterRow}>
                      <span className={styles.rank}>#{idx + 1}</span>
                      <span className={styles.votes}>{voter.voteCount} votes</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Participation Trends */}
        {selectedView === 'trends' && trends.length > 0 && (
          <div className={styles.section}>
            <h2>30-Day Participation Trends</h2>
            <div className={styles.trendsChart}>
              <div className={styles.chartArea}>
                {trends.map((trend, idx) => (
                  <div key={idx} className={styles.trendPoint}>
                    <div
                      className={styles.bar}
                      style={{ height: `${trend.participationRate * 100}%` }}
                      title={`${trend.date}: ${(trend.participationRate * 100).toFixed(1)}%`}
                    />
                  </div>
                ))}
              </div>
              <div className={styles.trendStats}>
                <p>
                  <strong>Average:</strong> {trends.length > 0
                    ? (
                        (trends.reduce((sum, t) => sum + t.participationRate, 0) / trends.length) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
                <p>
                  <strong>Highest:</strong> {trends.length > 0
                    ? (Math.max(...trends.map(t => t.participationRate)) * 100).toFixed(1)
                    : 0}
                  %
                </p>
                <p>
                  <strong>Lowest:</strong> {trends.length > 0
                    ? (Math.min(...trends.map(t => t.participationRate)) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Role Distribution */}
        {selectedView === 'roles' && roleDistribution && (
          <div className={styles.section}>
            <h2>Role Distribution Pyramid</h2>
            <div className={styles.pyramid}>
              {roleDistribution.pyramid?.map((level: any, idx: number) => (
                <div key={idx} className={styles.pyramidLevel}>
                  <div className={styles.pyramidLabel}>{level.role}</div>
                  <div className={styles.pyramidBar}>
                    <div
                      className={styles.pyramidFill}
                      style={{
                        width: `${(level.count / (roleDistribution.total || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className={styles.pyramidCount}>
                    {level.count} ({roleDistribution.percentages?.[level.role] || 0}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voting Patterns */}
        {selectedView === 'voting' && votingPatterns && (
          <div className={styles.section}>
            <h2>Voting Pattern Analysis</h2>
            <div className={styles.votingGrid}>
              <div className={styles.votingCard}>
                <h3>Support Rate</h3>
                <div className={styles.votingBar}>
                  <div
                    className={styles.votingFill}
                    style={{
                      width: `${votingPatterns.yes?.percentage || 0}%`,
                      backgroundColor: '#4caf50',
                    }}
                  />
                </div>
                <p>{votingPatterns.yes?.percentage || 0}% ({votingPatterns.yes?.count || 0} votes)</p>
              </div>

              <div className={styles.votingCard}>
                <h3>Opposition Rate</h3>
                <div className={styles.votingBar}>
                  <div
                    className={styles.votingFill}
                    style={{
                      width: `${votingPatterns.no?.percentage || 0}%`,
                      backgroundColor: '#d32f2f',
                    }}
                  />
                </div>
                <p>{votingPatterns.no?.percentage || 0}% ({votingPatterns.no?.count || 0} votes)</p>
              </div>

              <div className={styles.votingCard}>
                <h3>Abstain Rate</h3>
                <div className={styles.votingBar}>
                  <div
                    className={styles.votingFill}
                    style={{
                      width: `${votingPatterns.abstain?.percentage || 0}%`,
                      backgroundColor: '#999',
                    }}
                  />
                </div>
                <p>{votingPatterns.abstain?.percentage || 0}% ({votingPatterns.abstain?.count || 0} votes)</p>
              </div>
            </div>
            <div className={styles.consensusIndicator}>
              <p className={styles.consensusLabel}>Consensus Level:</p>
              <p className={styles.consensusValue}>{votingPatterns.consensus || 'N/A'}</p>
            </div>
          </div>
        )}

        {/* Growth Metrics */}
        {selectedView === 'growth' && growth && (
          <div className={styles.section}>
            <h2>DAO Growth Metrics</h2>
            <div className={styles.growthGrid}>
              <div className={styles.growthCard}>
                <h3>Member Growth</h3>
                <p className={styles.growthPercent}>
                  {growth.summary?.memberGrowth?.toFixed(0)}%
                </p>
                <p className={styles.growthLabel}>6-month increase</p>
              </div>

              <div className={styles.growthCard}>
                <h3>Proposal Growth</h3>
                <p className={styles.growthPercent}>
                  {growth.summary?.proposalGrowth?.toFixed(0)}%
                </p>
                <p className={styles.growthLabel}>6-month increase</p>
              </div>

              <div className={styles.growthCard}>
                <h3>Voter Growth</h3>
                <p className={styles.growthPercent}>
                  {growth.summary?.voterGrowth?.toFixed(0)}%
                </p>
                <p className={styles.growthLabel}>6-month increase</p>
              </div>
            </div>

            {growth.monthlyGrowth && (
              <div className={styles.monthlyChart}>
                <h3>Monthly Breakdown</h3>
                <div className={styles.monthlyGrid}>
                  {growth.monthlyGrowth.map((month: any, idx: number) => (
                    <div key={idx} className={styles.monthCard}>
                      <p className={styles.month}>{month.month}</p>
                      <p className={styles.stat}>Members: {month.members}</p>
                      <p className={styles.stat}>Proposals: {month.proposals}</p>
                      <p className={styles.stat}>Voters: {month.activeVoters}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
