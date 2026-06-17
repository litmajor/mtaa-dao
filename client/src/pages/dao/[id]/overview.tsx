import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, DollarSign, TrendingUp, Settings } from 'lucide-react';
import { apiGet } from '@/lib/api';

export default function DaoOverviewPage() {
  const { id: daoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  if (!daoId) {
    return <div className="p-4">Invalid DAO ID</div>;
  }

  const { data: dao, isLoading, error } = useQuery({
    queryKey: [`/api/v1/daos/${daoId}`],
    queryFn: () => apiGet(`/api/v1/daos/${daoId}`),
  });

  const { data: stats } = useQuery({
    queryKey: [`/api/v1/daos/${daoId}/dashboard-stats`],
    queryFn: () => apiGet(`/api/v1/daos/${daoId}/dashboard-stats`),
  });

  if (isLoading) return <div className="p-4">Loading DAO...</div>;
  if (error || !dao) return <div className="p-4 text-red-600">Error loading DAO</div>;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Navigate when tab is clicked
    if (value !== 'overview') {
      navigate(`/dao/${daoId}/${value}`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{dao.name || 'DAO'}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{dao.description || 'A decentralized autonomous organization'}</p>
        </div>
        <Button 
          onClick={() => navigate(`/dao/${daoId}/settings`)}
          className="gap-2"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-8 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="chat" className="text-xs sm:text-sm gap-1">
            💬
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs sm:text-sm gap-1">
            <Users className="w-3 h-3" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="governance" className="text-xs sm:text-sm">Governance</TabsTrigger>
          <TabsTrigger value="treasury" className="text-xs sm:text-sm gap-1">
            <DollarSign className="w-3 h-3" />
            <span className="hidden sm:inline">Treasury</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="text-xs sm:text-sm">Billing</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm gap-1">
            <Settings className="w-3 h-3" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab Content */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dao.memberCount || 0}</div>
                <p className="text-xs text-gray-500 mt-1">Active members</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  Treasury
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">${(dao.treasuryBalance || 0).toFixed(2)}</div>
                <p className="text-xs text-gray-500 mt-1">Total balance</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dao.status || 'Active'}</div>
                <p className="text-xs text-gray-500 mt-1">DAO status</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>About This DAO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">Description</h3>
                <p className="text-gray-600 dark:text-gray-400">{dao.description || 'No description provided'}</p>
              </div>
              {dao.recentActivity && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Recent Activity</h3>
                  <p className="text-gray-600 dark:text-gray-400">{dao.recentActivity}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
