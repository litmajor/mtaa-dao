
import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle, Users, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface VerificationStatus {
  isVerified: boolean;
  verificationScore: number;
  socialProofCount: number;
  requiredSocialProof: number;
  hasIdentityNft: boolean;
}

interface DaoVerificationBadgeProps {
  daoId: string;
  onVerify?: () => void;
}

export function DaoVerificationBadge({ daoId, onVerify }: DaoVerificationBadgeProps) {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerificationStatus();
  }, [daoId]);

  const fetchVerificationStatus = async () => {
    try {
      const response = await fetch(`/api/dao-abuse-prevention/status/${daoId}`);
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch verification status', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      const response = await fetch(`/api/dao-abuse-prevention/verify/${daoId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ verificationType: 'member_invite' })
      });

      const data = await response.json();
      if (data.success) {
        fetchVerificationStatus();
        onVerify?.();
      }
    } catch (error) {
      console.error('Failed to verify DAO', error);
    }
  };

  if (loading) return null;

  const progress = status ? (status.socialProofCount / status.requiredSocialProof) * 100 : 0;

  return (
    <Card className="border-2 border-dashed border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5 text-purple-600" />
          DAO Verification Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.isVerified ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-6 h-6" />
            <span className="font-semibold">Verified DAO</span>
            {status.hasIdentityNft && (
              <Badge variant="secondary" className="ml-2">
                <Award className="w-3 h-3 mr-1" />
                NFT Minted
              </Badge>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Social Proof Progress</span>
              <span className="font-medium">
                {status?.socialProofCount} / {status?.requiredSocialProof}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500">
              Need {status?.requiredSocialProof} community verifications to unlock full features
            </p>
            <Button 
              onClick={handleVerify} 
              size="sm" 
              className="w-full"
              variant="outline"
            >
              <Users className="w-4 h-4 mr-2" />
              Verify This DAO
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
