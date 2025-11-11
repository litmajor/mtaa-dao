import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, DollarSign, TrendingUp, Zap, Award, Bell, Search, Filter, Calendar, Clock, Star, ArrowRight, Activity, Target, Wallet, Vote, Gift, Trophy, Flame, ChevronRight, Eye, MessageCircle, ThumbsUp, Sparkles, CheckCircle, XCircle, AlertCircle, Heart, Share2, BookOpen, Coins, Timer, Medal, TrendingDown, Send, Repeat, Moon, Sun } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PublicImpactFeed from '@/components/PublicImpactFeed';
import DaoOfTheWeekBanner from '@/components/DaoOfTheWeekBanner';

type DaoStats = { activeProposals: number; treasuryBalance: number; activeMembers: number; totalVotes: number; completedTasks: number; };
type Proposal = { id: string; title: string; description: string; category: string; author: string; votes: number; timeLeft: string; status: string; urgency?: string; };
type Vault = { id: string; currency: string; balance: string; monthlyGoal: string; };
type ContributionStats = { currentStreak: number; monthlyContributions: number; totalContributions: number; };
type Member = { name: string; avatar: string; status: string; role: string; };
type Task = { id: string; title: string; reward: number; difficulty: string; timeLeft: string; category: string; };
type DaoInfo = { id: string; name: string; memberCount: number; role: string; };

export default function MtaaDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDaoId, setSelectedDaoId] = useState<string | null>(null);
  const [userDaos, setUserDaos] = useState<DaoInfo[]>([]);
  const [daoStats, setDaoStats] = useState<DaoStats | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [contributionStats, setContributionStats] = useState<ContributionStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(localStorage.theme === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.theme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  // Fetch user's DAOs first
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

      // Auto-select first DAO if user has DAOs
      if (joinedDaos.length > 0) {
        setSelectedDaoId(joinedDaos[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch user DAOs:', err);
    }
  }

  // Fetch dashboard data based on selected DAO
  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [
        stats,
        proposalsData,
        vaultsData,
        contributionsData,
        membersData,
        tasksData
      ] = await Promise.all([
        apiGet(`/api/dashboard/stats${selectedDaoId ? `?daoId=${selectedDaoId}` : ''}`),
        apiGet(`/api/dashboard/proposals${selectedDaoId ? `?daoId=${selectedDaoId}` : ''}`),
        apiGet(`/api/dashboard/vaults${selectedDaoId ? `?daoId=${selectedDaoId}` : ''}`),
        apiGet("/api/dashboard/contributions"),
        apiGet(`/api/dashboard/members${selectedDaoId ? `?daoId=${selectedDaoId}` : ''}`),
        apiGet(`/api/dashboard/tasks${selectedDaoId ? `?daoId=${selectedDaoId}` : ''}`)
      ]);

      setDaoStats(stats);
      setProposals(proposalsData || []);
      setVaults(vaultsData || []);
      setContributionStats(contributionsData);
      setMembers(membersData || []);
      setTasks(tasksData || []);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data');
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

  // Render different views based on DAO context
  const renderDashboard = () => {
    // Case 1: No DAOs - Onboarding view
    if (userDaos.length === 0) {
      return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          {/* Welcome Card */}
          <Card className="bg-gradient-to-r from-orange-500 to-pink-500 text-white">
            <CardHeader>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Sparkles className="w-8 h-8" />
                Welcome to Mtaa DAO!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg">Get started by joining a DAO or creating your own community.</p>
              <div className="flex gap-4">
                <Button onClick={() => navigate('/daos')} className="bg-white text-orange-600 hover:bg-gray-100">
                  <Users className="w-4 h-4 mr-2" />
                  Browse DAOs
                </Button>
                <Button onClick={() => navigate('/create-dao')} variant="outline" className="border-white text-white hover:bg-white/20">
                  <Plus className="w-4 h-4 mr-2" />
                  Create DAO
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Platform Stats */}
          <PublicImpactFeed />
          <DaoOfTheWeekBanner />
        </div>
      );
    }

    // Case 2: Single DAO - Direct dashboard
    if (userDaos.length === 1) {
      return renderSingleDaoDashboard();
    }

    // Case 3: Multiple DAOs - Selector + Dashboard
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* DAO Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <Select value={selectedDaoId || ''} onValueChange={setSelectedDaoId}>
              <SelectTrigger className="w-64">
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
          </div>
          <Button onClick={() => setDarkMode(!darkMode)} variant="outline" size="icon">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>

        {renderSingleDaoDashboard()}
      </div>
    );
  };

  const renderSingleDaoDashboard = () => {
    if (loading) {
      return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-6 pb-20">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title="Proposals" value={daoStats?.activeProposals || 0} icon={<Vote className="w-5 h-5" />} color="from-blue-500 to-cyan-500" />
          <StatCard title="Treasury" value={formatCurrency(daoStats?.treasuryBalance || 0)} icon={<DollarSign className="w-5 h-5" />} color="from-green-500 to-emerald-500" />
          <StatCard title="Members" value={daoStats?.activeMembers || 0} icon={<Users className="w-5 h-5" />} color="from-purple-500 to-pink-500" />
          <StatCard title="Votes" value={daoStats?.totalVotes || 0} icon={<ThumbsUp className="w-5 h-5" />} color="from-orange-500 to-red-500" />
          <StatCard title="Tasks Done" value={daoStats?.completedTasks || 0} icon={<CheckCircle className="w-5 h-5" />} color="from-teal-500 to-green-500" />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Proposals */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Active Proposals</CardTitle>
              <Button onClick={() => navigate('/proposals')} variant="outline" size="sm">View All</Button>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {proposals.slice(0, 5).map(p => (
                <div key={p.id} className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => navigate(`/proposals/${p.id}`)}>
                  <h4 className="font-semibold">{p.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{p.description.slice(0, 80)}...</p>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span>{p.author}</span>
                    <span className="text-orange-600">{p.timeLeft}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Available Tasks</CardTitle>
              <Button onClick={() => navigate('/tasks')} variant="outline" size="sm">View All</Button>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {tasks.slice(0, 5).map(t => (
                <div key={t.id} className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <h4 className="font-semibold text-sm">{t.title}</h4>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-green-600 font-bold">{t.reward} MTAA</span>
                    <span className="text-gray-500">{t.timeLeft}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {renderDashboard()}
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${color} flex items-center justify-center text-white mb-2`}>
          {icon}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      </CardContent>
    </Card>
  );
}