import React from 'react';
import styles from './ProposalVoting.module.css';

interface Proposal {
  id: string;
  title: string;
  status: 'active' | 'passed' | 'failed' | 'archived';
  endDate: Date;
  quorumRequired: number;
  currentQuorum: number;
  yesVotes: number;
  noVotes: number;
}

interface ProposalCardProps {
  proposal: Proposal;
  userVoted?: 'yes' | 'no';
  onViewDetails: () => void;
  onVote: (vote: 'yes' | 'no') => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  userVoted,
  onViewDetails,
  onVote
}) => {
  const quorumPercentage = (proposal.currentQuorum / proposal.quorumRequired) * 100;
  const timeRemaining = Math.ceil(
    (proposal.endDate.getTime() - Date.now()) / (1000 * 60 * 60)
  );

  const getStatusColor = (status: Proposal['status']) => {
    switch (status) {
      case 'active':
        return styles.statusActive;
      case 'passed':
        return styles.statusPassed;
      case 'failed':
        return styles.statusFailed;
      default:
        return styles.statusArchived;
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>{proposal.title}</h3>
        <span className={`${styles.status} ${getStatusColor(proposal.status)}`}>
          {proposal.status.toUpperCase()}
        </span>
      </div>

      <div className={styles.quorumSection}>
        <div className={styles.quorumLabel}>
          <span>Quorum Progress</span>
          <span className={styles.quorumPercent}>
            {Math.round(quorumPercentage)}%
          </span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${Math.min(quorumPercentage, 100)}%` }}
          />
        </div>
        <div className={styles.quorumDetail}>
          {proposal.currentQuorum} of {proposal.quorumRequired} votes needed
        </div>
      </div>

      <div className={styles.voteBreakdown}>
        <div className={styles.voteItem}>
          <span className={styles.voteLabel}>Yes</span>
          <span className={styles.voteCount}>
            {proposal.yesVotes}
            {userVoted === 'yes' && <span className={styles.youBadge}>You</span>}
          </span>
        </div>
        <div className={styles.voteItem}>
          <span className={styles.voteLabel}>No</span>
          <span className={styles.voteCount}>
            {proposal.noVotes}
            {userVoted === 'no' && <span className={styles.youBadge}>You</span>}
          </span>
        </div>
      </div>

      <div className={styles.timeRemaining}>
        ⏱️ {timeRemaining} hours left to vote
      </div>

      {proposal.status === 'active' && !userVoted && (
        <div className={styles.actions}>
          <button
            className={styles.buttonYes}
            onClick={() => onVote('yes')}
          >
            Vote Yes
          </button>
          <button
            className={styles.buttonNo}
            onClick={() => onVote('no')}
          >
            Vote No
          </button>
        </div>
      )}

      <button
        className={styles.buttonText}
        onClick={onViewDetails}
      >
        View Details →
      </button>
    </div>
  );
};
