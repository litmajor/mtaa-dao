
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiPost, apiGet } from '@/lib/api';

export default function KYCPage() {
  const [kycLevel, setKycLevel] = useState<'none' | 'basic' | 'intermediate' | 'advanced'>('none');
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    address: '',
    phoneNumber: '',
    idType: 'passport',
    idNumber: '',
  });

  const handleSubmitKYC = async (level: string) => {
    try {
      const result = await apiPost('/api/kyc/submit', { ...formData, level });
      toast({ title: 'Success', description: 'KYC submitted for review' });
      setVerificationStatus(result.status);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const EXCHANGE_RATE = 129; // KES per USD
  
  const tiers = [
    { 
      level: 'none', 
      dailyLimit: 100,
      monthlyLimit: 3000,
      requirements: 'No verification needed', 
      color: 'bg-gray-500' 
    },
    { 
      level: 'basic', 
      dailyLimit: 1000,
      monthlyLimit: 30000,
      requirements: 'Email + Phone', 
      color: 'bg-blue-500' 
    },
    { 
      level: 'intermediate', 
      dailyLimit: 5000,
      monthlyLimit: 150000,
      requirements: 'ID Document', 
      color: 'bg-purple-500' 
    },
    { 
      level: 'advanced', 
      dailyLimit: 10000,
      monthlyLimit: 300000,
      requirements: 'Full KYC + Address Proof', 
      color: 'bg-green-500' 
    },
  ];

  const formatCurrency = (usd: number) => {
    const kes = usd * EXCHANGE_RATE;
    return `${kes.toLocaleString('en-US')} KES [$${usd.toLocaleString('en-US')}]`;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8" />
          KYC Verification
        </h1>
        <p className="text-muted-foreground">Increase your transaction limits with identity verification</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current Tier: {kycLevel.toUpperCase()}</CardTitle>
          {tiers.find(t => t.level === kycLevel) && (
            <CardDescription className="space-y-1">
              <div>Daily Limit: {formatCurrency(tiers.find(t => t.level === kycLevel)?.dailyLimit || 0)}</div>
              <div>Monthly Limit: {formatCurrency(tiers.find(t => t.level === kycLevel)?.monthlyLimit || 0)}</div>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Progress value={(tiers.findIndex(t => t.level === kycLevel) + 1) * 25} className="mb-4" />
        </CardContent>
      </Card>

      <div className="grid gap-4 mb-6">
        {tiers.map((tier) => (
          <Card key={tier.level} className={kycLevel === tier.level ? 'border-2 border-primary' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {tier.level.toUpperCase()}
                    {kycLevel === tier.level && <Badge>Current</Badge>}
                  </CardTitle>
                  <CardDescription>{tier.requirements}</CardDescription>
                </div>
                <div className="text-right space-y-2">
                  <div>
                    <div className="font-bold text-lg">{formatCurrency(tier.dailyLimit)}</div>
                    <div className="text-xs text-muted-foreground">Daily Limit</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg">{formatCurrency(tier.monthlyLimit)}</div>
                    <div className="text-xs text-muted-foreground">Monthly Limit</div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verify Your Identity</CardTitle>
          <CardDescription>Complete the form to upgrade your verification level</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div>
            <Label>Phone Number</Label>
            <Input
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ID Type</Label>
              <select
                className="w-full p-2 border rounded"
                value={formData.idType}
                onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
              >
                <option value="passport">Passport</option>
                <option value="drivers_license">Driver's License</option>
                <option value="national_id">National ID</option>
              </select>
            </div>
            <div>
              <Label>ID Number</Label>
              <Input
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Upload ID Document</Label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button onClick={() => handleSubmitKYC('basic')} className="flex-1">
              Submit Basic KYC
            </Button>
            <Button onClick={() => handleSubmitKYC('intermediate')} variant="outline" className="flex-1">
              Submit Intermediate KYC
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
