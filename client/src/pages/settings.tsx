import React from "react";
import { Helmet } from "react-helmet-async";
import CanonicalSettingsPage from './SettingsPage';

/**
 * Settings Page - Phase 5
 * 
 * Uses the unified Settings component that consolidates:
 * ✅ Profile: Name, email, avatar, bio, timezone
 * ✅ Security: 2FA, PIN, key export, social recovery
 * ✅ Devices: Connected devices management
 * ✅ Sessions: Active sessions, sign-out
 * ✅ Preferences: Notifications, theme, language
 * 
 * Single source of truth for all account settings.
 */

export default function SettingsPage() {
  return (
    <>
      <Helmet>
        <title>Account Settings | MtaaDAO</title>
        <meta
          name="description"
          content="Manage your profile, security, devices, sessions, and preferences"
        />
        <meta name="og:title" content="Account Settings" />
      </Helmet>

      <CanonicalSettingsPage />
    </>
  );
}
