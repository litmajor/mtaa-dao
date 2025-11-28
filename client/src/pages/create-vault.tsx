import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Lock, Shield, DollarSign, Target, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

interface VaultConfig {
  name: string;
  description: string;
  currency: string;
  monthlyGoal: number;
  riskLevel: string;
  minDeposit: number;
  maxDeposit: number;
  lockDuration: number;
  yieldStrategy: string;
}

export default function CreateVaultPage() {
  const [step, setStep] = useState<'basic' | 'advanced' | 'review'>('basic');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [config, setConfig] = useState<VaultConfig>({
    name: '',
    description: '',
    currency: 'cUSD',
    monthlyGoal: 0,
    riskLevel: 'moderate',
    minDeposit: 0,
    maxDeposit: 0,
    lockDuration: 0,
    yieldStrategy: 'balanced'
  });

  const handleInputChange = (field: keyof VaultConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateVault = async () => {
    if (!config.name || !config.description) {
      toast({ title: 'Error', description: 'Name and description are required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/vaults/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Failed to create vault');
      }

      const data = await response.json();
      toast({ title: 'Success', description: 'Vault created successfully!' });
      setTimeout(() => window.location.href = '/vault-overview', 1500);
    } catch (err) {
      toast({ 
        title: 'Error', 
        description: err instanceof Error ? err.message : 'Failed to create vault',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderBasicStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="vault-name">Vault Name</Label>
        <Input
          id="vault-name"
          placeholder="e.g., Emergency Fund"
          value={config.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vault-desc">Description</Label>
        <Textarea
          id="vault-desc"
          placeholder="What is this vault for?"
          value={config.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          rows={4}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={config.currency} onValueChange={(v) => handleInputChange('currency', v)}>
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cUSD">cUSD</SelectItem>
              <SelectItem value="CELO">CELO</SelectItem>
              <SelectItem value="cEUR">cEUR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthly-goal">Monthly Goal</Label>
          <Input
            id="monthly-goal"
            type="number"
            placeholder="0"
            value={config.monthlyGoal}
            onChange={(e) => handleInputChange('monthlyGoal', parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );

  const renderAdvancedStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="risk-level">Risk Level</Label>
          <Select value={config.riskLevel} onValueChange={(v) => handleInputChange('riskLevel', v)}>
            <SelectTrigger id="risk-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low (Stable)</SelectItem>
              <SelectItem value="moderate">Moderate (Balanced)</SelectItem>
              <SelectItem value="high">High (Growth)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lock-duration">Lock Duration (days)</Label>
          <Input
            id="lock-duration"
            type="number"
            placeholder="0"
            value={config.lockDuration}
            onChange={(e) => handleInputChange('lockDuration', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min-deposit">Min Deposit</Label>
          <Input
            id="min-deposit"
            type="number"
            placeholder="0"
            value={config.minDeposit}
            onChange={(e) => handleInputChange('minDeposit', parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-deposit">Max Deposit</Label>
          <Input
            id="max-deposit"
            type="number"
            placeholder="0"
            value={config.maxDeposit}
            onChange={(e) => handleInputChange('maxDeposit', parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="yield-strategy">Yield Strategy</Label>
        <Select value={config.yieldStrategy} onValueChange={(v) => handleInputChange('yieldStrategy', v)}>
          <SelectTrigger id="yield-strategy">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stable">Stable (Fixed APY)</SelectItem>
            <SelectItem value="balanced">Balanced (Mixed Strategy)</SelectItem>
            <SelectItem value="aggressive">Aggressive (DeFi Yields)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>Review your vault configuration before creating</AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Name</p>
            <p className="font-semibold">{config.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Currency</p>
            <p className="font-semibold">{config.currency}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Risk Level</p>
            <Badge className="mt-2">{config.riskLevel}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Monthly Goal</p>
            <p className="font-semibold">{config.monthlyGoal}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600">{config.description}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link to="/vault-overview" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Vaults
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Vault</h1>
          <p className="text-gray-600 mt-2">Set up a new savings vault with custom goals and strategies</p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div className={`flex flex-col items-center ${step === 'basic' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 ${step === 'basic' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>1</div>
              <span className="text-sm">Basic Info</span>
            </div>
            <div className="flex-1 h-1 bg-gray-300 mx-2 mt-5"></div>
            <div className={`flex flex-col items-center ${step === 'advanced' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 ${step === 'advanced' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>2</div>
              <span className="text-sm">Advanced</span>
            </div>
            <div className="flex-1 h-1 bg-gray-300 mx-2 mt-5"></div>
            <div className={`flex flex-col items-center ${step === 'review' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 ${step === 'review' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>3</div>
              <span className="text-sm">Review</span>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 'basic' && 'Basic Information'}
              {step === 'advanced' && 'Advanced Settings'}
              {step === 'review' && 'Review & Create'}
            </CardTitle>
            <CardDescription>
              {step === 'basic' && 'Tell us about your vault'}
              {step === 'advanced' && 'Configure vault parameters'}
              {step === 'review' && 'Confirm your settings'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 'basic' && renderBasicStep()}
            {step === 'advanced' && renderAdvancedStep()}
            {step === 'review' && renderReviewStep()}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t">
              {step !== 'basic' && (
                <Button variant="outline" onClick={() => setStep(step === 'advanced' ? 'basic' : 'advanced')}>
                  Back
                </Button>
              )}
              <div className="flex-1"></div>
              {step !== 'review' && (
                <Button onClick={() => setStep(step === 'basic' ? 'advanced' : 'review')}>
                  Next
                </Button>
              )}
              {step === 'review' && (
                <Button onClick={handleCreateVault} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Vault'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
