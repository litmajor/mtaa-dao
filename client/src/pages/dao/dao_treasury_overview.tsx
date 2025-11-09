
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  TrendingUp, 
  Vote, 
  Clock, 
  Target, 
  AlertCircle,
  CheckCircle,
  UserPlus,
  Wallet,
  Calendar,
  MessageCircle,
  ChevronRight
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DaoStats {
  totalMembers: number;
  newMembersThisWeek: number;
  activeProposals: number;
  treasuryBalance: string;
  fundingGoal: string;
  fundingProgress: number;
  planExpiresAt: string | null;
  daysLeft: number;
  status: 'active' | 'expiring' | 'expired';
}

export default function DaoDashboard() {
  const { daoId } = useParams();
  const { toast } = useToast();
  const [stats, setStats] = useState<DaoStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, [daoId]);

  const fetchDashboardStats = async () => {
    try {
      const data = await apiGet(`/api/daos/${daoId}/dashboard-stats`);
      setStats(data);
    } catch (error) {
      toast({
        title: "Error loading dashboard",
        description: "Failed to fetch DAO statistics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'expiring': return 'bg-yellow-500';
      case 'expired': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'expiring': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'expired': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="p-8 text-center text-gray-500">No data available</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">DAO Dashboard</h1>
        <Badge className={`${getStatusColor(stats.status)} text-white`}>
          {stats.status.toUpperCase()}
        </Badge>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Member Stats */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Members</CardTitle>
            <Users className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalMembers}</div>
            <div className="flex items-center mt-2 text-sm">
              <UserPlus className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">+{stats.newMembersThisWeek}</span>
              <span className="text-gray-500 ml-1">this week</span>
            </div>
          </CardContent>
        </Card>

        {/* Funding Progress */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Funding Progress</CardTitle>
            <Target className="w-5 h-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₭{stats.treasuryBalance}</div>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Goal: ₭{stats.fundingGoal}</span>
                <span className="font-medium">{stats.fundingProgress}%</span>
              </div>
              <Progress value={stats.fundingProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Voting Activity */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Voting Activity</CardTitle>
            <Vote className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeProposals}</div>
            <p className="text-sm text-gray-500 mt-2">active proposals</p>
            <Button variant="link" className="p-0 mt-2 text-orange-500 hover:text-orange-600">
              View all <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Expiry Countdown */}
        <Card className={`hover:shadow-lg transition-shadow border-l-4 ${
          stats.status === 'active' ? 'border-green-500' :
          stats.status === 'expiring' ? 'border-yellow-500' : 'border-red-500'
        }`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Plan Status</CardTitle>
            {getStatusIcon(stats.status)}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.daysLeft} days</div>
            <p className="text-sm text-gray-500 mt-2">
              {stats.status === 'expiring' ? 'Expiring soon — extend now' : 
               stats.status === 'expired' ? 'Plan expired — renew now' : 'remaining'}
            </p>
            {stats.status !== 'active' && (
              <Button className="w-full mt-3 bg-orange-500 hover:bg-orange-600">
                Extend Plan
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Add Funds
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Vote className="w-4 h-4" />
            Create Proposal
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Schedule Event
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Open Chat
          </Button>
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <UserPlus className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">3 new members joined</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <Vote className="w-5 h-5 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">New proposal: Budget allocation Q1</p>
                <p className="text-xs text-gray-500">5 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">₭500 added to treasury</p>
                <p className="text-xs text-gray-500">1 day ago</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
