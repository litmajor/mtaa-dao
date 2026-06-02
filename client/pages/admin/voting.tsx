import React, { useState, useEffect } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useRouter } from 'next/router';
import { useAuth } from '@clerk/nextjs';
import Head from 'next/head';
import styles from './voting.module.css';

interface VotingConfig {
  votingPeriodDays: number;
  approvalThreshold: number;
  minimumParticipation: number;
  votingWeightType: 'equal' | 'stake-based' | 'reputation-based';
  votingPaused: boolean;
  allowAbstain: boolean;
  requireSignature: boolean;
  delayExecutionDays: number;
}

interface VotingAnalytics {
  totalProposals: number;
  passedProposals: number;
  failedProposals: number;
  passRate: number;
  averageParticipation: number;
  votingStatus: 'active' | 'paused';
}

interface ParticipationMember {
  memberId: string;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
}

export default function VotingPage() {
  const router = useRouter();
  const { daoId } = router.query;
  const { userId } = useAuth();
  const [config, setConfig] = useState<VotingConfig | null>(null);
  const [analytics, setAnalytics] = useState<VotingAnalytics | null>(null);
  const [participation, setParticipation] = useState<ParticipationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [editConfig, setEditConfig] = useState<Partial<VotingConfig>>({});

  useEffect(() => {
    if (daoId && userId) {
      fetchConfig();
      fetchAnalytics();
      fetchParticipation();
    }
  }, [daoId, userId]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/voting/config`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch voting config');
      }

      const data = await response.json();
      setConfig(data.config);
      setEditConfig(data.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/voting/analytics`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data.analytics);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const fetchParticipation = async () => {
    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/voting/participation`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch participation');
      }

      const data = await response.json();
      setParticipation(data.participation);
    } catch (err) {
      console.error('Error fetching participation:', err);
    }
  };

  const handleSaveConfig = async () => {
    setSaveInProgress(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/voting/config`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editConfig),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save voting config');
      }

      await fetchConfig();
      await fetchAnalytics();
      setEditing(false);
      setSuccess('Voting configuration updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaveInProgress(false);
    }
  };

  const handlePauseVoting = async () => {
    setConfirmPauseOpen(true);
  };

  const [confirmPauseOpen, setConfirmPauseOpen] = useState(false);

  const confirmPauseVoting = async () => {
    setConfirmPauseOpen(false);
    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/voting/pause`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Paused by admin' }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to pause voting');
      }

      await fetchConfig();
      await fetchAnalytics();
      setSuccess('Voting paused successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleResumeVoting = async () => {
    setConfirmResumeOpen(true);
  };

  const [confirmResumeOpen, setConfirmResumeOpen] = useState(false);

  const confirmResumeVoting = async () => {
    setConfirmResumeOpen(false);
    try {
      const response = await fetch(
        `/api/admin/daos/${daoId}/voting/resume`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to resume voting');
      }

      await fetchConfig();
      await fetchAnalytics();
      setSuccess('Voting resumed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <>
      <Head>
        <title>Voting Configuration</title>
        <meta name="description" content="Configure DAO voting mechanics" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Voting Configuration</h1>
          <p>Configure voting mechanics and view voting analytics</p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}
        {success && <div className={styles.successBanner}>{success}</div>}
        <ConfirmDialog
          open={confirmPauseOpen}
          title="Pause Voting"
          description="Are you sure you want to pause voting?"
          confirmLabel="Pause"
          cancelLabel="Cancel"
            onClose={(open: boolean) => setConfirmPauseOpen(open)}
          onConfirm={confirmPauseVoting}
        />
        <ConfirmDialog
          open={confirmResumeOpen}
          title="Resume Voting"
          description="Are you sure you want to resume voting?"
          confirmLabel="Resume"
          cancelLabel="Cancel"
            onClose={(open: boolean) => setConfirmResumeOpen(open)}
          onConfirm={confirmResumeVoting}
        />

        {/* Analytics Section */}
        {analytics && (
          <div className={styles.section}>
            <h2>Voting Analytics</h2>
            <div className={styles.analyticsGrid}>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsLabel}>Status</div>
                <div
                  className={styles.analyticsValue}
                  style={{
                    color: analytics.votingStatus === 'active' ? '#10b981' : '#dc2626',
                  }}
                >
                  {analytics.votingStatus.charAt(0).toUpperCase() +
                    analytics.votingStatus.slice(1)}
                </div>
              </div>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsLabel}>Total Proposals</div>
                <div className={styles.analyticsValue}>
                  {analytics.totalProposals}
                </div>
              </div>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsLabel}>Passed</div>
                <div className={styles.analyticsValue}>
                  {analytics.passedProposals}
                </div>
              </div>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsLabel}>Failed</div>
                <div className={styles.analyticsValue}>
                  {analytics.failedProposals}
                </div>
              </div>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsLabel}>Pass Rate</div>
                <div className={styles.analyticsValue}>
                  {analytics.passRate.toFixed(1)}%
                </div>
              </div>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsLabel}>Avg Participation</div>
                <div className={styles.analyticsValue}>
                  {(analytics.averageParticipation * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Voting Status Controls */}
        {analytics && (
          <div className={styles.section}>
            <h2>Voting Status</h2>
            <div className={styles.statusControls}>
              {analytics.votingStatus === 'active' ? (
                <button
                  onClick={handlePauseVoting}
                  className={styles.button}
                  style={{ backgroundColor: '#dc2626' }}
                >
                  Pause Voting
                </button>
              ) : (
                <button
                  onClick={handleResumeVoting}
                  className={styles.button}
                  style={{ backgroundColor: '#10b981' }}
                >
                  Resume Voting
                </button>
              )}
            </div>
          </div>
        )}

        {/* Configuration Section */}
        {config && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Voting Parameters</h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className={styles.button}
                  style={{ backgroundColor: '#2563eb' }}
                >
                  Edit Settings
                </button>
              )}
            </div>

            {editing ? (
              <div className={styles.editForm}>
                <div className={styles.formGroup}>
                  <label>Voting Period (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={editConfig.votingPeriodDays || 7}
                    onChange={(e) =>
                      setEditConfig({
                        ...editConfig,
                        votingPeriodDays: parseInt(e.target.value),
                      })
                    }
                    className={styles.input}
                  />
                  <small>How long voting stays open for each proposal (1-90 days)</small>
                </div>

                <div className={styles.formGroup}>
                  <label>Approval Threshold</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={editConfig.approvalThreshold || 0.5}
                    onChange={(e) =>
                      setEditConfig({
                        ...editConfig,
                        approvalThreshold: parseFloat(e.target.value),
                      })
                    }
                    className={styles.input}
                  />
                  <small>
                    Percentage of votes needed to pass (0-1, where 0.5 = 50%)
                  </small>
                </div>

                <div className={styles.formGroup}>
                  <label>Minimum Participation</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={editConfig.minimumParticipation || 0.2}
                    onChange={(e) =>
                      setEditConfig({
                        ...editConfig,
                        minimumParticipation: parseFloat(e.target.value),
                      })
                    }
                    className={styles.input}
                  />
                  <small>
                    Minimum participation required for proposal to be valid
                    (0-1, where 0.2 = 20%)
                  </small>
                </div>

                <div className={styles.formGroup}>
                  <label>Voting Weight Type</label>
                  <select
                    value={editConfig.votingWeightType || 'equal'}
                    onChange={(e) =>
                      setEditConfig({
                        ...editConfig,
                        votingWeightType: e.target.value as any,
                      })
                    }
                    className={styles.select}
                  >
                    <option value="equal">Equal (1 member = 1 vote)</option>
                    <option value="stake-based">Stake-Based</option>
                    <option value="reputation-based">Reputation-Based</option>
                  </select>
                  <small>How voting power is distributed among members</small>
                </div>

                <div className={styles.formActions}>
                  <button
                    onClick={handleSaveConfig}
                    disabled={saveInProgress}
                    className={styles.button}
                    style={{ backgroundColor: '#10b981' }}
                  >
                    {saveInProgress ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditConfig(config);
                    }}
                    disabled={saveInProgress}
                    className={styles.button}
                    style={{ backgroundColor: '#6b7280' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.configDisplay}>
                <div className={styles.configItem}>
                  <div className={styles.configLabel}>Voting Period</div>
                  <div className={styles.configValue}>
                    {config.votingPeriodDays} days
                  </div>
                </div>

                <div className={styles.configItem}>
                  <div className={styles.configLabel}>Approval Threshold</div>
                  <div className={styles.configValue}>
                    {(config.approvalThreshold * 100).toFixed(0)}%
                  </div>
                </div>

                <div className={styles.configItem}>
                  <div className={styles.configLabel}>Minimum Participation</div>
                  <div className={styles.configValue}>
                    {(config.minimumParticipation * 100).toFixed(0)}%
                  </div>
                </div>

                <div className={styles.configItem}>
                  <div className={styles.configLabel}>Voting Weight Type</div>
                  <div className={styles.configValue}>
                    {config.votingWeightType
                      .split('-')
                      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')}
                  </div>
                </div>

                <div className={styles.configItem}>
                  <div className={styles.configLabel}>Allow Abstain</div>
                  <div className={styles.configValue}>
                    {config.allowAbstain ? 'Yes' : 'No'}
                  </div>
                </div>

                <div className={styles.configItem}>
                  <div className={styles.configLabel}>Require Signature</div>
                  <div className={styles.configValue}>
                    {config.requireSignature ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Participation Section */}
        {participation.length > 0 && (
          <div className={styles.section}>
            <h2>Member Participation</h2>
            <div className={styles.participationTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Total Votes</th>
                    <th>Yes</th>
                    <th>No</th>
                    <th>Abstain</th>
                  </tr>
                </thead>
                <tbody>
                  {participation.map((member, index) => (
                    <tr key={index}>
                      <td>User #{member.memberId.slice(0, 8)}</td>
                      <td>
                        <strong>{member.totalVotes}</strong>
                      </td>
                      <td className={styles.voteYes}>{member.yesVotes}</td>
                      <td className={styles.voteNo}>{member.noVotes}</td>
                      <td className={styles.voteAbstain}>{member.abstainVotes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
