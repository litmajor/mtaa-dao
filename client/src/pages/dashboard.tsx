
import { useState, useEffect } from "react";
import { Plus, Users, DollarSign, TrendingUp, Zap, Award, Bell, Search, Filter, Calendar, Clock, Star, ArrowRight, Activity, Target, Wallet, Vote, Gift, Trophy, Flame, ChevronRight, Eye, MessageCircle, ThumbsUp, Sparkles, CheckCircle, XCircle, AlertCircle, Heart, Share2, BookOpen, Coins, Timer, Medal, TrendingDown, Send, Repeat } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

type DaoStats = { activeProposals: number; treasuryBalance: number; activeMembers: number; totalVotes: number; completedTasks: number; };
type Proposal = { id: string; title: string; description: string; category: string; author: string; votes: number; timeLeft: string; status: string; urgency?: string; };
type Vault = { id: string; currency: string; balance: string; monthlyGoal: string; };
type ContributionStats = { currentStreak: number; monthlyContributions: number; totalContributions: number; };
type Member = { name: string; avatar: string; status: string; role: string; };
type Task = { id: string; title: string; reward: number; difficulty: string; timeLeft: string; category: string; };
type Achievement = { id: string; title: string; description: string; points: number; unlockedAt?: string; progress?: number; };
type DailyChallenge = { id: string; title: string; description: string; reward: number; progress: number; target: number; };
type QuickAction = { id: string; title: string; icon: React.ReactNode; action: () => void; color: string; };

