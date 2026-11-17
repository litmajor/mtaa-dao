import React, { useState } from 'react';
import styles from './ProposalVoting.module.css';

interface ImpactChange {
  metric: string;
  current: string;
  proposed: string;
  change: string;
}

interface Impact {
  summary: string;
  changes: ImpactChange[];
  risks: string[];
  benefits: string[];
}

interface ProposalImpactCardProps {
  title: string;
  impactIfYes: Impact;
  impactIfNo: Impact;
  onVote: (vote: 'yes' | 'no') => void;
  onCancel: () => void;
}

export const ProposalImpactCard: React.FC<ProposalImpactCardProps> = ({
  title,
  impactIfYes,
  impactIfNo,
  onVote,
  onCancel
}) => {
  const [selectedVote, setSelectedVote] = useState<'yes' | 'no'>('yes');

  const impact = selectedVote === 'yes' ? impactIfYes : impactIfNo;

  return (
    <div className={styles.impactModal}>
      <div className={styles.impactHeader}>
        <h2>{title}</h2>
        <button className={styles.closeButton} onClick={onCancel}>
          ✕
        </button>
      </div>

      <div className={styles.voteTabs}>
        <button
          className={`${styles.tab} ${selectedVote === 'yes' ? styles.activeTab : ''}`}
          onClick={() => setSelectedVote('yes')}
        >
          If YES passes
        </button>
        <button
          className={`${styles.tab} ${selectedVote === 'no' ? styles.activeTab : ''}`}
          onClick={() => setSelectedVote('no')}
        >
          If NO passes
        </button>
      </div>

      <div className={styles.impactContent}>
        <div className={styles.summary}>
          <h3>What changes</h3>
          <p>{impact.summary}</p>
        </div>

        <div className={styles.changes}>
          <h3>Details</h3>
          {impact.changes.map((change, idx) => (
            <div key={idx} className={styles.changeRow}>
              <div>
                <strong>{change.metric}</strong>
                <small>Current: {change.current}</small>
              </div>
              <div>
                <strong>→ {change.proposed}</strong>
                <small className={styles.changeAmount}>{change.change}</small>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.benefits}>
          <h3>✓ Benefits</h3>
          <ul>
            {impact.benefits.map((benefit, idx) => (
              <li key={idx}>{benefit}</li>
            ))}
          </ul>
        </div>

        <div className={styles.risks}>
          <h3>⚠️ Risks</h3>
          <ul>
            {impact.risks.map((risk, idx) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.impactActions}>
        <button
          className={styles.buttonSecondary}
          onClick={onCancel}
        >
          Back
        </button>
        <button
          className={selectedVote === 'yes' ? styles.buttonYes : styles.buttonNo}
          onClick={() => onVote(selectedVote)}
        >
          {selectedVote === 'yes' ? 'Vote Yes' : 'Vote No'}
        </button>
      </div>
    </div>
  );
};
