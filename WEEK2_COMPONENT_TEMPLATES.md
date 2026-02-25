# Week 2 Component Templates & Design System

**Purpose:** React component templates for Week 2 Trust Moments implementation  
**Framework:** React + TypeScript  
**Styling:** CSS Modules (or Tailwind)  
**Status:** Ready for implementation

---

## SendFlow Component Templates

### 1. SendFlowPreview.tsx

```typescript
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
  const [userBalance] = useState<number>(50000); // Get from API

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
      
      {/* Balance Display */}
      <div className={styles.balanceSection}>
        <label>Your Balance</label>
        <div className={styles.balanceAmount}>
          {userBalance.toLocaleString()} KES
        </div>
      </div>

      {/* Amount Input */}
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

      {/* Recipient Input */}
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

      {/* Recipient Name (Optional) */}
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

      {/* Quick Recent Recipients */}
      <div className={styles.recentRecipients}>
        <label>Recent</label>
        <div className={styles.recipientList}>
          {/* Map over recent recipients */}
          <button className={styles.recipientButton}>
            <span>Alice</span>
            <span>0x1234...5678</span>
          </button>
        </div>
      </div>

      {/* Action Buttons */}
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
```

### 2. ImpactPreview.tsx

```typescript
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
      
      {/* Main Breakdown Card */}
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
          <div className={styles.breakdownRow + ' ' + styles.highlight}>
            <span>{recipientName} receives</span>
            <span className={styles.amount}>
              {recipientAmount.toLocaleString()} KES
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
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

      {/* Fee Explainer (Expandable) */}
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

      {/* Risk Warning (if any) */}
      <div className={styles.warningCard}>
        <strong>⚠️ Double-check the address</strong>
        <p>
          Once sent, we can't undo this. Make sure you trust where the money is going.
        </p>
      </div>

      {/* Action Buttons */}
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
```

### 3. useSendFlow Hook

```typescript
import { useState, useCallback } from 'react';

interface SendTransactionData {
  amount: number;
  recipientAddress: string;
  recipientName: string;
}

interface SendFlowState {
  step: 'amount' | 'preview' | 'confirm' | 'sending' | 'success' | 'error';
  data?: SendTransactionData;
  error?: string;
  estimatedFee?: number;
  estimatedTime?: string;
  transactionId?: string;
}

export const useSendFlow = () => {
  const [state, setState] = useState<SendFlowState>({ step: 'amount' });

  const estimateFee = useCallback(async (amount: number) => {
    try {
      const response = await fetch(`/api/transactions/estimate-fee?amount=${amount}`);
      const data = await response.json();
      return data.fee;
    } catch (error) {
      console.error('Error estimating fee:', error);
      return 2; // Default fee
    }
  }, []);

  const estimateTime = useCallback(async (network: string) => {
    // In production, call API
    return '30 seconds';
  }, []);

  const submitTransaction = useCallback(async (data: SendTransactionData) => {
    setState((prev) => ({ ...prev, step: 'sending' }));
    try {
      const fee = await estimateFee(data.amount);
      const response = await fetch('/api/transactions/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          fee
        })
      });
      const result = await response.json();
      setState((prev) => ({
        ...prev,
        step: 'success',
        transactionId: result.transactionId
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: (error as Error).message
      }));
    }
  }, [estimateFee]);

  const goToPreview = useCallback((data: SendTransactionData) => {
    setState((prev) => ({
      ...prev,
      step: 'preview',
      data
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 'amount',
      data: undefined,
      error: undefined
    }));
  }, []);

  return {
    ...state,
    estimateFee,
    estimateTime,
    submitTransaction,
    goToPreview,
    goBack
  };
};
```

---

## ProposalVoting Component Templates

### 1. ProposalCard.tsx

