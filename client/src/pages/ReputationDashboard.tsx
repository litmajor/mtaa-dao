
import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, Star, Award, TrendingUp, Phone, Shield, 
  CheckCircle, Clock, Flame, Gift
} from "lucide-react";

export default function ReputationDashboard() {
  const [reputation, setReputation] = useState<any>(null);
  const [economicIdentity, setEconomicIdentity] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReputationData();
  }, []);

  const fetchReputationData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [repRes, identityRes, contribRes, badgesRes] = await Promise.all([
        fetch('/api/reputation/user/me', { headers, credentials: 'include' }),
        fetch('/api/reputation/economic-identity/me', { headers, credentials: 'include' }),
        fetch('/api/reputation/contributions/me?limit=20', { headers, credentials: 'include' }),
        fetch('/api/reputation/badges/me', { headers, credentials: 'include' })
      ]);

      if (repRes.ok) setReputation(await repRes.json());
      if (identityRes.ok) {
        const data = await identityRes.json();
        setEconomicIdentity(data.identity);
      }
      if (contribRes.ok) {
        const data = await contribRes.json();
        setContributions(data.contributions);
      }
      if (badgesRes.ok) {
        const data = await badgesRes.json();
        setBadges(data.badges);
      }
    } catch (error) {
      console.error('Error fetching reputation:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestPhoneOTP = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/phone-verification/request-otp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber })
      });

      if (response.ok) {
        setOtpSent(true);
        alert('OTP sent to your phone!');
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Error requesting OTP:', error);
    }
  };

  const verifyPhoneOTP = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/phone-verification/verify-otp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber, otp })
      });

      if (response.ok) {
        alert('Phone verified! You earned reputation points.');
        fetchReputationData();
        setOtpSent(false);
        setOtp('');
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
    }
  };

  if (loading) return <div className="p-6">Loading reputation data...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reputation Dashboard</h1>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Star className="w-6 h-6 text-purple-500" />
              <Badge variant="outline">{reputation?.badge || 'Bronze'}</Badge>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {reputation?.totalPoints || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Points</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-6 h-6 text-blue-500" />
              <span className="text-sm text-gray-600">Level {reputation?.level || 1}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {badges.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Badges Earned</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Flame className="w-6 h-6 text-orange-500" />
              <span className="text-sm text-gray-600">{reputation?.currentStreak || 0} days</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {reputation?.longestStreak || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Longest Streak</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <span className="text-sm text-gray-600">This Week</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {reputation?.weeklyPoints || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Weekly Points</div>
          </Card>
        </div>

        {/* Level Progress */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Level Progress</h3>
            <span className="text-sm text-gray-600">
              {reputation?.totalPoints % 100}/100 to Level {(reputation?.level || 1) + 1}
            </span>
          </div>
          <Progress value={(reputation?.totalPoints % 100) || 0} className="h-3" />
        </Card>

        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="identity">Economic Identity</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="verify">Verify</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Credit Score Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Contribution Score</span>
                    <span className="font-bold">{economicIdentity?.contributionScore || 0}/1000</span>
                  </div>
                  <Progress value={(economicIdentity?.contributionScore || 0) / 10} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Governance Score</span>
                    <span className="font-bold">{economicIdentity?.governanceScore || 0}/1000</span>
                  </div>
                  <Progress value={(economicIdentity?.governanceScore || 0) / 10} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Reliability Score</span>
                    <span className="font-bold">{economicIdentity?.reliabilityScore || 0}/1000</span>
                  </div>
                  <Progress value={(economicIdentity?.reliabilityScore || 0) / 10} />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contributions" className="space-y-4">
            {contributions.map((contrib) => (
              <Card key={contrib.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{contrib.contributionType}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(contrib.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-purple-600">+{contrib.reputationWeight} pts</div>
                    {contrib.verified && (
                      <CheckCircle className="w-4 h-4 text-green-500 ml-auto mt-1" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="badges" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {badges.map((badge) => (
              <Card key={badge.id} className="p-6 text-center">
                <Award className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
                <h4 className="font-bold mb-1">{badge.name}</h4>
                <Badge variant="outline" className="mb-2">{badge.badgeTier}</Badge>
                <p className="text-sm text-gray-600">{badge.description}</p>
                <div className="text-xs text-gray-500 mt-2">
                  Earned {new Date(badge.earnedAt).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="verify" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Phone Verification
              </h3>
              {economicIdentity?.phoneVerified ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>Phone verified: {economicIdentity.phoneNumber}</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    placeholder="+254712345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={otpSent}
                  />
                  {otpSent && (
                    <Input
                      placeholder="Enter OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  )}
                  <Button 
                    onClick={otpSent ? verifyPhoneOTP : requestPhoneOTP}
                    className="w-full"
                  >
                    {otpSent ? 'Verify OTP' : 'Send OTP'}
                  </Button>
                  <p className="text-sm text-gray-600">
                    <Gift className="w-4 h-4 inline mr-1" />
                    Earn 100 reputation points for verifying your phone!
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
