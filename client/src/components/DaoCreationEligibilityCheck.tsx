
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Shield, Phone } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EligibilityCheck {
  canCreate: boolean;
  reason?: string;
  cooldownEndsAt?: string;
}

export function DaoCreationEligibilityCheck() {
  const [eligibility, setEligibility] = useState<EligibilityCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkEligibility();
  }, []);

  const checkEligibility = async () => {
    try {
      const response = await fetch('/api/dao-abuse-prevention/check-eligibility', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setEligibility(data.data);
      }
    } catch (error) {
      console.error('Failed to check eligibility', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  if (!eligibility?.canCreate) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="ml-2">
          {eligibility?.reason}
          {eligibility?.cooldownEndsAt && (
            <div className="mt-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                Available: {new Date(eligibility.cooldownEndsAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="mb-6 bg-green-50 border-green-200">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-green-700">
          <Shield className="w-5 h-5" />
          <span className="font-medium">You're eligible to create a DAO</span>
          <Badge variant="secondary" className="ml-auto">Verified</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
