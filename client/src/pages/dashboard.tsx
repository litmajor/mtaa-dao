
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, DollarSign, TrendingUp, Award, Bell, Activity, Wallet, Vote, ChevronRight, Sparkles, Info } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PublicImpactFeed from '@/components/PublicImpactFeed';
import DaoOfTheWeekBanner from '@/components/DaoOfTheWeekBanner';

type DaoStats = { activeProposals: number; treasuryBalance: number; activeMembers: number; totalVotes: number; completedTasks: number; };
type Proposal = { id: string; title: string; description: string; category: string; author: string; votes: number; timeLeft: string; status: string; };
type Task = { id: string; title: string; reward: number; difficulty: string; timeLeft: string; category: string; };
type DaoInfo = { id: string; name: string; memberCount: number; role: string; };

export default function MtaaDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDaoId, setSelectedDaoId] = useState<string | null>(null);
  const [userDaos, setUserDaos] = useState<DaoInfo[]>([]);
  const [daoStats, setDaoStats] = useState<DaoStats | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  async function fetchUserDaos() {
    try {
      const daosData = await apiGet("/api/daos");
      const joinedDaos = daosData.filter((dao: any) => dao.isJoined);
      setUserDaos(joinedDaos.map((dao: any) => ({
        id: dao.id,
        name: dao.name,
        memberCount: dao.memberCount,
        role: dao.role
      })));

      if (joinedDaos.length > 0) {
        setSelectedDaoId(joinedDaos[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch user DAOs:', err);
    }
  }

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [stats, proposalsData, tasksData] = await Promise.all([
        apiGet(`/api/dashboard/stats${selectedDaoId ? `?daoId=${selectedDaoId}` : ''}`),
        apiGet(`/api/dashboard/proposals${selectedDaoId ? `?daoId=${selectedDaoId}` : ''}`),
        apiGet(`/api/dashboard/tasks${selectedDaoId ? `?daoId=${selectedDaoId}` : ''}`)
      ]);

      setDaoStats(stats);
      setProposals(proposalsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUserDaos();
  }, []);

  useEffect(() => {
    if (selectedDaoId || userDaos.length === 0) {
      fetchDashboardData();
    }
  }, [selectedDaoId]);

  // No DAOs - Onboarding view
  if (userDaos.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
          <Card className="border-2 border-orange-200 dark:border-orange-900 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-950/30 dark:to-pink-950/30">
            <CardHeader>
              <CardTitle className="text-3xl flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                <span className="text-gray-900 dark:text-white">Welcome to Mtaa DAO!</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg text-gray-700 dark:text-gray-300">
                Join a community or create your own DAO to get started with decentralized governance and community building.
              </p>
              <div className="flex gap-4">
                <Button 
                  onClick={() => navigate('/daos')} 
                  className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Browse DAOs
                </Button>
                <Button 
                  onClick={() => navigate('/create-dao')} 
                  variant="outline"
                  className="border-2 border-orange-600 dark:border-orange-400 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/50"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your DAO
                </Button>
              </div>
            </CardContent>
          </Card>

          <PublicImpactFeed />
          <DaoOfTheWeekBanner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header with DAO Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your DAO activities and contributions</p>
          </div>
          {userDaos.length > 1 && (
            <Select value={selectedDaoId || ''} onValueChange={setSelectedDaoId}>
              <SelectTrigger className="w-64 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                <SelectValue placeholder="Select DAO" />
              </SelectTrigger>
              <SelectContent>
                {userDaos.map(dao => (
                  <SelectItem key={dao.id} value={dao.id}>
                    {dao.name} ({dao.memberCount} members)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard 
            title="Active Proposals" 
            value={daoStats?.activeProposals || 0} 
            icon={<Vote className="w-5 h-5" />} 
            color="from-blue-500 to-cyan-500"
            tooltip="Number of proposals currently open for voting"
          />
          <StatCard 
            title="Treasury Balance" 
            value={formatCurrency(daoStats?.treasuryBalance || 0)} 
            icon={<DollarSign className="w-5 h-5" />} 
            color="from-green-500 to-emerald-500"
            tooltip="Total funds in the DAO treasury"
          />
          <StatCard 
            title="Active Members" 
            value={daoStats?.activeMembers || 0} 
            icon={<Users className="w-5 h-5" />} 
            color="from-purple-500 to-pink-500"
            tooltip="Members who voted or contributed in the last 30 days"
          />
          <StatCard 
            title="Total Votes Cast" 
            value={daoStats?.totalVotes || 0} 
            icon={<Activity className="w-5 h-5" />} 
            color="from-orange-500 to-red-500"
            tooltip="All-time votes cast in this DAO"
          />
          <StatCard 
            title="Tasks Completed" 
            value={daoStats?.completedTasks || 0} 
            icon={<Award className="w-5 h-5" />} 
            color="from-teal-500 to-green-500"
            tooltip="Community tasks finished this month"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Proposals */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-xl text-gray-900 dark:text-white">Active Proposals</CardTitle>
              <Button onClick={() => navigate('/proposals')} variant="outline" size="sm">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {proposals.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Vote className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active proposals</p>
                </div>
              ) : (
                proposals.slice(0, 5).map(p => (
                  <div 
                    key={p.id} 
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors" 
                    onClick={() => navigate(`/proposals/${p.id}`)}
                  >
                    <h4 className="font-semibold text-gray-900 dark:text-white">{p.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{p.description.slice(0, 80)}...</p>
                    <div className="flex items-center justify-between mt-3 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">{p.author}</span>
                      <span className="text-orange-600 dark:text-orange-400 font-medium">{p.timeLeft}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-xl text-gray-900 dark:text-white">Available Tasks</CardTitle>
              <Button onClick={() => navigate('/tasks')} variant="outline" size="sm">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tasks available</p>
                </div>
              ) : (
                tasks.slice(0, 5).map(t => (
                  <div key={t.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{t.title}</h4>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-green-600 dark:text-green-400 font-bold">{t.reward} MTAA</span>
                      <span className="text-gray-500 dark:text-gray-400">{t.timeLeft}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, tooltip }: { title: string; value: string | number; icon: React.ReactNode; color: string; tooltip: string }) {
  return (
    <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${color} flex items-center justify-center text-white shadow-lg`}>
            {icon}
          </div>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">{title}</p>
      </CardContent>
    </Card>
  );
}
