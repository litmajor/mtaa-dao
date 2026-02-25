import React from 'react';
import styles from './SendFlow.module.css';

interface ImpactPreviewProps {
  amount: number;
  recipientName: string;
  estimatedFee: number;
  estimatedTime: string;
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

export const ImpactPreview: React.FC<ImpactPreviewProps> = ({
  amount,
  recipientName,
  estimatedFee,
  estimatedTime,
  onConfirm,
  onEdit,
  onCancel
}) => {
  const recipientAmount = amount - estimatedFee;
  const feePercentage = ((estimatedFee / amount) * 100).toFixed(1);

  return (
    <div className={styles.container}>
      <h2>Review Transaction</h2>
      
      <div className={styles.impactCard}>
        <div className={styles.breakdown}>
          <div className={styles.breakdownRow}>
            <span>You send</span>
            <span className={styles.amount}>{amount.toLocaleString()} KES</span>
          </div>
          <div className={styles.breakdownRow}>
            <span>Network fee</span>
            <span className={styles.fee}>
              {estimatedFee} KES ({feePercentage}%)
              <button className={styles.infoIcon} title="How is this calculated?">
                ?
              </button>
            </span>
          </div>
          <div className={styles.divider} />
          <div className={`${styles.breakdownRow} ${styles.highlight}`}>
            <span>{recipientName} receives</span>
            <span className={styles.amount}>
              {recipientAmount.toLocaleString()} KES
            </span>
          </div>
        </div>
      </div>

      <div className={styles.timelineSection}>
        <h3>Timeline</h3>
        <div className={styles.timeline}>
          <div className={styles.timelineStep}>
            <div className={styles.timelineMarker}>✓</div>
            <div className={styles.timelineContent}>
              <strong>Confirmed</strong>
              <small>Your wallet confirmed the transaction</small>
            </div>
          </div>
          <div className={styles.timelineConnector} />
          <div className={styles.timelineStep}>
            <div className={styles.timelineMarker}>→</div>
            <div className={styles.timelineContent}>
              <strong>Broadcasting</strong>
              <small>~{estimatedTime}</small>
            </div>
          </div>
          <div className={styles.timelineConnector} />
          <div className={styles.timelineStep}>
            <div className={styles.timelineMarker}>✓</div>
            <div className={styles.timelineContent}>
              <strong>Received</strong>
              <small>Money arrives in {recipientName}'s wallet</small>
            </div>
          </div>
        </div>
      </div>

      <details className={styles.details}>
        <summary>What's the network fee?</summary>
        <p>
          The network fee (2 KES) pays miners to process your transaction.
          It's not kept by us—it goes to the blockchain network.
        </p>
        <p>
          We use standard fees. You can choose faster (higher fee) or slower
          (lower fee) if you want, but standard is best for most transactions.
        </p>
      </details>

      <div className={styles.warningCard}>
        <strong>⚠️ Double-check the address</strong>
        <p>
          Once sent, we can't undo this. Make sure you trust where the money is going.
        </p>
      </div>

      <div className={styles.actions}>
        <button className={styles.buttonSecondary} onClick={onEdit}>
          Edit Details
        </button>
        <button className={styles.buttonPrimary} onClick={onConfirm}>
          Send {amount.toLocaleString()} KES
        </button>
      </div>
      
      <button className={styles.buttonText} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
};
