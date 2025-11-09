
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface ExtensionInfo {
  number: number;
  duration: number;
  expiresAt: string;
  extensionsRemaining: number;
  nextExtensionDuration: number | null;
  upgradeRecommended: boolean;
}

interface ShortTermDaoExtensionProps {
  daoId: string;
  currentPlan: string;
  daoType: string;
  extensionCount: number;
  planExpiresAt: string;
  originalDuration: number;
}

export function ShortTermDaoExtension({
  daoId,
  currentPlan,
  daoType,
  extensionCount,
  planExpiresAt,
  originalDuration
}: ShortTermDaoExtensionProps) {
  const [isExtending, setIsExtending] = useState(false);
  const [extensionResult, setExtensionResult] = useState<ExtensionInfo | null>(null);
  
  if (daoType !== 'short_term') {
    return null;
  }
  
  const daysRemaining = Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const maxExtensions = 2;
  const extensionsRemaining = maxExtensions - extensionCount;
  
  const handleExtend = async () => {
    setIsExtending(true);
    try {
      const response = await fetch(`/api/dao-subscriptions/${daoId}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setExtensionResult(data.extension);
      } else if (data.upgradeRequired) {
        // Show upgrade modal
        alert(data.message);
      }
    } catch (error) {
      console.error('Extension failed:', error);
    } finally {
      setIsExtending(false);
    }
  };
  
  const handleUpgrade = async () => {
    try {
      const response = await fetch(`/api/dao-subscriptions/${daoId}/upgrade-to-collective`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ paymentMethod: 'treasury' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
    }
  };
  
  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-600" />
          Short-Term DAO Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Days Remaining</p>
            <p className="text-2xl font-bold text-orange-600">{daysRemaining}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Extensions Used</p>
            <p className="text-2xl font-bold">{extensionCount} / {maxExtensions}</p>
          </div>
        </div>
        
        {/* Extension Options */}
        {extensionsRemaining > 0 ? (
          <Alert>
            <AlertDescription className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Extension Available</p>
                  <p className="text-sm text-gray-600">
                    Extend for {Math.floor((originalDuration || 30) / Math.pow(2, extensionCount + 1))} more days at ₭500
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Each extension is half the previous duration (Strategic Hybrid Model)
                  </p>
                </div>
              </div>
              
              <Button 
                onClick={handleExtend} 
                disabled={isExtending}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {isExtending ? 'Extending...' : `Extend DAO (₭500)`}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <p className="font-medium">Maximum Extensions Reached</p>
              <p className="text-sm mt-1">
                Upgrade to Collective DAO for unlimited duration
              </p>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Upgrade Recommendation */}
        <div className="bg-white rounded-lg p-4 border border-teal-200">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-teal-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">Upgrade to Collective DAO</h4>
              <p className="text-sm text-gray-600 mt-1">
                ₭1,500/month • Unlimited duration • Advanced features
              </p>
              <ul className="text-xs text-gray-600 mt-2 space-y-1">
                <li>• No expiration dates</li>
                <li>• Multiple vaults</li>
                <li>• Advanced governance</li>
                <li>• Priority support</li>
              </ul>
              <Button 
                onClick={handleUpgrade}
                variant="outline"
                className="w-full mt-3 border-teal-600 text-teal-600 hover:bg-teal-50"
              >
                Upgrade Now
              </Button>
            </div>
          </div>
        </div>
        
        {/* Extension History */}
        {extensionCount > 0 && (
          <div className="text-xs text-gray-500">
            <p className="font-medium">Extension History:</p>
            <ul className="mt-1 space-y-1">
              {Array.from({ length: extensionCount }, (_, i) => (
                <li key={i}>
                  Extension {i + 1}: {Math.floor(originalDuration / Math.pow(2, i + 1))} days (₭500)
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
