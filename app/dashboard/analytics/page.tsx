/**
 * /app/dashboard/analytics/page.tsx
 * Analytics dashboard page
 * URL: /dashboard/analytics
 */

import AnalyticsDashboard from '@/client/components/analytics/AnalyticsDashboard';

export const metadata = {
  title: 'Analytics Dashboard - MTAA Protocol',
  description: 'Trading performance and risk analysis',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