export default function MtaaDashboard() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [animatedStats, setAnimatedStats] = useState<{ treasury: number; members: number; proposals: number; votes: number; tasks: number }>({ treasury: 0, members: 0, proposals: 0, votes: 0, tasks: 0 });
  const [daoStats, setDaoStats] = useState<DaoStats | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [contributionStats, setContributionStats] = useState<ContributionStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [dailyChallenges, setDailyChallenges] = useState<DailyChallenge[]>([]);
  const [streakMultiplier, setStreakMultiplier] = useState<number>(1);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // Animated counter effect
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch all dashboard data from real APIs
        const [
          stats,
          proposalsData, 
          vaultsData, 
          contributionsData, 
          membersData, 
          tasksData, 
          achievementsData, 
          challengesData
        ] = await Promise.all([
          apiGet("/api/dashboard/stats"),
          apiGet("/api/dashboard/proposals"),
          apiGet("/api/dashboard/vaults"),
          apiGet("/api/dashboard/contributions"),
          apiGet("/api/dashboard/members"),
          apiGet("/api/dashboard/tasks"),
          apiGet("/api/achievements/user"),
          apiGet("/api/challenges/daily")
        ]);
        
        setDaoStats(stats);
        setProposals(proposalsData || []);
        setVaults(vaultsData || []);
        setContributionStats(contributionsData);
        setMembers(membersData || []);
        setTasks(tasksData || []);
        setAchievements(achievementsData || []);
        setDailyChallenges(challengesData || []);
        
        // Reset animated stats
        setAnimatedStats({ treasury: 0, members: 0, proposals: 0, votes: 0, tasks: 0 });
        
        // Animate stats with staggered timing
        if (stats) {
          animateValue(0, stats.treasuryBalance || 0, 2000, (val: number) => setAnimatedStats(prev => ({ ...prev, treasury: val })));
          animateValue(0, stats.activeMembers || 0, 1800, (val: number) => setAnimatedStats(prev => ({ ...prev, members: val })));
          animateValue(0, stats.activeProposals || 0, 1500, (val: number) => setAnimatedStats(prev => ({ ...prev, proposals: val })));
          animateValue(0, stats.totalVotes || 0, 1200, (val: number) => setAnimatedStats(prev => ({ ...prev, votes: val })));
          animateValue(0, stats.completedTasks || 0, 1000, (val: number) => setAnimatedStats(prev => ({ ...prev, tasks: val })));
        }
        
        // Calculate streak multiplier
        if (contributionsData?.currentStreak) {
          setStreakMultiplier(1 + (contributionsData.currentStreak / 10));
        }
        
        setLoading(false);
        setError(null);
        
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError('Failed to load dashboard data. Please try again.');
        setLoading(false);
        // Clear data on error
        setDaoStats(null);
        setProposals([]);
        setTasks([]);
        setAchievements([]);
        setDailyChallenges([]);
        setContributionStats(null);
      }
    }
    
    fetchDashboardData();
    
    // Check onboarding status
    const onboardingStatus = localStorage.getItem('mtaa-onboarding-complete');
    setOnboardingComplete(!!onboardingStatus);
    
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

  // Real-time data loading states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const quickActions: QuickAction[] = [
  { id: '0', title: 'Create DAO', icon: <Sparkles className="w-5 h-5" />, action: () => window.location.href = '/create-dao', color: 'from-teal-500 to-orange-500' },
  { id: '1', title: 'Create Proposal', icon: <Plus className="w-5 h-5" />, action: () => window.location.href = '/proposals', color: 'from-orange-500 to-red-500' },
  { id: '2', title: 'Join Task', icon: <Target className="w-5 h-5" />, action: () => window.location.href = '/tasks', color: 'from-purple-500 to-pink-500' },
  { id: '3', title: 'Add Funds', icon: <Wallet className="w-5 h-5" />, action: () => window.location.href = '/wallet', color: 'from-green-500 to-emerald-500' },
  { id: '4', title: 'Invite Friend', icon: <Share2 className="w-5 h-5" />, action: () => window.location.href = '/referrals', color: 'from-blue-500 to-cyan-500' },
  { id: '5', title: 'Daily Check-in', icon: <CheckCircle className="w-5 h-5" />, action: () => setShowCelebration(true), color: 'from-yellow-500 to-orange-500' },
  { id: '6', title: 'Learn More', icon: <BookOpen className="w-5 h-5" />, action: () => window.location.href = '/about', color: 'from-indigo-500 to-purple-500' }
  ];

  const handleQuickAction = async (action: QuickAction) => {
    try {
      await apiPost('/api/user/activity', { action: action.id, timestamp: new Date().toISOString() });
      action.action();
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  const GlowingCard = ({ children, className = "", intensity = 0.5 }: { children: React.ReactNode; className?: string; intensity?: number }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative group ${className}`}
      style={{
        background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(251, 146, 60, ${intensity * 0.1}) 0%, transparent 50%)`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl border border-white/30 shadow-2xl">
        {children}
      </div>
    </motion.div>
  );

  const StatCard = ({ title, value, change, icon, color, delay = 0, trend = "up" }: { title: string; value: string | number; change: string; icon: React.ReactNode; color: string; delay?: number; trend?: "up" | "down" }) => (
    <GlowingCard className="transform transition-all duration-300 hover:scale-105">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: delay * 0.1, type: "spring", stiffness: 200 }}
              className={`p-3 rounded-2xl bg-gradient-to-r ${color} shadow-lg transform transition-transform duration-300 hover:rotate-12`}
            >
              {icon}
            </motion.div>
            <div>
              <p className="text-sm text-gray-600 font-medium">{title}</p>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay * 0.1 + 0.2 }}
                className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent"
              >
                {value}
              </motion.p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-sm font-semibold flex items-center ${trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {change}
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-200/50 rounded-full h-1">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${75 + delay * 5}%` }}
            transition={{ delay: delay * 0.1 + 0.5, duration: 1 }}
            className={`h-1 rounded-full bg-gradient-to-r ${color}`}
          />
        </div>
      </div>
    </GlowingCard>
  );

  const AchievementCard = ({ achievement, index }: { achievement: Achievement; index: number }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 hover:bg-white/80 transition-all duration-300"
    >
      <div className="flex items-center space-x-3">
        <div className={`w-12 h-12 rounded-full ${achievement.unlockedAt ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gray-200'} flex items-center justify-center`}>
          {achievement.unlockedAt ? <Trophy className="w-6 h-6 text-white" /> : <Medal className="w-6 h-6 text-gray-400" />}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{achievement.title}</h4>
          <p className="text-sm text-gray-600">{achievement.description}</p>
          {!achievement.unlockedAt && achievement.progress && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{achievement.progress}/5</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${(achievement.progress / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-orange-600">+{achievement.points}</span>
        </div>
      </div>
    </motion.div>
  );

  const DailyChallengeCard = ({ challenge, index }: { challenge: DailyChallenge; index: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 hover:bg-white/80 transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Timer className="w-5 h-5 text-orange-500" />
          <span className="text-sm font-medium text-gray-900">{challenge.title}</span>
        </div>
        <span className="text-sm font-bold text-green-600">+{challenge.reward}</span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{challenge.description}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span>{challenge.progress}/{challenge.target}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="h-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${(challenge.progress / challenge.target) * 100}%` }}
          />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-purple-100 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-orange-300/30 to-red-300/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-r from-purple-300/30 to-pink-300/30 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-yellow-300/20 to-orange-300/20 rounded-full blur-2xl animate-pulse delay-2000" />
      </div>

      {/* Celebration Animation */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowCelebration(false)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              className="bg-white rounded-2xl p-8 text-center max-w-md mx-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center"
              >
                <Trophy className="w-8 h-8 text-white" />
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Daily Check-in Complete!</h3>
              <p className="text-gray-600 mb-4">You've earned 50 points and maintained your {contributionStats?.currentStreak || 0}-day streak!</p>
              <button 
                onClick={() => setShowCelebration(false)}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-xl font-medium"
              >
                Awesome! 🎉
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Enhanced Header with Dashboard Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  Community Dashboard
                </h1>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => window.location.href = '/vault-dashboard'}>
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Vault Portfolio
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = '/wallet'}>
                    <Wallet className="w-4 h-4 mr-1" />
                    Personal Finance
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <p className="text-gray-600">Welcome back, Community Leader 🌟</p>
                {contributionStats && contributionStats.currentStreak > 0 && (
                  <div className="flex items-center space-x-2 bg-gradient-to-r from-orange-100 to-red-100 px-3 py-1 rounded-full">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">{contributionStats.currentStreak} day streak!</span>
                    <span className="text-xs text-orange-600">x{streakMultiplier.toFixed(1)} multiplier</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-3 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
                title="Show notifications"
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

        {/* Enhanced Stats Grid with more engagement metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
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
            title="Total Votes"
            value={animatedStats.votes}
            change="+23%"
            icon={<CheckCircle className="w-6 h-6 text-white" />}
            color="from-purple-500 to-pink-500"
            delay={3}
          />
          <StatCard
            title="Tasks Completed"
            value={animatedStats.tasks}
            change="+18%"
            icon={<Target className="w-6 h-6 text-white" />}
            color="from-yellow-500 to-orange-500"
            delay={4}
          />
        </div>

        {/* Quick Actions Grid - High Engagement Feature */}
        <GlowingCard className="mb-8">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-orange-500" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleQuickAction(action)}
                  className={`bg-gradient-to-r ${action.color} text-white p-4 rounded-xl font-medium hover:shadow-lg transform transition-all duration-200 flex flex-col items-center space-y-2`}
                >
                  {action.icon}
                  <span className="text-sm text-center">{action.title}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </GlowingCard>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Proposals and Daily Challenges */}
          <div className="lg:col-span-2 space-y-8">
            {/* Daily Challenges - High Engagement Feature */}
            <GlowingCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-orange-500" />
                    Today's Challenges
                  </h2>
                  <span className="text-sm bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 px-3 py-1 rounded-full font-medium">
                    Resets in 4h 23m
                  </span>
                </div>
                <div className="grid gap-4">
                  {dailyChallenges.map((challenge, index) => (
                    <DailyChallengeCard key={challenge.id} challenge={challenge} index={index} />
                  ))}
                </div>
              </div>
            </GlowingCard>

            {/* Proposals Feed */}
            <GlowingCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Trending Proposals</h2>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" title="Filter proposals">
                      <Filter className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" title="Search proposals">
                      <Search className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {proposals.map((proposal, index) => (
                    <motion.div
                      key={proposal.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/30 hover:bg-white/80 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${
                            proposal.urgency === 'high' ? 'from-red-500 to-pink-500' :
                            proposal.status === 'trending' ? 'from-yellow-500 to-orange-500' : 
                            'from-blue-500 to-purple-500'
                          } flex items-center justify-center shadow-lg`}>
                            {proposal.urgency === 'high' ? <AlertCircle className="w-6 h-6 text-white" /> :
                             proposal.status === 'trending' ? <Flame className="w-6 h-6 text-white" /> : 
                             <Vote className="w-6 h-6 text-white" />}
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
                              {proposal.urgency === 'high' && (
                                <span className="px-2 py-1 text-xs rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium">
                                  ⚡ Urgent
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">by {proposal.author}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 flex items-center">
                            <Heart className="w-4 h-4 mr-1 text-red-500" />
                            {proposal.votes}
                          </p>
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
                    </motion.div>
                  ))}
                </div>
              </div>
            </GlowingCard>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Achievements - Gamification Feature */}
            <GlowingCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                    Achievements
                  </h3>
                  <button 
                    onClick={() => window.location.href = '/achievements'}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {achievements.slice(0, 3).map((achievement, index) => (
                    <AchievementCard key={achievement.id} achievement={achievement} index={index} />
                  ))}
                </div>
              </div>
            </GlowingCard>

            {/* Personal Stats with Streak Bonus */}
            <GlowingCard>
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-orange-500" />
                  Your Impact
                </h3>
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
                    <span className="text-gray-600">Current Streak</span>
                    <div className="flex items-center space-x-2">
                      <Flame className="w-5 h-5 text-orange-500" />
                      <span className="font-bold text-lg text-orange-600">
                        {contributionStats ? `${contributionStats.currentStreak} days` : "-"}
                      </span>
                    </div>
                  </div>
                  {streakMultiplier > 1 && (
                    <div className="bg-gradient-to-r from-yellow-100 to-orange-100 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-orange-700">Streak Bonus</span>
                        <span className="text-sm font-bold text-orange-600">x{streakMultiplier.toFixed(1)}</span>
                      </div>
                      <p className="text-xs text-orange-600 mt-1">All rewards multiplied!</p>
                    </div>
                  )}
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

            {/* Available Tasks */}
            <GlowingCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-purple-500" />
                    Available Tasks
                  </h3>
                  <button 
                    onClick={() => window.location.href = '/tasks'}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center"
                  >
                    View All <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 hover:bg-white/80 transition-all duration-300 transform hover:scale-105"
                    >
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
                        <span className="text-sm font-bold text-orange-600 flex items-center">
                          <Coins className="w-4 h-4 mr-1" />
                          {task.reward} KSH
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-2">{task.title}</h4>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {task.timeLeft} left
                        </span>
                        <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-lg text-xs font-medium hover:shadow-md transition-all duration-200">
                          Claim Task
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </GlowingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
