/**
 * YUKI DASHBOARD PAGE - Unified Trading Interface
 * 
 * Dedicated page for the Yuki trading platform
 * Access point: /yuki-dashboard
 * 
 * Features:
 * - Real-time market data (CEX + DEX)
 * - Price comparison & arbitrage detection
 * - Strategy automation & marketplace
 * - Smart order routing
 * - WebSocket real-time updates
 */

import React, { Suspense, lazy } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageLoading } from '@/components/ui/page-loading';

const YukiDashboardLazy = lazy(() => import('@/components/trading/YukiDashboard'));

export default function YukiDashboardPage() {
  return (
    <>
      <Helmet>
        <title>Yuki Trading Dashboard | Mtaa DAO</title>
        <meta
          name="description"
          content="Advanced trading dashboard with CEX/DEX integration, smart routing, and strategy automation. Real-time market intelligence for active traders."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Suspense fallback={<PageLoading />}>
        <YukiDashboardLazy />
      </Suspense>
    </>
  );
}
