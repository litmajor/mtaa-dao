import React from 'react';
import styles from './ProposalVoting.module.css';

interface RelatedProposal {
  id: string;
  title: string;
  status: 'passed' | 'failed' | 'pending';
}

interface ProposalContextProps {
  proposedBy: string;
  proposedByAddress: string;
  createdAt: string;
  discussionUrl?: string;
  description: string;
  relatedProposals: RelatedProposal[];
}

export const ProposalContext: React.FC<ProposalContextProps> = ({
  proposedBy,
  proposedByAddress,
  createdAt,
  discussionUrl,
  description,
  relatedProposals
}) => {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className={styles.contextContainer}>
      <div className={styles.proposer}>
        <h3>Proposed by</h3>
        <div className={styles.proposerInfo}>
          <div className={styles.avatar}>{proposedBy.charAt(0)}</div>
          <div>
            <strong>{proposedBy}</strong>
            <small>{formatAddress(proposedByAddress)}</small>
          </div>
        </div>
        <small className={styles.timestamp}>{formatDate(createdAt)}</small>
      </div>

      <div className={styles.description}>
        <h3>Background</h3>
        <p>{description}</p>
      </div>

      {discussionUrl && (
        <div className={styles.discussion}>
          <a href={discussionUrl} target="_blank" rel="noopener noreferrer" className={styles.discussionLink}>
            💬 Join discussion on forum
            <span>→</span>
          </a>
        </div>
      )}

      {relatedProposals.length > 0 && (
        <div className={styles.relatedProposals}>
          <h3>Related Proposals</h3>
          <div className={styles.relatedList}>
            {relatedProposals.map((proposal) => (
              <div key={proposal.id} className={styles.relatedItem}>
                <span className={`${styles.proposalStatus} ${styles[proposal.status]}`}>
                  {proposal.status === 'passed' && '✓'}
                  {proposal.status === 'failed' && '✕'}
                  {proposal.status === 'pending' && '○'}
                </span>
                <a href={`/proposals/${proposal.id}`}>{proposal.title}</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
