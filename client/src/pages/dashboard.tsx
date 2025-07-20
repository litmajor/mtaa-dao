import { useState, useEffect } from "react";
import { Plus, Users, DollarSign, TrendingUp, Zap, Award, Bell, Search, Filter, Calendar, Clock, Star, ArrowRight, Activity, Target, Wallet, Vote, Gift, Trophy, Flame, ChevronRight, Eye, MessageCircle, ThumbsUp, Sparkles } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/formatters";

type DaoStats = { activeProposals: number; treasuryBalance: number; activeMembers: number };
type Proposal = { id: string; title: string; description: string; category: string; author: string; votes: number; timeLeft: string; status: string };
type Vault = { id: string; currency: string; balance: string; monthlyGoal: string };
type ContributionStats = { currentStreak: number; monthlyContributions: number; totalContributions: number };
type Member = { name: string; avatar: string; status: string; role: string };
type Task = { id: string; title: string; reward: number; difficulty: string; timeLeft: string; category: string };


export default function MtaaDashboard() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [animatedStats, setAnimatedStats] = useState<{ treasury: number; members: number; proposals: number }>({ treasury: 0, members: 0, proposals: 0 });
  const [daoStats, setDaoStats] = useState<DaoStats | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [contributionStats, setContributionStats] = useState<ContributionStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Animated counter effect
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const stats: DaoStats = await apiGet("/api/dashboard/stats");
        setDaoStats(stats);
        setAnimatedStats({ treasury: 0, members: 0, proposals: 0 });
        animateValue(0, stats.treasuryBalance, 2000, (val: number) => setAnimatedStats(prev => ({ ...prev, treasury: val })));
        animateValue(0, stats.activeMembers, 2000, (val: number) => setAnimatedStats(prev => ({ ...prev, members: val })));
        animateValue(0, stats.activeProposals, 1500, (val: number) => setAnimatedStats(prev => ({ ...prev, proposals: val })));
        setProposals(await apiGet("/api/dashboard/proposals"));
        setVaults(await apiGet("/api/dashboard/vaults"));
        setContributionStats(await apiGet("/api/dashboard/contributions"));
        setMembers(await apiGet("/api/dashboard/members"));
        setTasks(await apiGet("/api/dashboard/tasks"));
      } catch (e) {
        // handle error, e.g. show toast
      }
    }
    fetchDashboardData();
    function animateValue(start: number, end: number, duration: number, callback: (val: number) => void) {
      const startTime = performance.now();
      function animate(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = Math.floor(start + (end - start) * progress);
        callback(currentValue);
        if (progress < 1) requestAnimationFrame(animate);
      }
      requestAnimationFrame(animate);
    }
  }, []);

  // Mouse tracking for interactive effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const GlowingCard = ({ children, className = "", intensity = 0.5 }: { children: React.ReactNode; className?: string; intensity?: number }) => (
    <div 
      className={`relative group ${className}`}
      style={{
        background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(251, 146, 60, ${intensity * 0.1}) 0%, transparent 50%)`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl border border-white/30 shadow-2xl">
        {children}
      </div>
    </div>
  );

  const StatCard = ({ title, value, change, icon, color, delay = 0 }: { title: string; value: string | number; change: string; icon: React.ReactNode; color: string; delay?: number }) => (
    <GlowingCard className="transform transition-all duration-300 hover:scale-105">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-2xl bg-gradient-to-r ${color} shadow-lg transform transition-transform duration-300 hover:rotate-12`}>
              {icon}
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">{title}</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {value}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-emerald-600 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              {change}
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-200/50 rounded-full h-1">
          <div 
            className={`h-1 rounded-full bg-gradient-to-r ${color} transition-all duration-1000`}
            style={{ width: `${75 + delay * 5}%` }}
          />
        </div>
      </div>
    </GlowingCard>
  );

  const ProposalCard = ({ proposal, index }: { proposal: Proposal; index: number }) => (
    <GlowingCard className="transform transition-all duration-300 hover:scale-[1.02] mb-4">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${
              proposal.status === 'trending' ? 'from-yellow-500 to-orange-500' : 
              'from-blue-500 to-purple-500'
            } flex items-center justify-center`}>
              {proposal.status === 'trending' ? <Flame className="w-6 h-6 text-white" /> : <Vote className="w-6 h-6 text-white" />}
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                  proposal.category === 'Environment' ? 'bg-green-100 text-green-800' :
                  proposal.category === 'Education' ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {proposal.category}
                </span>
                {proposal.status === 'trending' && (
                  <span className="px-2 py-1 text-xs rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium">
                    🔥 Trending
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">by {proposal.author}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{proposal.votes} votes</p>
            <p className="text-xs text-gray-500 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {proposal.timeLeft}
            </p>
          </div>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{proposal.title}</h3>
        <p className="text-gray-600 mb-4">{proposal.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button className="flex items-center space-x-1 text-gray-500 hover:text-blue-600 transition-colors">
              <Eye className="w-4 h-4" />
              <span className="text-sm">View</span>
            </button>
            <button className="flex items-center space-x-1 text-gray-500 hover:text-green-600 transition-colors">
              <ThumbsUp className="w-4 h-4" />
              <span className="text-sm">Support</span>
            </button>
            <button className="flex items-center space-x-1 text-gray-500 hover:text-purple-600 transition-colors">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">Discuss</span>
            </button>
          </div>
          <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200">
            Vote Now
          </button>
        </div>
      </div>
    </GlowingCard>
  );

  const TaskCard = ({ task, index }: { task: Task; index: number }) => (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 hover:bg-white/80 transition-all duration-300 transform hover:scale-105">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            task.difficulty === 'Easy' ? 'bg-green-100 text-green-600' :
            task.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-600' :
            'bg-red-100 text-red-600'
          }`}>
            {task.difficulty === 'Easy' ? <Star className="w-4 h-4" /> :
             task.difficulty === 'Medium' ? <Target className="w-4 h-4" /> :
             <Trophy className="w-4 h-4" />}
          </div>
          <span className="text-xs font-medium text-gray-600">{task.category}</span>
        </div>
        <span className="text-sm font-bold text-orange-600">{task.reward} KSH</span>
      </div>
      <h4 className="font-medium text-gray-900 mb-2">{task.title}</h4>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{task.timeLeft} left</span>
        <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-lg text-xs font-medium hover:shadow-md transition-all duration-200">
          Claim
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-purple-100 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-orange-300/30 to-red-300/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-r from-purple-300/30 to-pink-300/30 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-yellow-300/20 to-orange-300/20 rounded-full blur-2xl animate-pulse delay-2000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Mtaa Dashboard
              </h1>
              <p className="text-gray-600">Welcome back, Community Leader 🌟</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-3 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Bell className="w-5 h-5 text-gray-700" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              </button>
            </div>
            <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">JD</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">John Doe</p>
                <p className="text-xs text-gray-500">Elder Member</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <GlowingCard className="mb-8" intensity={0.8}>
          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Shape Your <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Community</span>
                </h2>
                <p className="text-gray-600 text-lg mb-6">
                  Every voice matters. Every vote counts. Together, we build the future of our neighborhood.
                </p>
                <div className="flex space-x-4">
                  <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-2xl font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center">
                    <Plus className="mr-2 h-5 w-5" />
                    New Proposal
                  </button>
                  <button className="bg-white/80 backdrop-blur-sm border border-white/30 text-gray-700 px-8 py-3 rounded-2xl font-semibold hover:bg-white transition-all duration-200">
                    Explore Community
                  </button>
                </div>
              </div>
              <div className="relative">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white transform rotate-3 hover:rotate-0 transition-transform duration-300">
                    <h3 className="font-bold text-lg mb-2">Active Today</h3>
                    <p className="text-2xl font-bold">{animatedStats.members}</p>
                    <p className="text-sm opacity-90">Members Online</p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                    <h3 className="font-bold text-lg mb-2">Treasury</h3>
                    <p className="text-2xl font-bold">${animatedStats.treasury.toLocaleString()}</p>
                    <p className="text-sm opacity-90">Total Funds</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GlowingCard>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Active Proposals"
            value={animatedStats.proposals}
            change="+12%"
            icon={<Vote className="w-6 h-6 text-white" />}
            color="from-blue-500 to-purple-500"
            delay={0}
          />
          <StatCard
            title="Treasury Balance"
            value={`$${animatedStats.treasury.toLocaleString()}`}
            change="+8%"
            icon={<Wallet className="w-6 h-6 text-white" />}
            color="from-emerald-500 to-green-500"
            delay={1}
          />
          <StatCard
            title="Active Members"
            value={animatedStats.members}
            change="+15%"
            icon={<Users className="w-6 h-6 text-white" />}
            color="from-orange-500 to-red-500"
            delay={2}
          />
          <StatCard
            title="Contribution Streak"
            value={contributionStats ? `${contributionStats.currentStreak}d` : "-"}
            change="+23%"
            icon={<Flame className="w-6 h-6 text-white" />}
            color="from-yellow-500 to-orange-500"
            delay={3}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Proposals Feed */}
          <div className="lg:col-span-2">
            <GlowingCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Community Proposals</h2>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                      <Filter className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                      <Search className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {proposals.map((proposal: Proposal, index: number) => (
                    <ProposalCard key={proposal.id} proposal={proposal} index={index} />
                  ))}
                </div>
              </div>
            </GlowingCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Personal Stats */}
            <GlowingCard>
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Your Impact</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Monthly Contribution</span>
                    <span className="font-bold text-xl text-orange-600">
                      {contributionStats ? `$${formatNumber(contributionStats.monthlyContributions)}` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Contributed</span>
                    <span className="font-bold text-lg text-gray-900">
                      {contributionStats ? `$${formatNumber(contributionStats.totalContributions)}` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Streak</span>
                    <div className="flex items-center space-x-2">
                      <Flame className="w-5 h-5 text-orange-500" />
                      <span className="font-bold text-lg text-orange-600">
                        {contributionStats ? `${contributionStats.currentStreak} days` : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Community Rank</span>
                      <span className="text-sm font-bold text-yellow-600 flex items-center">
                        <Trophy className="w-4 h-4 mr-1" />
                        #7
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full text-xs font-medium">
                        🏆 Elder Status
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </GlowingCard>

            {/* Task Board */}
            <GlowingCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Available Tasks</h3>
                  <button className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center">
                    View All <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
                <div className="space-y-3">
                  {tasks.map((task: Task, index: number) => (
                    <TaskCard key={task.id} task={task} index={index} />
                  ))}
                </div>
              </div>
            </GlowingCard>

            {/* Quick Actions */}
            <GlowingCard>
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex flex-col items-center space-y-2">
                    <Plus className="w-5 h-5" />
                    <span className="text-sm">Add Funds</span>
                  </button>
                  <button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex flex-col items-center space-y-2">
                    <Gift className="w-5 h-5" />
                    <span className="text-sm">Send Gift</span>
                  </button>
                  <button className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-4 rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex flex-col items-center space-y-2">
                    <Calendar className="w-5 h-5" />
                    <span className="text-sm">Events</span>
                  </button>
                  <button className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex flex-col items-center space-y-2">
                    <Activity className="w-5 h-5" />
                    <span className="text-sm">Analytics</span>
                  </button>
                </div>
              </div>
            </GlowingCard>
          </div>
        </div>
      </div>
    </div>
  );
}