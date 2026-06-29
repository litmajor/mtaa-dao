import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Copy, Gift, TrendingUp, Users, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ReferralWorkspace() {
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetch('/api/referrals/stats'),
        fetch('/api/referral-rewards/history')
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
    } catch (e) {
      console.error('Failed to fetch referral data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (rewardId: string) => {
    setClaiming(rewardId);
    try {
      const res = await fetch(`/api/referral-rewards/claim/${rewardId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (res.ok) {
        toast({ title: 'Success', description: 'Reward claimed successfully!' });
        fetchData(); // Refresh data
      } else {
        toast({ title: 'Error', description: data.error || data.message || 'Failed to claim reward', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Network error while claiming', variant: 'destructive' });
    } finally {
      setClaiming(null);
    }
  };

  const copyLink = () => {
    if (stats?.referralCode) {
      const link = `${window.location.origin}/register?ref=${stats.referralCode}`;
      navigator.clipboard.writeText(link);
      toast({ title: 'Copied!', description: 'Referral link copied to clipboard.' });
    }
  };

  const getTierInfo = (totalRefs: number) => {
    if (totalRefs >= 21) return { name: 'Gold', next: null, max: 21, color: 'bg-yellow-500' };
    if (totalRefs >= 6) return { name: 'Silver', next: 'Gold', max: 21, color: 'bg-slate-300' };
    return { name: 'Bronze', next: 'Silver', max: 6, color: 'bg-amber-700' };
  };

  if (loading && !stats) {
    return <div className="animate-pulse space-y-4">
      <div className="h-32 bg-slate-800 rounded-xl" />
      <div className="h-64 bg-slate-800 rounded-xl" />
    </div>;
  }

  const tierInfo = getTierInfo(stats?.totalReferrals || 0);
  const progressPercent = tierInfo.next ? Math.min(100, ((stats?.totalReferrals || 0) / tierInfo.max) * 100) : 100;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" /> Referral & Growth
          </h2>
          <p className="text-slate-400 text-sm">
            Invite members to MtaaDAO and earn MTAA tokens. Rewards vest over 90 days.
          </p>
        </div>
        
        {stats?.referralCode && (
          <div className="flex items-center gap-2 bg-slate-800 p-1 pl-4 rounded-full border border-slate-700">
            <span className="text-sm text-slate-300 font-mono">{stats.referralCode}</span>
            <Button size="sm" className="rounded-full bg-purple-600 hover:bg-purple-700" onClick={copyLink}>
              <Copy className="w-4 h-4 mr-2" /> Share Link
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tier Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm text-slate-400 font-medium">Current Tier</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-white">{tierInfo.name}</span>
                  <div className={`w-3 h-3 rounded-full ${tierInfo.color}`} />
                </div>
              </div>
              <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                {stats?.totalReferrals || 0} Invited
              </Badge>
            </div>
            
            {tierInfo.next && (
              <div className="space-y-2 mt-6">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Progress to {tierInfo.next}</span>
                  <span>{stats?.totalReferrals || 0} / {tierInfo.max}</span>
                </div>
                <Progress value={progressPercent} className="h-2 bg-slate-700" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6 flex flex-col justify-center h-full">
            <p className="text-sm text-slate-400 font-medium mb-1">Active Referrals</p>
            <div className="text-3xl font-bold text-white flex items-center gap-2">
              {stats?.activeReferrals || 0}
              <span className="text-sm font-normal text-green-400 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                {stats?.thisMonthReferrals || 0} this month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6 flex flex-col justify-center h-full">
            <p className="text-sm text-slate-400 font-medium mb-1">Pending / Total Earned</p>
            <div className="text-3xl font-bold text-white flex items-center gap-2">
              <span className="text-yellow-400">{history?.summary?.pending || 0}</span>
              <span className="text-slate-500 text-lg">/</span>
              <span>{history?.summary?.totalEarned || 0}</span>
              <span className="text-sm text-slate-400 ml-1">MTAA</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rewards & Vesting */}
      <h3 className="text-lg font-bold text-white mt-8 mb-4 flex items-center gap-2">
        <Gift className="w-5 h-5 text-purple-400" /> Rewards & Vesting
      </h3>
      
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {history?.rewards?.length > 0 ? (
          <div className="divide-y divide-slate-700/50">
            {history.rewards.map((reward: any) => {
              const total = parseFloat(reward.totalReward);
              const claimed = parseFloat(reward.claimedAmount);
              const createdAt = new Date(reward.createdAt);
              const daysSince = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
              
              let vestedPct = 25;
              if (daysSince >= 90) vestedPct = 100;
              else if (daysSince >= 60) vestedPct = 75;
              else if (daysSince >= 30) vestedPct = 50;

              const vestedAmount = (total * vestedPct) / 100;
              const available = Math.max(0, vestedAmount - claimed);
              const isFullyClaimed = reward.status === 'claimed';

              return (
                <div key={reward.id} className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1 w-full">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-white font-medium">Week ending {new Date(reward.weekEnding).toLocaleDateString()}</div>
                        <div className="text-sm text-slate-400">Base: {reward.baseReward} • Multiplier: {reward.qualityMultiplier}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-400">{total.toFixed(2)} MTAA</div>
                        <div className="text-xs text-slate-500">Tier: {reward.tier.toUpperCase()}</div>
                      </div>
                    </div>
                    
                    {/* Vesting Timeline Visual */}
                    <div className="relative pt-2">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Day 0 (25%)</span>
                        <span>Day 30 (50%)</span>
                        <span>Day 60 (75%)</span>
                        <span>Day 90 (100%)</span>
                      </div>
                      <Progress value={vestedPct} className="h-1.5 bg-slate-700" indicatorClassName="bg-purple-500" />
                      <div className="flex justify-between text-xs mt-1 text-slate-400">
                        <span>{claimed.toFixed(2)} Claimed</span>
                        <span>{vestedPct}% Vested</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-full md:w-auto">
                    {isFullyClaimed ? (
                      <Button disabled variant="outline" className="w-full bg-slate-800 border-slate-700 text-green-500">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Fully Claimed
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleClaim(reward.id)} 
                        disabled={available <= 0 || claiming === reward.id}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        {claiming === reward.id ? 'Claiming...' : available > 0 ? `Claim ${available.toFixed(2)} MTAA` : 'Vesting...'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            No rewards yet. Share your link to start earning!
          </div>
        )}
      </div>
    </div>
  );
}
