import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Gift, Clock, TrendingUp, Award, Zap, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RewardCardProps {
  reward: {
    id: string;
    amount: string;
    currency: string;
    awardedAt: string;
    status: 'pending' | 'claimed' | 'cancelled';
    vestingPeriodDays: number;
    vestingStartDate: string | null;
    claimedAt: string | null;
    rank?: number;
    weekEnding?: string;
  };
  onClaim?: (rewardId: string) => void;
  claiming?: boolean;
}

export function RewardCard({ reward, onClaim, claiming }: RewardCardProps) {
  const isVesting = reward.vestingPeriodDays > 0;
  const vestingProgress = isVesting && reward.vestingStartDate 
    ? Math.min(
        100,
        ((Date.now() - new Date(reward.vestingStartDate).getTime()) / 
         (reward.vestingPeriodDays * 24 * 60 * 60 * 1000)) * 100
      )
    : 100;
  
  const canClaim = reward.status === 'pending' && vestingProgress >= 100;
  const isClaimed = reward.status === 'claimed';
  
  const getRankBadge = (rank?: number) => {
    if (!rank) return null;
    if (rank === 1) return <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white"><Crown className="w-3 h-3 mr-1" /> 1st Place</Badge>;
    if (rank === 2) return <Badge className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900"><Award className="w-3 h-3 mr-1" /> 2nd Place</Badge>;
    if (rank === 3) return <Badge className="bg-gradient-to-r from-orange-400 to-orange-500 text-white"><Trophy className="w-3 h-3 mr-1" /> 3rd Place</Badge>;
    return <Badge variant="secondary">#{rank}</Badge>;
  };
  
  return (
    <Card className={`relative overflow-hidden ${isClaimed ? 'opacity-75' : ''}`}>
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent" />
      
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${
              isClaimed 
                ? 'bg-green-500/10 text-green-600' 
                : canClaim 
                ? 'bg-purple-500/10 text-purple-600 animate-pulse' 
                : 'bg-gray-500/10 text-gray-600'
            }`}>
              {isClaimed ? <Gift className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
            </div>
            <div>
              <CardTitle className="text-xl font-bold">
                {parseFloat(reward.amount).toLocaleString()} {reward.currency}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                {reward.weekEnding && (
                  <span>Week ending {new Date(reward.weekEnding).toLocaleDateString()}</span>
                )}
                {reward.rank && getRankBadge(reward.rank)}
              </CardDescription>
            </div>
          </div>
          
          <Badge 
            variant={
              isClaimed ? "default" : 
              canClaim ? "destructive" : 
              "secondary"
            }
            className={canClaim ? "animate-pulse" : ""}
          >
            {isClaimed ? '✓ Claimed' : canClaim ? 'Ready to Claim' : 'Vesting'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Vesting Progress */}
        {isVesting && !isClaimed && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-4 h-4" />
                Vesting Progress
              </span>
              <span className="font-semibold">{Math.round(vestingProgress)}%</span>
            </div>
            <Progress value={vestingProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {vestingProgress < 100 
                ? `${reward.vestingPeriodDays} day vesting period • ${formatDistanceToNow(new Date(new Date(reward.vestingStartDate!).getTime() + reward.vestingPeriodDays * 24 * 60 * 60 * 1000), { addSuffix: true })}`
                : 'Vesting complete!'}
            </p>
          </div>
        )}
        
        {/* Claim Information */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            {isClaimed ? (
              <span className="flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-green-600" />
                Claimed {formatDistanceToNow(new Date(reward.claimedAt!), { addSuffix: true })}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4" />
                Awarded {formatDistanceToNow(new Date(reward.awardedAt), { addSuffix: true })}
              </span>
            )}
          </div>
          
          {canClaim && onClaim && (
            <Button 
              onClick={() => onClaim(reward.id)}
              disabled={claiming}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {claiming ? 'Claiming...' : 'Claim Reward'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Crown({ className }: { className?: string }) {
  return <Trophy className={className} />;
}

