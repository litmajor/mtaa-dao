/**
 * /app/dashboard/settings/page.tsx
 * Settings page
 * URL: /dashboard/settings
 */

import SettingsDashboard from '@/client/components/settings/SettingsDashboard';

export const metadata = {
  title: 'Settings - MTAA Protocol',
  description: 'User preferences and configuration',
};

export default function SettingsPage() {
  return <SettingsDashboard />;
}
