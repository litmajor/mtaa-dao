
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Star, Clock, Users, DollarSign } from 'lucide-react';

interface TierFeature {
  name: string;
  free: boolean | string;
  shortTerm: boolean | string;
  collective: boolean | string;
}

const TIER_FEATURES: TierFeature[] = [
  { name: 'Maximum Members', free: '10', shortTerm: '50', collective: 'Unlimited' },
  { name: 'Treasury Limit', free: '₭5,000', shortTerm: '₭50,000', collective: 'Unlimited' },
  { name: 'Duration', free: '30 days', shortTerm: '60 days*', collective: 'Unlimited' },
  { name: 'Voting Features', free: true, shortTerm: true, collective: true },
  { name: 'Multisig Security', free: false, shortTerm: true, collective: true },
  { name: 'Custom Rules', free: false, shortTerm: false, collective: true },
  { name: 'Multiple Vaults', free: false, shortTerm: false, collective: true },
  { name: 'Analytics Dashboard', free: false, shortTerm: false, collective: true },
  { name: 'Priority Support', free: false, shortTerm: false, collective: true },
];

interface DaoTierRequirementsProps {
  currentTier?: 'free' | 'short-term' | 'collective';
  onUpgrade?: (tier: 'short-term' | 'collective') => void;
  showUpgradeButton?: boolean;
}

export function DaoTierRequirements({ 
  currentTier = 'free', 
  onUpgrade,
  showUpgradeButton = true 
}: DaoTierRequirementsProps) {
  
  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-gray-300" />
      );
    }
    return <span className="text-sm">{value}</span>;
  };

  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-blue-600" />
          DAO Tier Comparison
        </CardTitle>
        <p className="text-sm text-gray-600">
          Understanding what each tier offers
        </p>
      </CardHeader>
      <CardContent>
        {/* Current Tier Badge */}
        <div className="mb-4">
          <Badge className="bg-blue-600 text-white">
            Your Current Tier: {currentTier.toUpperCase()}
          </Badge>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Feature</th>
                <th className="text-center p-2">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">Free Tier</span>
                    <span className="text-xs text-gray-600">Learning</span>
                  </div>
                </th>
                <th className="text-center p-2">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">Short-Term</span>
                    <span className="text-xs text-gray-600">₭500</span>
                  </div>
                </th>
                <th className="text-center p-2">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">Collective</span>
                    <span className="text-xs text-gray-600">₭1.5K/mo</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {TIER_FEATURES.map((feature, index) => (
                <tr key={index} className="border-b hover:bg-white/50">
                  <td className="p-2">{feature.name}</td>
                  <td className="p-2 text-center">
                    {renderFeatureValue(feature.free)}
                  </td>
                  <td className="p-2 text-center">
                    {renderFeatureValue(feature.shortTerm)}
                  </td>
                  <td className="p-2 text-center">
                    {renderFeatureValue(feature.collective)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tier Explanations */}
        <div className="mt-4 space-y-3">
          <div className="bg-white p-3 rounded border-l-4 border-gray-400">
            <h4 className="font-semibold text-sm mb-1">🎓 Free Tier (Learning DAO)</h4>
            <p className="text-xs text-gray-600">
              Perfect for learning how DAOs work. Try out governance, voting, and basic treasury management.
              Automatically expires after 30 days or when limits are hit.
            </p>
          </div>

          <div className="bg-white p-3 rounded border-l-4 border-orange-400">
            <h4 className="font-semibold text-sm mb-1">⏰ Short-Term DAO (₭500 one-time)</h4>
            <p className="text-xs text-gray-600">
              For specific projects with a deadline (fundraisers, events, short campaigns).
              60 days duration with 2 possible extensions. Includes security features.
              <span className="block mt-1 text-xs italic">*Can extend twice at ₭500 each (halved duration each time)</span>
            </p>
          </div>

          <div className="bg-white p-3 rounded border-l-4 border-teal-400">
            <h4 className="font-semibold text-sm mb-1">💎 Collective DAO (₭1,500/month)</h4>
            <p className="text-xs text-gray-600">
              For ongoing organizations, investment clubs, and long-term communities.
              No limits on members or treasury. Full features including analytics and priority support.
            </p>
          </div>
        </div>

        {/* Upgrade Buttons */}
        {showUpgradeButton && currentTier !== 'collective' && onUpgrade && (
          <div className="mt-4 space-y-2">
            {currentTier === 'free' && (
              <>
                <Button
                  onClick={() => onUpgrade('short-term')}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Upgrade to Short-Term (₭500)
                </Button>
                <Button
                  onClick={() => onUpgrade('collective')}
                  variant="outline"
                  className="w-full border-teal-600 text-teal-600 hover:bg-teal-50"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Upgrade to Collective (₭1,500/mo)
                </Button>
              </>
            )}
            {currentTier === 'short-term' && (
              <Button
                onClick={() => onUpgrade('collective')}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                <Users className="h-4 w-4 mr-2" />
                Upgrade to Collective (₭1,500/mo)
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
