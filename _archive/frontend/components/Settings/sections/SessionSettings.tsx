import React, { useState } from 'react';
import { ActiveSession } from '../useSettings';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsContextModal, SettingsModalConfig } from '../components/SettingsContextModal';
import styles from '../Settings.module.css';

interface SessionSettingsProps {
  sessions: ActiveSession[];
  onSignOutSession: (sessionId: string) => void;
  isSaving?: boolean;
}

export const SessionSettings: React.FC<SessionSettingsProps> = ({ sessions, onSignOutSession, isSaving = false }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    sessionId: string | null;
  }>({ isOpen: false, sessionId: null });

  const selectedSession = sessions.find((s) => s.id === modalState.sessionId);

  const sessionSignOutConfig: SettingsModalConfig = {
    title: `Sign Out Session?`,
    whatsAtRisk: `This session will be ended immediately. If someone else is using this session, they'll be signed out.`,
    whyHelps: 'Signing out unknown sessions prevents unauthorized access to your account.',
    whatsTheCost: 'You may need to sign in again to continue using that device.',
    icon: '🚪',
    actionLabel: 'Sign Out Session',
    isDangerous: true,
  };

  const handleSignOutClick = (sessionId: string) => {
    setModalState({ isOpen: true, sessionId });
  };

  const handleConfirm = async () => {
    if (!modalState.sessionId) return;
    await new Promise((resolve) => setTimeout(resolve, 600));
    onSignOutSession(modalState.sessionId);
    setModalState({ isOpen: false, sessionId: null });
  };

  const handleCancel = () => {
    setModalState({ isOpen: false, sessionId: null });
  };

  return (
    <div className={styles.settingsSection}>
      <h2 className={styles.sectionTitle}>Active Sessions</h2>
      <p className={styles.sectionDescription}>
        Sessions where you're signed in. Sign out any you don't recognize or no longer need.
      </p>

      {sessions.map((session) => (
        <SettingsCard
          key={session.id}
          title={session.device}
          description={`${session.location} • ${session.ipAddress}`}
          icon="🔐"
          action={
            <button
              onClick={() => handleSignOutClick(session.id)}
              className={styles.dangerButton}
              disabled={isSaving}
            >
              Sign Out
            </button>
          }
        >
          <div className={styles.sessionDetails}>
            <p>
              <strong>Last activity:</strong> {session.lastActivity}
            </p>
            <p>
              <strong>Signed in:</strong> {session.createdAt}
            </p>
          </div>
        </SettingsCard>
      ))}

      {selectedSession && (
        <SettingsContextModal
          isOpen={modalState.isOpen}
          config={sessionSignOutConfig}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isSubmitting={isSaving}
        />
      )}
    </div>
  );
};
