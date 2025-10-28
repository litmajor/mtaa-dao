import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Users, DollarSign, TrendingUp, Settings, ArrowRight, Sparkles, Crown, Shield, Star, Zap, Globe, Heart, Trophy, Wallet, Eye, ChevronRight, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

type DaoRole = "elder" | "proposer" | "member" | null;

interface DAO {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  treasuryBalance: number;
  role: DaoRole;
  isJoined: boolean;
  gradient: string;
  theme: string;
  trending: boolean;
  growthRate: number;
  recentActivity: string;
  avatar: string;
}

export default function EnhancedDAOs() {
  const [activeTab, setActiveTab] = useState("joined");
  const [hoveredDao, setHoveredDao] = useState<number | null>(null);
  const [leavingDaoId, setLeavingDaoId] = useState<number | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch DAOs from API
  const { data: daosData = [], isLoading, error } = useQuery<DAO[]>({
    queryKey: ["/api/daos"],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch("/api/daos", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch DAOs");
      }
      
      const data = await response.json();
      
      // Add UI properties to each DAO
      return data.map((dao: any) => ({
        ...dao,
        gradient: dao.gradient || getGradientForTheme(dao.theme || 'purple'),
        avatar: dao.avatar || getAvatarForCategory(dao.category),
      }));
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Join DAO mutation
  const joinMutation = useMutation({
    mutationFn: async (daoId: number) => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/daos/${daoId}/join`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to join DAO");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daos"] });
      toast({
        title: "Success",
        description: "Successfully joined the DAO!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Leave DAO mutation
  const leaveMutation = useMutation({
    mutationFn: async (daoId: number) => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/daos/${daoId}/leave`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to leave DAO");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daos"] });
      setLeavingDaoId(null);
      toast({
        title: "Success",
        description: "Successfully left the DAO",
      });
    },
    onError: (error: Error) => {
      setLeavingDaoId(null);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper functions for UI properties
  function getGradientForTheme(theme: string): string {
    const gradients: Record<string, string> = {
      purple: "from-purple-600 via-pink-600 to-orange-500",
      blue: "from-blue-600 via-cyan-500 to-teal-400",
      green: "from-green-500 via-emerald-500 to-teal-500",
      pink: "from-pink-500 via-rose-500 to-red-500",
      orange: "from-orange-500 via-red-500 to-pink-500",
      teal: "from-teal-500 via-cyan-500 to-blue-500",
    };
    return gradients[theme] || gradients.purple;
  }

  function getAvatarForCategory(category?: string): string {
    const avatars: Record<string, string> = {
      development: "🏘️",
      education: "🎓",
      energy: "🌱",
      business: "💼",
      healthcare: "🏥",
      arts: "🎨",
      sports: "⚽",
      tech: "💻",
    };
    return avatars[category || 'development'] || "🏛️";
  }

  const joinedDAOs = daosData.filter(dao => dao.isJoined);
  const availableDAOs = daosData.filter(dao => !dao.isJoined);

  const getRoleBadge = (role: "elder" | "proposer" | "member" | null, theme: string) => {
    if (!role) return null;
    
    const roleConfig = {
      elder: { icon: Crown, label: "Elder", color: "from-yellow-400 to-orange-500" },
      proposer: { icon: Zap, label: "Proposer", color: "from-purple-400 to-pink-500" },
      member: { icon: Shield, label: "Member", color: "from-blue-400 to-cyan-500" }
    };

    const config = roleConfig[role] || roleConfig.member;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${config.color} shadow-lg`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </div>
    );
  };

  const handleLeaveDao = async (daoId: number) => {
    if (!window.confirm("Are you sure you want to leave this DAO? Past contributions are not refunded.")) return;
    setLeavingDaoId(daoId);
    leaveMutation.mutate(daoId);
  };

  const handleJoinDao = (daoId: number) => {
    joinMutation.mutate(daoId);
  };

  const handleEnterDao = (daoId: number) => {
    navigate(`/dao/${daoId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-400">Loading DAOs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">Failed to load DAOs</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const DAOCard = ({ dao, index }: { dao: DAO; index: number }) => (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${
        hoveredDao === dao.id ? 'scale-105' : ''
      }`}
      onMouseEnter={() => setHoveredDao(dao.id)}
      onMouseLeave={() => setHoveredDao(null)}
      style={{
        animationDelay: `${index * 100}ms`,
        animation: 'fadeInUp 0.8s ease-out forwards'
      }}
    >
      {/* Animated background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${dao.gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-500`} />
      
      {/* Trending indicator */}
      {dao.trending && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-orange-400 to-pink-500 text-white text-xs font-semibold rounded-full shadow-lg animate-pulse">
            <TrendingUp className="w-3 h-3" />
            Hot
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${dao.gradient} flex items-center justify-center text-2xl shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
              {dao.avatar}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 group-hover:bg-clip-text transition-all duration-300">
                {dao.name}
              </h3>
              {getRoleBadge(dao.role, dao.theme)}
            </div>
          </div>
          
          {dao.isJoined && (
            <button className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-300 group">
              <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          )}
        </div>

        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
          {dao.description}
        </p>

        {/* Stats with enhanced visuals */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center group/stat">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className={`w-4 h-4 text-blue-500 group-hover/stat:scale-110 transition-transform duration-300`} />
              <span className="font-bold text-gray-900 dark:text-white">{dao.memberCount}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Members</p>
          </div>
          
          <div className="text-center group/stat">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Wallet className={`w-4 h-4 text-green-500 group-hover/stat:scale-110 transition-transform duration-300`} />
              <span className="font-bold text-gray-900 dark:text-white">
                ${dao.treasuryBalance.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Treasury</p>
          </div>
          
          <div className="text-center group/stat">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className={`w-4 h-4 text-purple-500 group-hover/stat:scale-110 transition-transform duration-300`} />
              <span className="font-bold text-gray-900 dark:text-white">+{dao.growthRate}%</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Growth</p>
          </div>
        </div>

        {/* Recent activity */}
        <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">{dao.recentActivity}</span>
        </div>

        {/* Action buttons */}
        {dao.isJoined ? (
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => handleEnterDao(dao.id)}
              className={`w-full bg-gradient-to-r ${dao.gradient} text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 group/btn`}
            >
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
              Enter DAO
              <Sparkles className="w-4 h-4 group-hover/btn:rotate-12 transition-transform duration-300" />
            </button>
            <button
              className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:transform-none"
              disabled={leavingDaoId === dao.id || leaveMutation.isPending}
              onClick={() => handleLeaveDao(dao.id)}
            >
              {leavingDaoId === dao.id || leaveMutation.isPending ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Leaving...
                </div>
              ) : (
                "Leave DAO"
              )}
            </button>
          </div>
        ) : (
          <button 
            onClick={() => handleJoinDao(dao.id)}
            disabled={joinMutation.isPending}
            className={`w-full bg-gradient-to-r ${dao.gradient} text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 group/btn disabled:opacity-50 disabled:transform-none`}
          >
            {joinMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 group-hover/btn:rotate-90 transition-transform duration-300" />
                Join DAO
                <Heart className="w-4 h-4 group-hover/btn:scale-110 transition-transform duration-300" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced header */}
        <div className="flex items-center justify-between mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent mb-2">
              DAOs
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Shape the future of community governance
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Globe className="w-4 h-4" />
              <span>Powered by blockchain technology</span>
            </div>
          </div>
          
          <button 
            onClick={() => navigate('/create-dao')}
            className="group relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white px-8 py-4 rounded-2xl font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2">
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              Create DAO
              <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
            </div>
          </button>
        </div>

        {/* Enhanced tabs */}
        <div className="flex items-center gap-2 mb-8 p-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-fit">
          {[
            { key: "joined", label: `My DAOs (${joinedDAOs.length})`, icon: Shield },
            { key: "available", label: `Discover (${availableDAOs.length})`, icon: Eye }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === key
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* DAOs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(activeTab === "joined" ? joinedDAOs : availableDAOs).map((dao, index) => (
            <DAOCard key={dao.id} dao={dao} index={index} />
          ))}
        </div>

        {/* Enhanced empty state */}
        {(activeTab === "joined" ? joinedDAOs : availableDAOs).length === 0 && (
          <div className="text-center py-16">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <Plus className="h-12 w-12 text-white" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full opacity-20 animate-ping"></div>
            </div>
            
            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
              {activeTab === "joined" ? "No DAOs joined yet" : "No DAOs available"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-8 max-w-md mx-auto">
              {activeTab === "joined" 
                ? "Join your first DAO to start participating in revolutionary community governance"
                : "Check back soon for new innovative communities to join"
              }
            </p>
            <button 
              onClick={() => activeTab === "joined" ? setActiveTab("available") : navigate('/create-dao')}
              className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white px-8 py-4 rounded-2xl font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 group"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                {activeTab === "joined" ? "Discover DAOs" : "Create DAO"}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}