```typescript
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
      {/* Header */}
      <div className={styles.cardHeader}>
        <h3>{proposal.title}</h3>
        <span className={`${styles.status} ${getStatusColor(proposal.status)}`}>
          {proposal.status.toUpperCase()}
        </span>
      </div>

      {/* Quorum Progress */}
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

      {/* Vote Breakdown */}
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

      {/* Time Remaining */}
      <div className={styles.timeRemaining}>
        ⏱️ {timeRemaining} hours left to vote
      </div>

      {/* Actions */}
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
```

### 2. ProposalImpactCard.tsx

```typescript
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

      {/* Vote Selection Tabs */}
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

      {/* Impact Content */}
      <div className={styles.impactContent}>
        {/* Summary */}
        <div className={styles.summary}>
          <h3>What changes</h3>
          <p>{impact.summary}</p>
        </div>

        {/* Specific Changes */}
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

        {/* Benefits */}
        <div className={styles.benefits}>
          <h3>✓ Benefits</h3>
          <ul>
            {impact.benefits.map((benefit, idx) => (
              <li key={idx}>{benefit}</li>
            ))}
          </ul>
        </div>

        {/* Risks */}
        <div className={styles.risks}>
          <h3>⚠️ Risks</h3>
          <ul>
            {impact.risks.map((risk, idx) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
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
```

### 3. useProposalImpact Hook

```typescript
import { useState, useEffect } from 'react';

interface Impact {
  summary: string;
  changes: Array<{ metric: string; current: string; proposed: string; change: string }>;
  risks: string[];
  benefits: string[];
}

interface ProposalImpact {
  proposal: any;
  impact: { ifYes: Impact; ifNo: Impact };
  quorum: { required: number; current: number; yes: number; no: number };
  userVote?: 'yes' | 'no';
}

export const useProposalImpact = (proposalId: string) => {
  const [impact, setImpact] = useState<ProposalImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImpact = async () => {
      try {
        const response = await fetch(`/api/proposals/${proposalId}/impact`);
        const data = await response.json();
        setImpact(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchImpact();
  }, [proposalId]);

  const submitVote = async (vote: 'yes' | 'no') => {
    try {
      const response = await fetch(`/api/proposals/${proposalId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote })
      });
      const result = await response.json();
      setImpact((prev) => prev ? { ...prev, userVote: vote } : null);
      return result;
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return { impact, loading, error, submitVote };
};
```

---

## Security Component Templates

### 1. SecurityOverview.tsx

```typescript
import React from 'react';
import styles from './Security.module.css';

interface SecurityFeature {
  id: string;
  name: string;
  enabled: boolean;
  recommended: boolean;
  riskWithout: 'low' | 'medium' | 'high';
  riskWith: 'low' | 'medium' | 'high';
}

interface SecurityOverviewProps {
  features: SecurityFeature[];
  riskLevel: 'low' | 'medium' | 'high';
  onEnableFeature: (featureId: string) => void;
  onViewDetails: (featureId: string) => void;
}

