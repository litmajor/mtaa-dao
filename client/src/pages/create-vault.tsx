import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Lock, Shield, DollarSign, Target, Users, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { authClient } from '@/utils/authClient';
import { DAOOrchestratorProvider, useDAOOrchestrator } from '@/context/daoOrchestratorSystem';
import {
  SystemHealthBanner,
  AdaptiveReadinessMeter,
  WarningsAndSuggestionsPanel,
  RiskLevelBadge,
} from '@/components/dao-creation/AdaptiveUIComponents';

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

function CreateVaultContent() {
  const [step, setStep] = useState<'basic' | 'advanced' | 'review'>('basic');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const orchestrator = useDAOOrchestrator();
  
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

  // Update orchestrator metrics based on vault config
  useEffect(() => {
    let vaultReadiness = 0;
    if (config.name) vaultReadiness += 20;
    if (config.description) vaultReadiness += 20;
    if (config.monthlyGoal > 0) vaultReadiness += 15;
    if (config.minDeposit > 0 && config.maxDeposit > 0) vaultReadiness += 15;
    if (config.lockDuration > 0) vaultReadiness += 15;
    if (step === 'review') vaultReadiness = Math.min(100, vaultReadiness + 15);

    let riskScore = 0;
    if (config.riskLevel === 'low') riskScore = 20;
    if (config.riskLevel === 'moderate') riskScore = 50;
    if (config.riskLevel === 'high') riskScore = 75;
    if (config.yieldStrategy === 'aggressive') riskScore += 15;
    if (config.yieldStrategy === 'balanced') riskScore += 5;
    if (config.maxDeposit > 50000) riskScore = Math.max(riskScore - 10, 20);

    const confidenceFromLock = Math.min(config.lockDuration / 30, 20);

    orchestrator.actions.updateTreasuryMetrics({
      treasuryReadiness: vaultReadiness,
      treasuryRisk: Math.min(100, riskScore),
      capitalAllocationHealth: Math.min(100, 50 + confidenceFromLock),
    });

    const modeMap = {
      'basic': 'definition' as const,
      'advanced': 'capital' as const,
      'review': 'execution' as const,
    };
    orchestrator.actions.setOperationalMode(modeMap[step]);
  }, [config, step]);

  const getValidationState = () => {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!config.name) issues.push('Vault name is required');
    if (!config.description) issues.push('Description helps members understand the vault purpose');
    if (config.minDeposit > config.maxDeposit && config.maxDeposit > 0) {
      issues.push('Minimum deposit cannot exceed maximum deposit');
    }

    if (config.riskLevel === 'high' && config.lockDuration < 30) {
      suggestions.push('Consider longer lock duration with high-risk strategies');
    }
    if (config.monthlyGoal > 0 && config.minDeposit === 0) {
      suggestions.push('Set minimum deposit to ensure consistent growth toward goal');
    }
    if (config.maxDeposit > 0 && config.minDeposit > config.maxDeposit * 0.8) {
      suggestions.push('High minimum deposit may limit participation');
    }
    if (config.riskLevel === 'low' && config.yieldStrategy === 'aggressive') {
      issues.push('Low risk level conflicts with aggressive yield strategy');
    }

    return { issues, suggestions };
  };

  const validation = getValidationState();

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
      const data = await authClient.post('/api/v1/wallets/vaults', config);
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
      <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">✓ Your vault is ready. Review the configuration below and create!</AlertDescription>
      </Alert>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Vault Readiness</span>
          <span className="text-sm font-bold text-blue-600">{orchestrator.state.overallReadiness}%</span>
        </div>
        <Progress value={orchestrator.state.overallReadiness} className="h-2" />
      </div>

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link to="/vault-overview" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Vaults
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Vault</h1>
              <p className="text-gray-600 mt-2">Set up a new savings vault with custom goals and strategies</p>
            </div>
            <RiskLevelBadge />
          </div>
        </div>

        {/* SYSTEM HEALTH STATUS */}
        <div className="mb-6 space-y-3">
          <SystemHealthBanner />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <WarningsAndSuggestionsPanel />
            </div>
            <AdaptiveReadinessMeter />
          </div>
        </div>

        {/* Validation Messages */}
        {validation.issues.length > 0 && (
          <Alert className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              <div className="space-y-1">
                {validation.issues.map((issue, idx) => (
                  <div key={idx}>• {issue}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

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
        <Card className={orchestrator.helpers.surfaceClass('moderate')}>
          <CardHeader>
            <CardTitle>
              {step === 'basic' && '💾 Basic Information'}
              {step === 'advanced' && '⚙️ Advanced Settings'}
              {step === 'review' && '✓ Review & Create'}
            </CardTitle>
            <CardDescription>
              {step === 'basic' && 'Tell us about your vault'}
              {step === 'advanced' && 'Configure vault parameters and risk profile'}
              {step === 'review' && `Confirm your ${config.name || 'vault'} settings`}
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
                <Button 
                  onClick={() => setStep(step === 'basic' ? 'advanced' : 'review')}
                  disabled={validation.issues.length > 0}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  Next →
                </Button>
              )}
              {step === 'review' && (
                <Button 
                  onClick={handleCreateVault} 
                  disabled={loading || validation.issues.length > 0}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  {loading ? '⏳ Creating...' : '🚀 Create Vault'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CreateVaultPage() {
  return (
    <DAOOrchestratorProvider>
      <CreateVaultContent />
    </DAOOrchestratorProvider>
  );
}
