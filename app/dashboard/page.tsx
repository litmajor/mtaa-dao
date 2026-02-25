/**
 * /app/dashboard/page.tsx
 * Main trading dashboard page
 * URL: /dashboard
 */

import TradingDashboard from '@/client/components/trading/TradingDashboard';

export const metadata = {
  title: 'Trading Dashboard - MTAA Protocol',
  description: 'Real-time order and position management',
};

export default function DashboardPage() {
  return <TradingDashboard />;
}