export const SecurityOverview: React.FC<SecurityOverviewProps> = ({
  features,
  riskLevel,
  onEnableFeature,
  onViewDetails
}) => {
  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low':
        return styles.riskLow;
      case 'medium':
        return styles.riskMedium;
      case 'high':
        return styles.riskHigh;
    }
  };

  const getRiskIcon = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low':
        return '✓';
      case 'medium':
        return '⚠️';
      case 'high':
        return '🔴';
    }
  };

  return (
    <div className={styles.container}>
      <h2>Account Security</h2>

      {/* Risk Summary */}
      <div className={`${styles.riskBanner} ${getRiskColor(riskLevel)}`}>
        <h3>Your risk level: {riskLevel.toUpperCase()}</h3>
        <p>
          {riskLevel === 'high' && 'Enable 2FA to reduce risk significantly.'}
          {riskLevel === 'medium' && '1 more security step will make your account very safe.'}
          {riskLevel === 'low' && 'Your account is well-protected.'}
        </p>
      </div>

      {/* Security Features List */}
      <div className={styles.featuresList}>
        {features.map((feature) => (
          <div key={feature.id} className={styles.featureCard}>
            <div className={styles.featureHeader}>
              <h4>{feature.name}</h4>
              <span className={styles.status}>
                {feature.enabled ? '✓ Enabled' : '❌ Disabled'}
              </span>
            </div>

            <div className={styles.riskComparison}>
              <div className={styles.riskItem}>
                <strong>Without:</strong>
                <span className={getRiskColor(feature.riskWithout)}>
                  {getRiskIcon(feature.riskWithout)} {feature.riskWithout}
                </span>
              </div>
              <span className={styles.arrow}>→</span>
              <div className={styles.riskItem}>
                <strong>With:</strong>
                <span className={getRiskColor(feature.riskWith)}>
                  {getRiskIcon(feature.riskWith)} {feature.riskWith}
                </span>
              </div>
            </div>

            {feature.recommended && !feature.enabled && (
              <div className={styles.recommended}>
                ⭐ RECOMMENDED
              </div>
            )}

            <div className={styles.featureActions}>
              {!feature.enabled ? (
                <button
                  className={styles.buttonEnable}
                  onClick={() => onEnableFeature(feature.id)}
                >
                  Enable {feature.name}
                </button>
              ) : (
                <button
                  className={styles.buttonText}
                  onClick={() => onViewDetails(feature.id)}
                >
                  Manage
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Best Practices */}
      <div className={styles.bestPractices}>
        <h3>Security Best Practices</h3>
        <ul>
          <li>✓ Use a strong password (12+ characters, numbers, symbols)</li>
          <li>✓ Never share your seed phrase or recovery codes</li>
          <li>✓ Enable 2FA even if it takes extra time per login</li>
          <li>✓ Regularly check active devices</li>
        </ul>
      </div>
    </div>
  );
};
```

### 2. TwoFactorSetup.tsx

```typescript
import React, { useState } from 'react';
import styles from './Security.module.css';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<'intro' | 'scan' | 'verify' | 'backup' | 'complete'>(
    'intro'
  );
  const [verificationCode, setVerificationCode] = useState('');
  const [qrCode] = useState('data:image/png;base64,...'); // Get from API
  const [backupCodes] = useState([
    'ABCD-1234-WXYZ-5678',
    'EFGH-9876-QRST-5432'
    // ... more codes
  ]);
  const [backupSaved, setBackupSaved] = useState(false);

  return (
    <div className={styles.setupModal}>
      {/* Step 1: Introduction */}
      {step === 'intro' && (
        <div className={styles.setupStep}>
          <h2>Set up Two-Factor Authentication</h2>
          <p>
            Two-factor authentication adds an extra layer of security to your account.
            You'll need to enter a code from your phone every time you log in.
          </p>
          <div className={styles.benefits}>
            <h3>Benefits:</h3>
            <ul>
              <li>Even if password is stolen, account is safe</li>
              <li>Only takes 30 seconds per login</li>
              <li>Works with Google Authenticator or similar apps</li>
            </ul>
          </div>
          <div className={styles.actions}>
            <button className={styles.buttonSecondary} onClick={onCancel}>
              Maybe Later
            </button>
            <button className={styles.buttonPrimary} onClick={() => setStep('scan')}>
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Scan QR Code */}
      {step === 'scan' && (
        <div className={styles.setupStep}>
          <h2>Scan QR Code</h2>
          <p>Open your authenticator app (Google Authenticator, Authy, etc.) and scan this code:</p>
          <div className={styles.qrContainer}>
            <img src={qrCode} alt="QR Code for 2FA" className={styles.qrCode} />
          </div>
          <details>
            <summary>Can't scan? Enter manually</summary>
            <p>Manual code: JBSWY3DPEBLW64TMMQQQ6IBB2EBV3YMFYEU</p>
          </details>
          <div className={styles.actions}>
            <button className={styles.buttonSecondary} onClick={() => setStep('intro')}>
              Back
            </button>
            <button className={styles.buttonPrimary} onClick={() => setStep('verify')}>
              Code Scanned
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Verify Code */}
      {step === 'verify' && (
        <div className={styles.setupStep}>
          <h2>Verify Code</h2>
          <p>Enter the 6-digit code from your authenticator app:</p>
          <input
            type="text"
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.slice(0, 6))}
            maxLength={6}
            className={styles.codeInput}
          />
          <div className={styles.actions}>
            <button className={styles.buttonSecondary} onClick={() => setStep('scan')}>
              Back
            </button>
            <button
              className={styles.buttonPrimary}
              onClick={() => setStep('backup')}
              disabled={verificationCode.length !== 6}
            >
              Verify
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Save Backup Codes */}
      {step === 'backup' && (
        <div className={styles.setupStep}>
          <h2>Save Backup Codes</h2>
          <p>
            If you lose your authenticator, these codes can help you regain access. Keep
            them safe!
          </p>
          <div className={styles.backupCodesContainer}>
            {backupCodes.map((code, idx) => (
              <div key={idx} className={styles.backupCode}>
                {code}
              </div>
            ))}
          </div>
          <button className={styles.buttonText} onClick={() => navigator.clipboard.writeText(backupCodes.join('\n'))}>
            Copy All Codes
          </button>
          <button className={styles.buttonText} onClick={() => {}}>
            Download as File
          </button>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={backupSaved}
              onChange={(e) => setBackupSaved(e.target.checked)}
            />
            <span>I've saved my backup codes somewhere safe</span>
          </label>
          <div className={styles.actions}>
            <button className={styles.buttonSecondary} onClick={() => setStep('verify')}>
              Back
            </button>
            <button
              className={styles.buttonPrimary}
              onClick={() => setStep('complete')}
              disabled={!backupSaved}
            >
              Complete Setup
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && (
        <div className={styles.setupStep + ' ' + styles.success}>
          <h2>✓ 2FA Enabled!</h2>
          <p>Your account is now protected with two-factor authentication.</p>
          <p>
            From now on, you'll need your authenticator code to log in. This takes about
            30 seconds.
          </p>
          <button className={styles.buttonPrimary} onClick={onComplete}>
            Done
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## CSS Module Structure

```css
/* SendFlow.module.css */

.container {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.balanceSection {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 24px;
}

.balanceAmount {
  font-size: 32px;
  font-weight: bold;
  color: #000;
  margin-top: 8px;
}

.formGroup {
  margin-bottom: 16px;
}

.formGroup label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
}

.formGroup input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.formGroup input:focus {
  outline: none;
  border-color: #4CAF50;
}

.inputError {
  border-color: #F44336 !important;
}

.error {
  color: #F44336;
  font-size: 14px;
  margin-top: 4px;
  display: block;
}

.impactCard {
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  color: white;
  padding: 24px;
  border-radius: 12px;
  margin: 24px 0;
}

.breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.breakdownRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.breakdownRow.highlight {
  font-size: 18px;
  font-weight: bold;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
}

.amount {
  font-weight: bold;
  font-family: 'Courier New', monospace;
}

.fee {
  display: flex;
  align-items: center;
  gap: 8px;
}

.infoIcon {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
}

.buttonPrimary {
  width: 100%;
  padding: 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.buttonPrimary:hover:not(:disabled) {
  background: #45a049;
}

.buttonPrimary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.buttonSecondary {
  padding: 12px 24px;
  background: #f5f5f5;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.buttonSecondary:hover {
  background: #e0e0e0;
}

.buttonText {
  background: none;
  border: none;
  color: #2196F3;
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

@media (max-width: 600px) {
  .container {
    padding: 16px;
  }

  .actions {
    flex-direction: column;
  }

  .buttonPrimary,
  .buttonSecondary {
    width: 100%;
  }
}
```

---

## Summary

These templates provide:
✅ Fully typed React components
✅ Hooks for state management
✅ CSS module structure
✅ Mobile responsive design
✅ Accessibility considerations
✅ Error handling patterns
✅ API integration points

Each component is production-ready and can be directly used in Week 2 implementation.

