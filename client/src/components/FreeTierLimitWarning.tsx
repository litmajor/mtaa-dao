
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Clock, Users, DollarSign, TrendingUp } from 'lucide-react';

interface FreeTierLimitWarningProps {
  daoId: string;
  onUpgrade: () => void;
}

export function FreeTierLimitWarning({ daoId, onUpgrade }: FreeTierLimitWarningProps) {
  const [limitStatus, setLimitStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLimitStatus();
  }, [daoId]);

  const fetchLimitStatus = async () => {
    try {
      const response = await fetch(`/api/dao-subscriptions/${daoId}/check-limits`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.isFreeTier) {
        setLimitStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch limit status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !limitStatus?.isFreeTier) {
    return null;
  }

  const { current, limits, violations, upgradeRequired } = limitStatus;

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-5 h-5" />
          Free Tier Learning DAO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Limits Overview */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-white rounded-lg">
            <Users className="w-4 h-4 mx-auto mb-1 text-gray-600" />
            <p className="text-xs text-gray-600">Members</p>
            <p className={`text-lg font-bold ${current.members > limits.maxMembers ? 'text-red-600' : 'text-gray-900'}`}>
              {current.members}/{limits.maxMembers}
            </p>
          </div>
          
          <div className="text-center p-3 bg-white rounded-lg">
            <DollarSign className="w-4 h-4 mx-auto mb-1 text-gray-600" />
            <p className="text-xs text-gray-600">Treasury</p>
            <p className={`text-lg font-bold ${current.treasuryBalance > limits.maxTreasuryBalance ? 'text-red-600' : 'text-gray-900'}`}>
              ₭{current.treasuryBalance.toFixed(0)}
            </p>
            <p className="text-xs text-gray-500">Max: ₭{limits.maxTreasuryBalance}</p>
          </div>
          
          <div className="text-center p-3 bg-white rounded-lg">
            <Clock className="w-4 h-4 mx-auto mb-1 text-gray-600" />
            <p className="text-xs text-gray-600">Days Left</p>
            <p className={`text-lg font-bold ${current.daysRemaining <= 3 ? 'text-red-600' : 'text-gray-900'}`}>
              {current.daysRemaining}
            </p>
          </div>
        </div>

        {/* Violations */}
        {violations && violations.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <p className="font-medium mb-2">⚠️ Limit Violations:</p>
              <ul className="text-sm space-y-1">
                {violations.map((violation: string, idx: number) => (
                  <li key={idx}>• {violation}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Upgrade CTA */}
        {upgradeRequired ? (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-bold mb-1">Upgrade Required</h4>
                <p className="text-sm mb-3">
                  Your DAO has exceeded Free Tier limits. Upgrade to continue operating.
                </p>
                <Button 
                  onClick={onUpgrade}
                  className="w-full bg-white text-orange-600 hover:bg-gray-100"
                >
                  Upgrade to Short-Term DAO (₭500)
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Alert>
            <AlertDescription className="text-sm">
              <p className="font-medium mb-1">💡 Free Tier Purpose</p>
              <p>Learn and test DAO mechanics. Ready for real impact? Upgrade to unlock full features.</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Upgrade Path */}
        <div className="text-xs text-gray-600 border-t pt-3">
          <p className="font-medium mb-2">Upgrade Path:</p>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-amber-100 rounded">Free (Learn)</span>
            <span>→</span>
            <span className="px-2 py-1 bg-orange-100 rounded">Short-Term ₭500</span>
            <span>→</span>
            <span className="px-2 py-1 bg-teal-100 rounded">Collective ₭1.5K/mo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
