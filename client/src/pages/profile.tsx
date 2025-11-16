import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Settings, LogOut, Calendar, TrendingUp, Users, Award, Crown, Star, Zap, Target, Trophy } from "lucide-react";
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
    email: string | null;
    role: string;
    joinedAt: string;
    profilePicture?: string | null;
    profileImageUrl?: string | null;
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
    staleTime: 1 * 60 * 1000,
  });

  const user = profileData?.user || authUser;
  const contributionStats = profileData?.contributionStats || { totalContributions: 0, monthlyContributions: 0, currentStreak: 0 };
  const contributions = profileData?.contributions || [];
  const votingTokenBalance = profileData?.votingTokenBalance || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4 text-destructive">Failed to load profile data</p>
          <Button onClick={() => navigate(0)}>Retry</Button>
        </div>
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "elder":
        return <Badge className="bg-gradient-to-r from-yellow-500 to-orange-600"><Crown className="w-3 h-3 mr-1" />Elder</Badge>;
      case "proposer":
        return <Badge className="bg-gradient-to-r from-purple-500 to-pink-600"><Star className="w-3 h-3 mr-1" />Proposer</Badge>;
      default:
        return <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600"><Users className="w-3 h-3 mr-1" />Member</Badge>;
    }
  };

  const safeUser: Partial<ProfileData['user']> = user || {};

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Manage your account and view your activity</p>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button variant="destructive" onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Profile Header Card */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center space-x-6">
              <Avatar className="w-24 h-24 border-4 border-primary/20">
                <AvatarImage src={safeUser.profileImageUrl ?? safeUser.profilePicture ?? undefined} alt={safeUser.firstName || "User"} />
                <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                  {safeUser.firstName?.[0] || "U"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-2">
                  <h2 className="text-2xl font-bold">
                    {safeUser.firstName} {safeUser.lastName}
                  </h2>
                  {getRoleBadge(safeUser.role || "member")}
                </div>

                <p className="text-muted-foreground mb-4">{safeUser.email}</p>

                <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(safeUser.joinedAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4" />
                    <span>Rank #7</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contributions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${contributionStats?.totalContributions?.toFixed(2) || "0.00"}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Contributions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${contributionStats?.monthlyContributions?.toFixed(2) || "0.00"}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Day Streak</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contributionStats?.currentStreak || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Days in a row</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Voting Tokens</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{votingTokenBalance}</div>
              <p className="text-xs text-muted-foreground mt-1">Available to use</p>
            </CardContent>
          </Card>
        </div>

        {/* Points Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              How to Earn MsiaMo Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-4 text-left font-semibold">Action</th>
                    <th className="py-3 px-4 text-left font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { action: "Active voting", points: "+10" },
                    { action: "Referring a new member", points: "+25" },
                    { action: "Leading a successful proposal", points: "+50" },
                    { action: "Elder/role participation (per day)", points: "+5" }
                  ].map((row, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{row.action}</td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{row.points}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Activity and Achievements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contributions?.slice(0, 5).map((contribution) => (
                  <div key={contribution.id} className="flex items-center space-x-4 p-3 bg-muted/50 rounded-lg">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        Contributed to {contribution.purpose || "General"} Fund
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(contribution.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">
                        +${parseFloat(contribution.amount).toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">{contribution.currency}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    title: "Elder Status",
                    description: "Achieved high contribution ranking",
                    icon: Crown,
                  },
                  {
                    title: "Consistent Contributor",
                    description: "14-day contribution streak",
                    icon: TrendingUp,
                  },
                  {
                    title: "Community Builder",
                    description: "Active participant in governance",
                    icon: Users,
                  }
                ].map((achievement, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 bg-muted/50 rounded-lg">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <achievement.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{achievement.title}</p>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}