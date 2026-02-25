import React, { useState } from 'react';
import { ConnectedDevice } from '../useSettings';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsContextModal, SettingsModalConfig } from '../components/SettingsContextModal';
import styles from '../Settings.module.css';

interface DeviceSettingsProps {
  devices: ConnectedDevice[];
  onRemoveDevice: (deviceId: string) => void;
  isSaving?: boolean;
}

const deviceTypeIcons: Record<string, string> = {
  mobile: '📱',
  desktop: '💻',
  tablet: '📱',
};

export const DeviceSettings: React.FC<DeviceSettingsProps> = ({ devices, onRemoveDevice, isSaving = false }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    deviceId: string | null;
  }>({ isOpen: false, deviceId: null });

  const selectedDevice = devices.find((d) => d.id === modalState.deviceId);

  const deviceRemovalConfig: SettingsModalConfig = {
    title: `Remove ${selectedDevice?.name || 'Device'}?`,
    whatsAtRisk: `This device will lose access to your account. If it's lost or stolen, they can't use it to access MTAA anymore.`,
    whyHelps: 'Removing devices you no longer use reduces security risks from old or compromised devices.',
    whatsTheCost: 'You'll need to sign in again on this device if you want to use it in the future.',
    icon: '🗑️',
    actionLabel: 'Remove Device',
    isDangerous: true,
  };

  const handleRemoveClick = (deviceId: string) => {
    setModalState({ isOpen: true, deviceId });
  };

  const handleConfirm = async () => {
    if (!modalState.deviceId) return;
    await new Promise((resolve) => setTimeout(resolve, 600));
    onRemoveDevice(modalState.deviceId);
    setModalState({ isOpen: false, deviceId: null });
  };

  const handleCancel = () => {
    setModalState({ isOpen: false, deviceId: null });
  };

  return (
    <div className={styles.settingsSection}>
      <h2 className={styles.sectionTitle}>Connected Devices</h2>
      <p className={styles.sectionDescription}>Devices that can access your account. Remove any you don't recognize.</p>

      {devices.map((device) => (
        <SettingsCard
          key={device.id}
          title={device.name}
          description={`${device.os} • ${device.ipAddress}`}
          icon={deviceTypeIcons[device.type]}
          variant={device.isCurrentDevice ? 'success' : 'default'}
          action={
            device.isCurrentDevice ? (
              <span className={styles.badge}>Current Device</span>
            ) : (
              <button
                onClick={() => handleRemoveClick(device.id)}
                className={styles.dangerButton}
                disabled={isSaving}
              >
                Remove
              </button>
            )
          }
        >
          <div className={styles.deviceDetails}>
            <p>
              <strong>Last active:</strong> {device.lastActive}
            </p>
            <p>
              <strong>Type:</strong> {device.type.charAt(0).toUpperCase() + device.type.slice(1)}
            </p>
          </div>
        </SettingsCard>
      ))}

      {selectedDevice && (
        <SettingsContextModal
          isOpen={modalState.isOpen}
          config={deviceRemovalConfig}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isSubmitting={isSaving}
        />
      )}
    </div>
  );
};
