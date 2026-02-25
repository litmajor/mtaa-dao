import React, { useState } from 'react';
import styles from './Security.module.css';

type TwoFAStep = 'method' | 'download' | 'scan' | 'verify' | 'backup' | 'success';

interface TwoFactorSetupProps {
  onComplete: (backupCodes: string[]) => void;
  onCancel: () => void;
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({
  onComplete,
  onCancel
}) => {
  const [step, setStep] = useState<TwoFAStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<'authenticator' | 'sms' | null>(null);
  const [qrCode] = useState('iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6ZAAAABHNCSVQICAgIfAhkiAAAABl0RVh0U29mdHdhcmUAZ25vbWUtc2NyZWVuc2hvdO8Dvz4AAAQ7SURBVHic7d3RbQIxDADQVpwgbMC2ABuwBZsAW7ABW3ADnuBEwA08nAgcQLhcL4o1dvs+T7HPfd7tvu+/++//+9/+EQQQhCAEIQghCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEEIQhCCEIQgBCEIQQhCEIIQhCAEIQhBCEIQghCEIAQhCEH8A+2JXQ+WLw0dAAAAAElFTkSuQmCC');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes] = useState(['ABCD-1234', 'EFGH-5678', 'IJKL-9012', 'MNOP-3456', 'QRST-7890']);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleMethodSelect = (method: 'authenticator' | 'sms') => {
    setSelectedMethod(method);
    setStep('download');
  };

  const handleVerify = async () => {
    setLoading(true);
    // Simulate verification
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (verificationCode.length === 6) {
      setVerified(true);
      setStep('backup');
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onComplete(backupCodes);
  };

  return (
    <div className={styles.twoFAContainer}>
      <div className={styles.twoFAProgress}>
        {['method', 'download', 'scan', 'verify', 'backup', 'success'].map((s, idx) => (
          <div
            key={s}
            className={`${styles.progressStep} ${
              step === s ? styles.activeStep : ''
            } ${(step === 'success' || ['method', 'download', 'scan', 'verify', 'backup', 'success'].indexOf(step) > idx) ? styles.completedStep : ''}`}
          >
            {idx + 1}
          </div>
        ))}
      </div>

      {step === 'method' && (
        <div className={styles.twoFAStep}>
          <h2>Choose Authentication Method</h2>
          <p>Select how you'd like to authenticate your account.</p>

          <div className={styles.methodOptions}>
            <button
              className={styles.methodOption}
              onClick={() => handleMethodSelect('authenticator')}
            >
              <div className={styles.methodIcon}>📱</div>
              <h3>Authenticator App</h3>
              <p>Use apps like Google Authenticator or Authy</p>
              <small>Recommended</small>
            </button>

            <button
              className={styles.methodOption}
              onClick={() => handleMethodSelect('sms')}
            >
              <div className={styles.methodIcon}>💬</div>
              <h3>SMS Text Message</h3>
              <p>Receive codes via text to your phone</p>
            </button>
          </div>

          <div className={styles.twoFAActions}>
            <button className={styles.buttonSecondary} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'download' && selectedMethod && (
        <div className={styles.twoFAStep}>
          <h2>Step 1: Download Authenticator</h2>
          <p>Download an authenticator app to your phone:</p>

          <div className={styles.appOptions}>
            <a href="#" className={styles.appLink}>
              📲 Google Authenticator
            </a>
            <a href="#" className={styles.appLink}>
              📲 Microsoft Authenticator
            </a>
            <a href="#" className={styles.appLink}>
              📲 Authy
            </a>
          </div>

          <div className={styles.twoFAActions}>
            <button className={styles.buttonSecondary} onClick={onCancel}>
              Cancel
            </button>
            <button
              className={styles.buttonPrimary}
              onClick={() => setStep('scan')}
            >
              I've Downloaded the App
            </button>
          </div>
        </div>
      )}

      {step === 'scan' && (
        <div className={styles.twoFAStep}>
          <h2>Step 2: Scan QR Code</h2>
          <p>Open your authenticator app and scan this QR code:</p>

          <div className={styles.qrCode}>
            <img src={qrCode} alt="QR Code" />
          </div>

          <div className={styles.manualEntry}>
            <details>
              <summary>Can't scan? Enter manually</summary>
              <p className={styles.secretKey}>
                <code>JBSWY3DPEBLW64TMMQ======</code>
                <button className={styles.copyButton}>Copy</button>
              </p>
            </details>
          </div>

          <div className={styles.twoFAActions}>
            <button className={styles.buttonSecondary} onClick={() => setStep('download')}>
              Back
            </button>
            <button
              className={styles.buttonPrimary}
              onClick={() => setStep('verify')}
            >
              I've Scanned the Code
            </button>
          </div>
        </div>
      )}

      {step === 'verify' && (
        <div className={styles.twoFAStep}>
          <h2>Step 3: Verify Setup</h2>
          <p>Enter the 6-digit code from your authenticator app:</p>

          <div className={styles.verificationForm}>
            <input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className={styles.codeInput}
              disabled={loading}
            />
          </div>

          {verificationCode && !verified && (
            <div className={styles.verificationHint}>
              <small>⏳ Waiting for verification...</small>
            </div>
          )}

          <div className={styles.twoFAActions}>
            <button
              className={styles.buttonSecondary}
              onClick={() => setStep('scan')}
              disabled={loading}
            >
              Back
            </button>
            <button
              className={styles.buttonPrimary}
              onClick={handleVerify}
              disabled={verificationCode.length !== 6 || loading}
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        </div>
      )}

      {step === 'backup' && (
        <div className={styles.twoFAStep}>
          <h2>Step 4: Save Backup Codes</h2>
          <p>Save these backup codes in a safe place. Use them if you lose access to your authenticator app.</p>

          <div className={styles.backupCodesContainer}>
            {backupCodes.map((code, idx) => (
              <code key={idx} className={styles.backupCode}>
                {code}
              </code>
            ))}
          </div>

          <div className={styles.backupWarning}>
            <strong>⚠️ Important:</strong> Keep these codes safe. Anyone who has them can access your account.
          </div>

          <div className={styles.twoFAActions}>
            <button className={styles.buttonSecondary}>Download Codes</button>
            <button className={styles.buttonPrimary} onClick={handleComplete}>
              I've Saved the Codes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
