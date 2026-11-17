import React from 'react';
import styles from './SendFlow.module.css';

interface SendFlowReviewProps {
  recipient: string;
  recipientName?: string;
  amount: string;
  fee: string;
  total: string;
  estimatedTime: string;
  onConfirm: () => void;
  onEdit: () => void;
  isSubmitting?: boolean;
}

export const SendFlowReview: React.FC<SendFlowReviewProps> = ({
  recipient,
  recipientName,
  amount,
  fee,
  total,
  estimatedTime,
  onConfirm,
  onEdit,
  isSubmitting = false
}) => {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <div className={styles.reviewContainer}>
      <div className={styles.reviewHeader}>
        <h2>Confirm Transaction</h2>
        <p>Review the details below before confirming</p>
      </div>

      <div className={styles.reviewCard}>
        <div className={styles.reviewSection}>
          <h3>To</h3>
          <div className={styles.recipientBlock}>
            <div className={styles.recipientAvatar}>
              {recipientName ? recipientName.charAt(0).toUpperCase() : '📤'}
            </div>
            <div className={styles.recipientInfo}>
              {recipientName && (
                <strong className={styles.recipientName}>{recipientName}</strong>
              )}
              <code className={styles.recipientAddress}>{formatAddress(recipient)}</code>
            </div>
          </div>
        </div>

        <div className={styles.reviewDivider} />

        <div className={styles.reviewSection}>
          <h3>Amount</h3>
          <div className={styles.amountBlock}>
            <div className={styles.amountRow}>
              <span>You send</span>
              <strong>{amount} ETH</strong>
            </div>
            <div className={styles.amountRow}>
              <span>Network fee</span>
              <strong className={styles.feeAmount}>{fee} ETH</strong>
            </div>
            <div className={styles.amountDivider} />
            <div className={`${styles.amountRow} ${styles.totalRow}`}>
              <span>Total cost</span>
              <strong>{total} ETH</strong>
            </div>
          </div>
        </div>

        <div className={styles.reviewDivider} />

        <div className={styles.reviewSection}>
          <h3>Estimated Confirmation</h3>
          <div className={styles.timelinePreview}>
            <div className={styles.timelineStep}>
              <span className={styles.timelineIcon}>✓</span>
              <div>
                <strong>Confirmed</strong>
                <small>Your transaction is recorded</small>
              </div>
            </div>
            <div className={styles.timelineStep}>
              <span className={styles.timelineIcon}>→</span>
              <div>
                <strong>Broadcasting</strong>
                <small>Sent to the network</small>
              </div>
            </div>
            <div className={styles.timelineStep}>
              <span className={styles.timelineIcon}>✓</span>
              <div>
                <strong>Received</strong>
                <small>{estimatedTime}</small>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.reviewWarning}>
          <strong>⚠️ Important</strong>
          <p>
            This transaction cannot be undone. Please verify the recipient address is correct
            before confirming.
          </p>
        </div>
      </div>

      <div className={styles.reviewActions}>
        <button
          className={styles.buttonSecondary}
          onClick={onEdit}
          disabled={isSubmitting}
        >
          ← Edit
        </button>
        <button
          className={styles.buttonPrimary}
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? '⏳ Sending...' : '✓ Confirm & Send'}
        </button>
      </div>
    </div>
  );
};
