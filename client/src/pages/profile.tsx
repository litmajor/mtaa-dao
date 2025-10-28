import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Settings, LogOut, Calendar, TrendingUp, Users, Award, Crown, Star, Sparkles, Target, Trophy, Zap, Gift, Loader2 } from "lucide-react";
import { useAuth } from "./hooks/useAuth";

interface ContributionData {
  id: number;
  purpose: string;
  amount: string;
  currency: string;
  createdAt: string;
}

interface VaultData {
  id: number;
  balance: string;
}

interface ProfileData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    joinedAt: string;
    profilePicture?: string | null;
  };
  contributionStats: {
    totalContributions: number;
    monthlyContributions: number;
    currentStreak: number;
  };
  contributions: ContributionData[];
  vaults: VaultData[];
  votingTokenBalance: number;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();

  // Fetch profile data from API
  const { data: profileData, isLoading, error } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch("/api/profile", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch profile data");
      }
      
      return response.json();
    },
    enabled: !!authUser,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  const user = profileData?.user || authUser;
  const contributionStats = profileData?.contributionStats || { totalContributions: 0, monthlyContributions: 0, currentStreak: 0 };
  const contributions = profileData?.contributions || [];
  const vaults = profileData?.vaults || [];
  const votingTokenBalance = profileData?.votingTokenBalance || 0;

  const totalBalance = vaults?.reduce((sum, vault) =>
    sum + parseFloat(vault.balance || "0"), 0
  ) || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-lg mb-4">Failed to load profile data</p>
          <Button onClick={() => navigate(0)}>Retry</Button>
        </div>
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "elder":
        return (
          <div className="px-4 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg font-semibold flex items-center space-x-2">
            <Crown className="w-4 h-4" />
            <span>Elder</span>
          </div>
        );
      case "proposer":
        return (
          <div className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg font-semibold flex items-center space-x-2">
            <Star className="w-4 h-4" />
            <span>Proposer</span>
          </div>
        );
      default:
        return (
          <div className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg font-semibold flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Member</span>
          </div>
        );
    }
  };

  const safeUser = user || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-2000"></div>
        
        {/* Floating particles */}
        <div className="absolute top-20 left-20 w-2 h-2 bg-white rounded-full animate-ping opacity-60"></div>
        <div className="absolute top-40 right-40 w-1 h-1 bg-emerald-400 rounded-full animate-ping opacity-60 delay-500"></div>
        <div className="absolute bottom-40 left-40 w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping opacity-60 delay-1000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Header with Glassmorphism */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-16">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-lg blur opacity-25 animate-pulse"></div>
            <div className="relative backdrop-blur-sm bg-white/10 rounded-xl p-6 border border-white/20 shadow-2xl">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-r from-purple-500 to-emerald-500 rounded-xl shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                    Profile
                  </h1>
                  <p className="text-gray-300 text-lg">Manage your account and view your community activity</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm shadow-lg transform hover:scale-105 transition-all duration-200"
              onClick={() => navigate('/settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button
              className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200"
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Profile Header with Enhanced Design */}
        <div className="relative group mb-16">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
          <div className="relative backdrop-blur-sm bg-white/10 rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
            <div className="p-8 bg-gradient-to-r from-purple-500/10 to-emerald-500/10">
              <div className="flex items-center space-x-8">
                <div className="relative">
                  <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-full blur opacity-25 animate-pulse"></div>
                  <Avatar className="relative w-32 h-32 border-4 border-white/20 shadow-2xl">
                    <AvatarImage src={safeUser.profileImageUrl ?? undefined} alt={safeUser.firstName || "User"} />
                    <AvatarFallback className="text-4xl font-bold bg-gradient-to-br from-purple-500 to-emerald-500 text-white">
                      {safeUser.firstName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-6 mb-4">
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      {safeUser.firstName} {safeUser.lastName}
                    </h2>
                    {getRoleBadge(safeUser.role || "member")}
                  </div>
                  
                  <p className="text-gray-300 text-lg mb-6">{safeUser.email}</p>
                  
                  <div className="flex items-center space-x-8 text-gray-300">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-gradient-to-r from-purple-500 to-emerald-500 rounded-lg">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-medium">
                        Joined {new Date(safeUser.joinedAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg">
                        <Award className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-medium">Rank #7</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid with Enhanced Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {[
            {
              icon: TrendingUp,
              value: `$${contributionStats?.totalContributions?.toFixed(2) || "0.00"}`,
              label: "Total Contributions",
              color: "from-yellow-500 to-orange-600",
              bgColor: "from-yellow-500/20 to-orange-600/20",
              badge: "Total",
              badgeColor: "from-yellow-400 to-orange-500"
            },
            {
              icon: Calendar,
              value: `$${contributionStats?.monthlyContributions?.toFixed(2) || "0.00"}`,
              label: "Monthly Contributions",
              color: "from-emerald-500 to-teal-600",
              bgColor: "from-emerald-500/20 to-teal-600/20",
              badge: "This Month",
              badgeColor: "from-emerald-400 to-teal-500"
            },
            {
              icon: Target,
              value: contributionStats?.currentStreak || 0,
              label: "Day Streak",
              color: "from-purple-500 to-pink-600",
              bgColor: "from-purple-500/20 to-pink-600/20",
              badge: "Streak",
              badgeColor: "from-purple-400 to-pink-500"
            },
            {
              icon: Users,
              value: votingTokenBalance.toString(),
              label: "Your voting token balance",
              color: "from-blue-500 to-indigo-600",
              bgColor: "from-blue-500/20 to-indigo-600/20",
              badge: "Vote Tokens",
              badgeColor: "from-blue-400 to-indigo-500"
            }
          ].map((stat, index) => (
            <div key={index} className="group relative transform transition-all duration-300 hover:scale-105">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
              <div className="relative backdrop-blur-sm bg-white/10 rounded-2xl p-8 border border-white/20 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-14 h-14 bg-gradient-to-r ${stat.bgColor} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <stat.icon className={`w-7 h-7 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} />
                  </div>
                  <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${stat.badgeColor} text-white text-xs font-semibold shadow-lg`}>
                    {stat.badge}
                  </div>
                </div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </h3>
                <p className="text-gray-300 text-sm font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Points Table with Enhanced Design */}
        <div className="relative group mb-16">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
          <div className="relative backdrop-blur-sm bg-white/10 rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-purple-500/10 to-emerald-500/10">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-emerald-500 rounded-lg">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  How to Earn MsiaMo Points
                </h2>
              </div>
              
              <div className="overflow-hidden rounded-xl">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-purple-500/20 to-emerald-500/20 backdrop-blur-sm">
                    <tr>
                      <th className="py-4 px-6 text-left text-white font-semibold">Action</th>
                      <th className="py-4 px-6 text-left text-white font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {[
                      { action: "Active voting", points: "+10" },
                      { action: "Referring a new member", points: "+25" },
                      { action: "Leading a successful proposal", points: "+50" },
                      { action: "Elder/role participation (per day)", points: "+5" }
                    ].map((row, index) => (
                      <tr key={index} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 text-gray-300">{row.action}</td>
                        <td className="py-4 px-6">
                          <span className="px-3 py-1 bg-gradient-to-r from-emerald-400 to-teal-500 text-white rounded-full text-sm font-semibold">
                            {row.points}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Activity and Achievements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-8">
          {/* Recent Activity */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
            <div className="relative backdrop-blur-sm bg-white/10 rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-purple-500/10 to-emerald-500/10">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-emerald-500 rounded-lg">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Recent Activity
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {contributions?.slice(0, 5).map((contribution) => (
                    <div key={contribution.id} className="group relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-xl blur opacity-0 group-hover:opacity-25 transition duration-300"></div>
                      <div className="relative flex items-center space-x-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-300">
                        <div className="w-12 h-12 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">
                            Contributed to {contribution.purpose || "General"} Fund
                          </p>
                          <p className="text-sm text-gray-400">
                            {new Date(contribution.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-400">
                            +${parseFloat(contribution.amount).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-400">{contribution.currency}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
            <div className="relative backdrop-blur-sm bg-white/10 rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-purple-500/10 to-emerald-500/10">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-emerald-500 rounded-lg">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Achievements
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {[
                    {
                      title: "Elder Status",
                      description: "Achieved high contribution ranking",
                      icon: Crown,
                      color: "from-yellow-500 to-orange-600"
                    },
                    {
                      title: "Consistent Contributor",
                      description: "14-day contribution streak",
                      icon: TrendingUp,
                      color: "from-emerald-500 to-teal-600"
                    },
                    {
                      title: "Community Builder",
                      description: "Active participant in governance",
                      icon: Users,
                      color: "from-purple-500 to-pink-600"
                    }
                  ].map((achievement, index) => (
                    <div key={index} className="group relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-400 to-emerald-500 rounded-xl blur opacity-0 group-hover:opacity-25 transition duration-300"></div>
                      <div className="relative flex items-center space-x-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-300">
                        <div className={`w-12 h-12 bg-gradient-to-r ${achievement.color} rounded-full flex items-center justify-center shadow-lg`}>
                          <achievement.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{achievement.title}</p>
                          <p className="text-sm text-gray-400">{achievement.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}