import React, { Suspense, lazy } from "react";
import { Helmet } from "react-helmet-async";
import { PageLoading } from "../components/ui/page-loading";

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

// Lazy load unified Settings component from frontend
const UnifiedSettings = lazy(() =>
  import("../../frontend/components/Settings/Settings").then((m) => ({
    default: m.Settings,
  }))
);

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

      <Suspense fallback={<PageLoading message="Loading your settings..." />}>
        <UnifiedSettings />
      </Suspense>
    </>
  );
}
