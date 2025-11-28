/**
 * Analytics Dashboard Page
 * 
 * Main dashboard integrating Vault Analytics, Contribution Analytics, and Leaderboard
 * with real-time metric updates via WebSocket/polling
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  BarChart3,
  Users,
  Trophy,
  AlertTriangle,
  Clock,
} from 'lucide-react';

import { VaultAnalyticsTab } from '@/components/analytics/VaultAnalyticsTab';
import { ContributionAnalyticsTab } from '@/components/analytics/ContributionAnalyticsTab';
import { RealtimeMetricsProvider } from '@/components/analytics/RealtimeMetricsProvider';
import { DashboardLayout } from '@/components/layouts';
import { Logger } from '@/utils/logger';

const logger = new Logger('AnalyticsDashboard');

// ============================================================================
// TYPES
// ============================================================================

interface DaoInfo {
  id: string;
  name: string;
  description?: string;
  member: {
    status: 'active' | 'inactive' | 'pending';
    tier: 'founder' | 'elder' | 'champion' | 'contributor' | 'participant';
    joinDate: string;
  };
}

interface VaultInfo {
  id: string;
  name: string;
  address: string;
  balance: number;
  apy: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AnalyticsDashboardContent: React.FC<{
  daoId: string;
  daoInfo?: DaoInfo;
  vaultId?: string;
  vaultInfo?: VaultInfo;
}> = ({ daoId, daoInfo, vaultId, vaultInfo }) => {
  const [selectedTab, setSelectedTab] = useState('vault');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('90d');
  const navigate = useNavigate();

  // Fetch DAO info if not provided
  const { data: fetchedDaoInfo, isLoading: daoLoading } = useQuery({
    queryKey: ['dao', daoId],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${process.env.VITE_API_URL}/dao/${daoId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch DAO info');
      return response.json();
    },
    enabled: !!daoId && !daoInfo,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch vault info if not provided
  const { data: fetchedVaultInfo, isLoading: vaultLoading } = useQuery({
    queryKey: ['vault', vaultId],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${process.env.VITE_API_URL}/vault/${vaultId}/info`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch vault info');
      return response.json();
    },
    enabled: !!vaultId && !vaultInfo,
    staleTime: 5 * 60 * 1000,
  });

  const dao = daoInfo || fetchedDaoInfo;
  const vault = vaultInfo || fetchedVaultInfo;

  const tierColors = {
    founder: 'bg-yellow-100 text-yellow-800',
    elder: 'bg-purple-100 text-purple-800',
    champion: 'bg-orange-100 text-orange-800',
    contributor: 'bg-blue-100 text-blue-800',
    participant: 'bg-gray-100 text-gray-800',
  };

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <DashboardLayout
      title="Analytics Dashboard"
      subtitle={dao?.name ? `${dao.name} DAO Analytics` : 'Real-time metrics and performance tracking'}
      columns={1}
      headerAction={
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      }
    >
      {/* DAO Header Section */}
      {dao && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{dao.name}</h3>
                {dao.description && (
                  <p className="text-sm text-gray-600 mt-1">{dao.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-600">Your Status</p>
                  <div className="flex gap-2 mt-1">
                    <Badge className={statusColors[dao.member.status]}>
                      {dao.member.status.charAt(0).toUpperCase() + dao.member.status.slice(1)}
                    </Badge>
                    <Badge className={tierColors[dao.member.tier]}>
                      {dao.member.tier.charAt(0).toUpperCase() + dao.member.tier.slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading States */}
      {(daoLoading || vaultLoading) && (
        <div className="mb-6 text-center py-8">
          <div className="inline-flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4 animate-spin" />
            <span>Loading dashboard...</span>
          </div>
        </div>
      )}

      {/* Analytics Tabs */}
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="vault" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Vault Analytics</span>
            <span className="sm:hidden">Vault</span>
          </TabsTrigger>
          <TabsTrigger value="contributions" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Contributions</span>
            <span className="sm:hidden">Contribs</span>
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Leaderboard</span>
            <span className="sm:hidden">Rankings</span>
          </TabsTrigger>
        </TabsList>

        {/* Vault Analytics Tab */}
        <TabsContent value="vault" className="space-y-4">
          {!vaultId ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No vault selected. Please provide a vault ID to view analytics.
              </AlertDescription>
            </Alert>
          ) : (
            <VaultAnalyticsTab
              daoId={daoId}
              vaultId={vaultId}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
          )}
        </TabsContent>

        {/* Contribution Analytics Tab */}
        <TabsContent value="contributions" className="space-y-4">
          <ContributionAnalyticsTab
            daoId={daoId}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Member Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Leaderboard coming soon</p>
                <p className="text-sm text-gray-500 mt-2">
                  Member rankings and achievements will appear here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

// ============================================================================
// PAGE WRAPPER WITH PROVIDER
// ============================================================================

export default function AnalyticsDashboardPage() {
  const { daoId, vaultId } = useParams<{ daoId: string; vaultId?: string }>();

  if (!daoId) {
    return (
      <DashboardLayout title="Analytics" columns={1}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No DAO selected. Please navigate from a DAO page.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <RealtimeMetricsProvider
      apiBaseUrl={process.env.VITE_API_URL || 'http://localhost:3001/api'}
      webSocketUrl={process.env.VITE_WS_URL}
      enablePolling={true}
    >
      <AnalyticsDashboardContent
        daoId={daoId}
        vaultId={vaultId}
      />
    </RealtimeMetricsProvider>
  );
}
