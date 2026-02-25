import React, { useState } from 'react';
import { UserProfile } from '../useSettings';
import { SettingsCard } from '../components/SettingsCard';
import styles from '../Settings.module.css';

interface ProfileSettingsProps {
  profile: UserProfile;
  onUpdate: (profile: Partial<UserProfile>) => void;
  isSaving?: boolean;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ profile, onUpdate, isSaving = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(profile);

  const handleChange = (field: keyof UserProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSave = () => {
    onUpdate(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(profile);
    setIsEditing(false);
  };

  return (
    <div className={styles.settingsSection}>
      <h2 className={styles.sectionTitle}>Profile Information</h2>

      <SettingsCard
        title="Avatar"
        description="Your profile picture"
        icon="🖼️"
        action={
          isEditing ? (
            <input
              type="url"
              value={formData.avatar || ''}
              onChange={handleChange('avatar')}
              className={styles.input}
              placeholder="Image URL"
            />
          ) : null
        }
      >
        {!isEditing && formData.avatar && (
          <img src={formData.avatar} alt="Avatar" className={styles.avatarPreview} />
        )}
      </SettingsCard>

      <SettingsCard
        title="First Name"
        icon="📝"
        action={
          isEditing ? (
            <input
              type="text"
              value={formData.firstName}
              onChange={handleChange('firstName')}
              className={styles.input}
            />
          ) : (
            <span className={styles.valueText}>{formData.firstName}</span>
          )
        }
      />

      <SettingsCard
        title="Last Name"
        icon="📝"
        action={
          isEditing ? (
            <input
              type="text"
              value={formData.lastName}
              onChange={handleChange('lastName')}
              className={styles.input}
            />
          ) : (
            <span className={styles.valueText}>{formData.lastName}</span>
          )
        }
      />

      <SettingsCard
        title="Email"
        description="Your primary email address"
        icon="✉️"
        action={
          isEditing ? (
            <input
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              className={styles.input}
            />
          ) : (
            <span className={styles.valueText}>{formData.email}</span>
          )
        }
      />

      <SettingsCard
        title="Bio"
        icon="💬"
        action={
          isEditing ? (
            <textarea
              value={formData.bio || ''}
              onChange={handleChange('bio')}
              className={styles.textarea}
              rows={3}
              placeholder="Tell us about yourself"
            />
          ) : (
            <span className={styles.valueText}>{formData.bio || 'No bio yet'}</span>
          )
        }
      />

      <SettingsCard
        title="Timezone"
        icon="🌍"
        action={
          isEditing ? (
            <select value={formData.timezone} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })} className={styles.input}>
              <option>Africa/Nairobi</option>
              <option>Africa/Lagos</option>
              <option>Africa/Johannesburg</option>
              <option>Europe/London</option>
              <option>America/New_York</option>
              <option>Asia/Singapore</option>
            </select>
          ) : (
            <span className={styles.valueText}>{formData.timezone}</span>
          )
        }
      />

      <div className={styles.actionButtons}>
        {isEditing ? (
          <>
            <button onClick={handleCancel} className={styles.secondaryButton} disabled={isSaving}>
              Cancel
            </button>
            <button onClick={handleSave} className={styles.primaryButton} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        ) : (
          <button onClick={() => setIsEditing(true)} className={styles.primaryButton}>
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
};
