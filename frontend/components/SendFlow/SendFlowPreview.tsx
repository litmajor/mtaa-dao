import React, { useState } from 'react';
import styles from './SendFlow.module.css';

interface SendFlowPreviewProps {
  onNext: (data: SendFlowData) => void;
  onCancel: () => void;
}

interface SendFlowData {
  amount: number;
  recipientAddress: string;
  recipientName: string;
}

export const SendFlowPreview: React.FC<SendFlowPreviewProps> = ({ onNext, onCancel }) => {
  const [amount, setAmount] = useState<number>();
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userBalance] = useState<number>(50000);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!amount || amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (amount && amount > userBalance) {
      newErrors.amount = 'Insufficient balance';
    }
    if (!recipientAddress) {
      newErrors.recipient = 'Recipient address is required';
    }
    if (recipientAddress.length < 34 || recipientAddress.length > 42) {
      newErrors.recipient = 'Invalid address format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext({
        amount: amount!,
        recipientAddress,
        recipientName
      });
    }
  };

  return (
    <div className={styles.container}>
      <h2>Send Money</h2>
      
      <div className={styles.balanceSection}>
        <label>Your Balance</label>
        <div className={styles.balanceAmount}>
          {userBalance.toLocaleString()} KES
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="amount">How much do you want to send?</label>
        <input
          id="amount"
          type="number"
          placeholder="0 KES"
          value={amount || ''}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          className={errors.amount ? styles.inputError : ''}
        />
        {errors.amount && <span className={styles.error}>{errors.amount}</span>}
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="recipient">Send to</label>
        <input
          id="recipient"
          type="text"
          placeholder="Wallet address or name"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          className={errors.recipient ? styles.inputError : ''}
        />
        <small>Paste address or scan QR code</small>
        {errors.recipient && <span className={styles.error}>{errors.recipient}</span>}
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="name">Recipient name (optional)</label>
        <input
          id="name"
          type="text"
          placeholder="e.g., Yuki's Wallet"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
        />
      </div>

      <div className={styles.actions}>
        <button
          className={styles.buttonSecondary}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className={styles.buttonPrimary}
          onClick={handleNext}
          disabled={!amount || !recipientAddress}
        >
          Review Transaction
        </button>
      </div>
    </div>
  );
};
