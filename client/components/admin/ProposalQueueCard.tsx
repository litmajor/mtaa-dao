import React, { useState } from 'react';
import styles from './ProposalQueueCard.module.css';

interface Proposal {
  id: string;
  agent_id: string;
  action_type: string;
  proposed_args: Record<string, any>;
  risk_score: number;
  risk_category: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string;
  created_at: Date;
  expires_at: Date;
}

interface ProposalQueueCardProps {
  proposals: Proposal[];
  onApprove: (proposalId: string, reason: string) => Promise<void>;
  onReject: (proposalId: string, reason: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const ProposalQueueCard: React.FC<ProposalQueueCardProps> = ({
  proposals,
  onApprove,
  onReject,
  onRefresh,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const getRiskColor = (category: string): string => {
    switch (category) {
      case 'LOW':
        return 'green';
      case 'MEDIUM':
        return 'yellow';
      case 'HIGH':
        return 'red';
      default:
        return 'gray';
    }
  };

  const formatTimeRemaining = (expiresAt: Date): string => {
    const now = new Date();
    const diff = new Date(expiresAt).getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 0) return 'Expired';
    if (minutes < 1) return 'Less than 1 min';
    if (minutes < 60) return `${minutes} min left`;

    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} left`;
  };

  const handleApprove = async (proposalId: string) => {
    if (approvalReason.length < 10) {
      alert('Please provide a reason (min 10 characters)');
      return;
    }

    setLoading(true);
    try {
      await onApprove(proposalId, approvalReason);
      setApprovalReason('');
      setExpandedId(null);
      await onRefresh();
    } catch (error: any) {
      alert(`Error approving proposal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (proposalId: string) => {
    if (rejectionReason.length < 10) {
      alert('Please provide a reason (min 10 characters)');
      return;
    }

    setLoading(true);
    try {
      await onReject(proposalId, rejectionReason);
      setRejectionReason('');
      setExpandedId(null);
      await onRefresh();
    } catch (error: any) {
      alert(`Error rejecting proposal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (proposals.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h3>📋 Pending Proposals</h3>
          <span className={styles.badge}>0</span>
        </div>
        <div className={styles.empty}>
          <p>No pending proposals</p>
          <p className={styles.subtext}>Agents can propose actions when safe mode is enabled</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3>📋 Pending Proposals</h3>
        <span className={styles.badge}>{proposals.length}</span>
      </div>

      <div className={styles.proposalList}>
        {proposals.map((proposal) => (
          <div
            key={proposal.id}
            className={`${styles.proposalItem} ${expandedId === proposal.id ? styles.expanded : ''}`}
          >
            <div className={styles.proposalSummary} onClick={() => setExpandedId(expandedId === proposal.id ? null : proposal.id)}>
              <div className={styles.left}>
                <span className={`${styles.riskBadge} ${styles[`risk-${proposal.risk_category.toLowerCase()}`]}`}>
                  {proposal.risk_category}
                </span>
                <div className={styles.proposalInfo}>
                  <span className={styles.agent}>{proposal.agent_id}</span>
                  <span className={styles.action}>{proposal.action_type}</span>
                </div>
              </div>

              <div className={styles.right}>
                <div className={styles.timeRemaining}>{formatTimeRemaining(proposal.expires_at)}</div>
                <div className={styles.riskScore}>
                  <div className={styles.scoreBar}>
                    {/* CSS variable used for dynamic risk score width */}
                    {/* eslint-disable-next-line react/style-prop-object */}
                    <div
                      className={`${styles.scoreProgress} risk-${proposal.risk_category}`}
                      style={{
                        '--score-width': `${proposal.risk_score}%`,
                      } as React.CSSProperties}
                    ></div>
                  </div>
                  <span>{proposal.risk_score}/100</span>
                </div>
              </div>
            </div>

            {expandedId === proposal.id && (
              <div className={styles.proposalDetails}>
                <div className={styles.detailsSection}>
                  <h4>Action Details</h4>
                  <pre className={styles.jsonDisplay}>
                    {JSON.stringify(proposal.proposed_args, null, 2)}
                  </pre>
                </div>

                <div className={styles.detailsSection}>
                  <h4>Review & Decision</h4>

                  <div className={styles.reasonInput}>
                    <label>Approval Reason (min 10 chars)</label>
                    <textarea
                      value={approvalReason}
                      onChange={(e) => setApprovalReason(e.target.value)}
                      placeholder="Why is this safe to execute?"
                      disabled={loading}
                    />
                    <button
                      className={`${styles.btn} ${styles.btnApprove}`}
                      onClick={() => handleApprove(proposal.id)}
                      disabled={loading || approvalReason.length < 10}
                    >
                      {loading ? '⏳ Processing...' : '✅ Approve'}
                    </button>
                  </div>

                  <div className={styles.reasonInput}>
                    <label>Rejection Reason (min 10 chars)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Why should this be rejected?"
                      disabled={loading}
                    />
                    <button
                      className={`${styles.btn} ${styles.btnReject}`}
                      onClick={() => handleReject(proposal.id)}
                      disabled={loading || rejectionReason.length < 10}
                    >
                      {loading ? '⏳ Processing...' : '❌ Reject'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProposalQueueCard;
