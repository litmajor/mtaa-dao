import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Users, DollarSign, Trophy, Gift, Share2, Crown, Award, Star, Sparkles, TrendingUp, Target, Zap } from "lucide-react";
import { useState } from "react";

export default function Referrals() {
  // Mock auth and toast for demo
  const user = { id: "demo123" };
  const toast = (params: { title: string; description?: string }) => console.log("Toast:", params);
  // Use compatible toast API
  const showToast = (message: string, type?: 'success' | 'error' | 'info') => console.log('Toast:', message, type);
  const [activeTab, setActiveTab] = useState("overview");

  // OAuth handlers
  const handleGoogleAuth = (mode: "login" | "register") => {
    window.location.href = `/api/auth/oauth/google?mode=${mode}`;
  };
  const handleTelegramAuth = (mode: "login" | "register") => {
    window.location.href = `/api/auth/telegram/init?mode=${mode}`;
  };

  // Fetch real referral data
  const { data: referralStats } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: async () => {
      const res = await fetch('/api/referrals/stats');
      if (!res.ok) throw new Error('Failed to fetch referral stats');
      return res.json();
    }
  });

  const { data: leaderboardData = [] } = useQuery({
    queryKey: ['referral-leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/referrals/leaderboard');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    }
  });

  const referralCode = referralStats?.referralCode || "MTAA-" + (user?.id?.substring(0, 6) || "123456").toUpperCase();
  const referralLink = `https://mtaa-dao.org/join?ref=${referralCode}`;

  const mockReferralStats = referralStats || {
    totalReferrals: 0,
    activeReferrals: 0,
    totalEarned: 0,
    pendingRewards: 0,
    thisMonthReferrals: 0,
  };

  const mockLeaderboard: LeaderboardEntry[] = leaderboardData.length > 0 ? leaderboardData as LeaderboardEntry[] : [];
  // Type for leaderboard entries
  type LeaderboardEntry = {
    id: string;
    rank: number;
    name: string;
    badge: string;
    referrals: number;
    earnings: number;
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    showToast("Referral link copied to clipboard", "success");
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400 drop-shadow-lg" />;
    if (rank === 2) return <Award className="w-5 h-5 text-gray-300 drop-shadow-lg" />;
    if (rank === 3) return <Star className="w-5 h-5 text-orange-400 drop-shadow-lg" />;
    return <Trophy className="w-5 h-5 text-emerald-400 drop-shadow-lg" />;
  };

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case "Diamond":
        return "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg";
      case "Platinum":
        return "bg-gradient-to-r from-gray-400 to-gray-600 text-white shadow-lg";
      case "Gold":
        return "bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg";
      case "Silver":
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white shadow-lg";
      default:
        return "bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg";
    }
  };

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header with Glassmorphism and OAuth buttons */}
        <div className="flex items-center justify-between mb-12">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-lg blur opacity-25 animate-pulse"></div>
            <div className="relative backdrop-blur-sm bg-white/10 rounded-xl p-6 border border-white/20 shadow-2xl">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-r from-purple-500 to-emerald-500 rounded-xl shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                    Referrals & Leaderboard
                  </h1>
                  <p className="text-gray-300 text-lg">Earn rewards by inviting friends to join Mtaa DAO</p>
                </div>
              </div>
              {/* OAuth Buttons */}
              <div className="flex gap-4 mt-6">
                <Button
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
                  onClick={() => handleGoogleAuth("register")}
                >
                  <img src="/google-icon.svg" alt="Google" className="w-5 h-5" /> Register with Google
                </Button>
                <Button
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
                  onClick={() => handleTelegramAuth("register")}
                >
                  <img src="/telegram-icon.svg" alt="Telegram" className="w-5 h-5" /> Register with Telegram
                </Button>
                <Button
                  variant="outline"
                  className="border-2 border-white/30 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2"
                  onClick={() => handleGoogleAuth("login")}
                >
                  <img src="/google-icon.svg" alt="Google" className="w-5 h-5" /> Login with Google
                </Button>
                <Button
                  variant="outline"
                  className="border-2 border-white/30 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2"
                  onClick={() => handleTelegramAuth("login")}
                >
                  <img src="/telegram-icon.svg" alt="Telegram" className="w-5 h-5" /> Login with Telegram
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs with Enhanced Design */}
        <div className="flex items-center space-x-4 mb-12">
          <div className="backdrop-blur-sm bg-white/10 rounded-2xl p-2 border border-white/20 shadow-xl">
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                onClick={() => setActiveTab("overview")}
                className={`relative px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  activeTab === "overview"
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg transform scale-105"
                    : "text-white hover:bg-white/10 hover:scale-105"
                }`}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                My Referrals
              </Button>
              <Button
                variant="ghost"
                onClick={() => setActiveTab("leaderboard")}
                className={`relative px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  activeTab === "leaderboard"
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg transform scale-105"
                    : "text-white hover:bg-white/10 hover:scale-105"
                }`}
              >
                <Trophy className="mr-2 h-4 w-4" />
                Leaderboard
              </Button>
            </div>
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Referral Stats with Glassmorphism */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: Users,
                  value: mockReferralStats.totalReferrals,
                  label: "Total Referrals",
                  color: "from-emerald-500 to-teal-600",
                  bgColor: "from-emerald-500/20 to-teal-600/20",
                  badge: "Total",
                  badgeColor: "from-emerald-400 to-teal-500"
                },
                {
                  icon: DollarSign,
                  value: `$${mockReferralStats.totalEarned.toFixed(2)}`,
                  label: "Total Earned",
                  color: "from-yellow-500 to-orange-600",
                  bgColor: "from-yellow-500/20 to-orange-600/20",
                  badge: "Earned",
                  badgeColor: "from-yellow-400 to-orange-500"
                },
                {
                  icon: Gift,
                  value: `$${mockReferralStats.pendingRewards.toFixed(2)}`,
                  label: "Pending Rewards",
                  color: "from-purple-500 to-pink-600",
                  bgColor: "from-purple-500/20 to-pink-600/20",
                  badge: "Pending",
                  badgeColor: "from-purple-400 to-pink-500"
                },
                {
                  icon: Target,
                  value: mockReferralStats.thisMonthReferrals,
                  label: "New This Month",
                  color: "from-blue-500 to-indigo-600",
                  bgColor: "from-blue-500/20 to-indigo-600/20",
                  badge: "This Month",
                  badgeColor: "from-blue-400 to-indigo-500"
                }
              ].map((stat, index) => (
                <div key={index} className="group relative transform transition-all duration-300 hover:scale-105">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
                  <div className="relative backdrop-blur-sm bg-white/10 rounded-2xl p-6 border border-white/20 shadow-2xl">
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

            {/* Referral Link with Enhanced Design */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
              <div className="relative backdrop-blur-sm bg-white/10 rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-purple-500/10 to-emerald-500/10">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-emerald-500 rounded-lg">
                      <Share2 className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      Your Referral Link
                    </h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="referralCode" className="text-sm font-medium text-gray-300 mb-2 block">
                        Referral Code
                      </Label>
                      <div className="flex space-x-3">
                        <Input
                          id="referralCode"
                          value={referralCode}
                          readOnly
                          className="flex-1 bg-white/10 border-white/20 text-white placeholder-gray-400 backdrop-blur-sm"
                        />
                        <Button 
                          onClick={copyReferralLink} 
                          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="referralLink" className="text-sm font-medium text-gray-300 mb-2 block">
                        Referral Link
                      </Label>
                      <div className="flex space-x-3">
                        <Input
                          id="referralLink"
                          value={referralLink}
                          readOnly
                          className="flex-1 bg-white/10 border-white/20 text-white placeholder-gray-400 backdrop-blur-sm"
                        />
                        <Button 
                          onClick={copyReferralLink} 
                          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex space-x-4 pt-4">
                      <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg transform hover:scale-105 transition-all duration-200">
                        <Share2 className="mr-2 h-4 w-4" />
                        Share Link
                      </Button>
                      <Button className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm shadow-lg transform hover:scale-105 transition-all duration-200">
                        <Gift className="mr-2 h-4 w-4" />
                        Invite Friends
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works with Enhanced Design */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
              <div className="relative backdrop-blur-sm bg-gradient-to-r from-white/10 to-white/5 rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
                <div className="p-8">
                  <div className="flex items-center space-x-3 mb-8">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-emerald-500 rounded-lg">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      How It Works
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                      {
                        icon: Share2,
                        title: "1. Share Your Link",
                        description: "Share your unique referral link with friends and family",
                        color: "from-emerald-500 to-teal-600"
                      },
                      {
                        icon: Users,
                        title: "2. Friends Join",
                        description: "When they sign up using your link, they join your network",
                        color: "from-purple-500 to-pink-600"
                      },
                      {
                        icon: Gift,
                        title: "3. Earn Rewards",
                        description: "Get $20 for each successful referral and ongoing bonuses",
                        color: "from-yellow-500 to-orange-600"
                      }
                    ].map((step, index) => (
                      <div key={index} className="text-center group">
                        <div className="relative mb-6">
                          <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
                          <div className={`relative w-20 h-20 bg-gradient-to-r ${step.color} rounded-full flex items-center justify-center mx-auto shadow-2xl transform group-hover:scale-110 transition-all duration-300`}>
                            <step.icon className="w-10 h-10 text-white" />
                          </div>
                        </div>
                        <h4 className="font-bold text-xl text-white mb-3">{step.title}</h4>
                        <p className="text-gray-300 text-sm leading-relaxed">{step.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
            <div className="relative backdrop-blur-sm bg-white/10 rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-purple-500/10 to-emerald-500/10">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-emerald-500 rounded-lg">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Top Referrers
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {mockLeaderboard.map((leader, index) => (
                    <div
                      key={leader.id}
                      className={`group relative transform transition-all duration-300 hover:scale-102 ${
                        index < 3 ? 'hover:scale-105' : ''
                      }`}
                    >
                      <div className={`absolute -inset-0.5 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300 ${
                        index < 3 
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500' 
                          : 'bg-gradient-to-r from-purple-400 to-emerald-500'
                      }`}></div>
                      
                      <div className={`relative flex items-center justify-between p-6 rounded-2xl transition-all duration-300 ${
                        index < 3 
                          ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30" 
                          : "bg-white/10 border border-white/20 hover:bg-white/20"
                      } backdrop-blur-sm shadow-xl`}>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-3">
                            <div className={`relative p-2 rounded-full ${
                              index < 3 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-purple-400 to-emerald-500'
                            } shadow-lg`}>
                              {getRankBadge(leader.rank)}
                            </div>
                            <span className="font-bold text-xl text-white">
                              #{leader.rank}
                            </span>
                          </div>
                          
                          <div className="relative">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-full blur opacity-25"></div>
                            <Avatar className="relative w-14 h-14 border-2 border-white/20 shadow-lg">
                              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-blue-500 text-white font-bold text-lg">
                                {leader.name.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          
                          <div>
                            <p className="font-semibold text-lg text-white">{leader.name}</p>
                            <div className="flex items-center space-x-3 mt-1">
                              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getBadgeColor(leader.badge)}`}>
                                {leader.badge}
                              </div>
                              <span className="text-sm text-gray-300">
                                {leader.referrals} referrals
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-2xl bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                            ${leader.earnings.toFixed(0)}
                          </p>
                          <p className="text-sm text-gray-300">earned</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}