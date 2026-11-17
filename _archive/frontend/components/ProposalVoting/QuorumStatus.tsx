import React from 'react';
import styles from './ProposalVoting.module.css';

interface QuorumStatusProps {
  required: number;
  current: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  totalAddresses: number;
}

export const QuorumStatus: React.FC<QuorumStatusProps> = ({
  required,
  current,
  yesVotes,
  noVotes,
  abstainVotes,
  totalAddresses
}) => {
  const percentage = Math.round((current / required) * 100);
  const participationRate = Math.round(((yesVotes + noVotes + abstainVotes) / totalAddresses) * 100);
  const met = current >= required;

  return (
    <div className={styles.quorumContainer}>
      <div className={styles.quorumHeader}>
        <h3>Voting Status</h3>
        <span className={`${styles.quorumBadge} ${met ? styles.quorumMet : ''}`}>
          {met ? 'Quorum Met' : 'Quorum Required'}
        </span>
      </div>

      <div className={styles.quorumProgress}>
        <div className={styles.progressLabel}>
          <span>Progress toward quorum</span>
          <strong>{percentage}%</strong>
        </div>
        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${met ? styles.progressComplete : ''}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className={styles.progressDetail}>
          <small>{current} of {required} addresses voting</small>
        </div>
      </div>

      <div className={styles.voteBreakdown}>
        <h3>Vote Breakdown</h3>
        <div className={styles.voteChart}>
          <div className={styles.voteItem}>
            <div className={`${styles.voteBar} ${styles.voteYes}`}>
              <span className={styles.voteLabel}>{yesVotes}</span>
            </div>
            <small>For</small>
          </div>
          <div className={styles.voteItem}>
            <div className={`${styles.voteBar} ${styles.voteNo}`}>
              <span className={styles.voteLabel}>{noVotes}</span>
            </div>
            <small>Against</small>
          </div>
          <div className={styles.voteItem}>
            <div className={`${styles.voteBar} ${styles.voteAbstain}`}>
              <span className={styles.voteLabel}>{abstainVotes}</span>
            </div>
            <small>Abstain</small>
          </div>
        </div>
      </div>

      <div className={styles.participationRate}>
        <small>Participation: {participationRate}% of all addresses</small>
      </div>
    </div>
  );
};
