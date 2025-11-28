/**
 * Analytics Routes Configuration
 * 
 * Add these routes to your main app routing
 */

import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';

// Lazy load the analytics dashboard
const AnalyticsDashboard = lazy(() => import('@/pages/analytics-dashboard'));

// Loading fallback component
const AnalyticsLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Spinner />
  </div>
);

/**
 * Route Configuration for Analytics Dashboard
 * 
 * Add to your router setup:
 * 
 * {
 *   path: '/analytics/:daoId',
 *   element: (
 *     <Suspense fallback={<AnalyticsLoadingFallback />}>
 *       <AnalyticsDashboard />
 *     </Suspense>
 *   ),
 * },
 * {
 *   path: '/analytics/:daoId/vault/:vaultId',
 *   element: (
 *     <Suspense fallback={<AnalyticsLoadingFallback />}>
 *       <AnalyticsDashboard />
 *     </Suspense>
 *   ),
 * }
 */

export const analyticsRoutes = [
  {
    path: '/analytics/:daoId',
    element: (
      <Suspense fallback={<AnalyticsLoadingFallback />}>
        <AnalyticsDashboard />
      </Suspense>
    ),
    name: 'Analytics Dashboard',
  },
  {
    path: '/analytics/:daoId/vault/:vaultId',
    element: (
      <Suspense fallback={<AnalyticsLoadingFallback />}>
        <AnalyticsDashboard />
      </Suspense>
    ),
    name: 'Vault Analytics',
  },
];

export default AnalyticsDashboard;
