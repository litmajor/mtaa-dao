
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Info,
  TrendingUp,
  Shield,
  Users,
  Lock,
  Wallet,
  Settings,
  Sparkles
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { parseEther } from 'viem';

interface VaultFormData {
  name: string;
  description: string;
  vaultType: 'regular' | 'savings' | 'locked_savings' | 'yield' | 'dao_treasury';
  primaryCurrency: 'CELO' | 'cUSD' | 'cEUR' | 'USDT' | 'USDC' | 'MTAA';
  yieldStrategy?: string;
  riskLevel: 'low' | 'medium' | 'high';
  minDeposit: string;
  maxDeposit: string;
  daoId?: string;
  performanceFee?: string;
  managementFee?: string;
}

const VAULT_TYPES = [
  {
    id: 'regular' as const,
    name: 'Regular Vault',
    description: 'Standard vault for general purpose savings and investments',
    icon: Wallet,
    color: 'blue',
    features: ['Flexible deposits', 'No lock period', 'Standard yields']
  },
  {
    id: 'yield' as const,
    name: 'Yield Vault',
    description: 'Automated yield farming with DeFi strategies',
    icon: TrendingUp,
    color: 'green',
    features: ['Auto-compound', 'Multiple strategies', 'Higher returns']
  },
  {
    id: 'locked_savings' as const,
    name: 'Locked Savings',
    description: 'Time-locked vault with bonus rewards',
    icon: Lock,
    color: 'purple',
    features: ['Time-locked', 'Bonus rewards', 'Goal-based saving']
  },
  {
    id: 'dao_treasury' as const,
    name: 'DAO Treasury',
    description: 'Community-governed treasury vault',
    icon: Users,
    color: 'orange',
    features: ['Governance', 'Multi-sig', 'Transparent']
  }
];

const YIELD_STRATEGIES = [
  { id: 'mento_pool', name: 'Mento Liquidity Pool', apy: '8-12%', risk: 'low' },
  { id: 'ubeswap_lp', name: 'Ubeswap LP Farming', apy: '12-18%', risk: 'medium' },
  { id: 'moola_lending', name: 'Moola Money Market', apy: '6-10%', risk: 'low' },
  { id: 'multi_strategy', name: 'Multi-Strategy Portfolio', apy: '10-15%', risk: 'medium' }
];

const CURRENCIES = [
  { symbol: 'cUSD', name: 'Celo Dollar', stable: true },
  { symbol: 'CELO', name: 'Celo Native', stable: false },
  { symbol: 'cEUR', name: 'Celo Euro', stable: true },
  { symbol: 'USDT', name: 'Tether', stable: true }
];

export function VaultCreationWizard({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: (vaultId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { address } = useAccount();

  const [formData, setFormData] = useState<VaultFormData>({
    name: '',
    description: '',
    vaultType: 'regular',
    primaryCurrency: 'cUSD',
    riskLevel: 'low',
    minDeposit: '10',
    maxDeposit: '1000000',
    performanceFee: '15',
    managementFee: '2'
  });

  const updateField = (field: keyof VaultFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        if (!formData.name || formData.name.length < 3) {
          setError('Vault name must be at least 3 characters');
          return false;
        }
        if (!formData.description) {
          setError('Please provide a description');
          return false;
        }
        return true;
      case 2:
        if (parseFloat(formData.minDeposit) <= 0) {
          setError('Minimum deposit must be greater than 0');
          return false;
        }
        if (parseFloat(formData.maxDeposit) < parseFloat(formData.minDeposit)) {
          setError('Maximum deposit must be greater than minimum');
          return false;
        }
        return true;
      case 3:
        if (formData.vaultType === 'yield' && !formData.yieldStrategy) {
          setError('Please select a yield strategy');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    setError('');
  };

  const handleSubmit = async () => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create vault');
      }

      const { vault } = await response.json();
      onSuccess(vault.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create vault');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVaultTypeConfig = () => {
    return VAULT_TYPES.find(v => v.id === formData.vaultType);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map((stepNum) => (
        <React.Fragment key={stepNum}>
          <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
            stepNum <= step 
              ? 'bg-blue-600 border-blue-600 text-white' 
              : 'border-gray-300 text-gray-400'
          }`}>
            {stepNum < step ? <CheckCircle className="w-5 h-5" /> : stepNum}
          </div>
          {stepNum < 4 && (
            <div className={`w-16 h-0.5 ${stepNum < step ? 'bg-blue-600' : 'bg-gray-300'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            Create Investment Vault
          </CardTitle>
          <CardDescription>
            Step {step} of 4: {step === 1 && 'Basic Information'}
            {step === 2 && 'Vault Configuration'}
            {step === 3 && 'Strategy & Risk'}
            {step === 4 && 'Review & Create'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {renderStepIndicator()}

          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="vaultName">Vault Name *</Label>
                  <Input
                    id="vaultName"
                    placeholder="e.g., Community Growth Fund"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the purpose and goals of this vault..."
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="mt-1"
                    rows={4}
                  />
                </div>

                <div>
                  <Label className="mb-3 block">Vault Type *</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {VAULT_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = formData.vaultType === type.id;
                      return (
                        <Card
                          key={type.id}
                          className={`cursor-pointer transition-all ${
                            isSelected 
                              ? 'ring-2 ring-blue-600 bg-blue-50' 
                              : 'hover:shadow-md'
                          }`}
                          onClick={() => updateField('vaultType', type.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg bg-${type.color}-100`}>
                                <Icon className={`w-5 h-5 text-${type.color}-600`} />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold mb-1">{type.name}</h4>
                                <p className="text-xs text-gray-600 mb-2">{type.description}</p>
                                <div className="flex flex-wrap gap-1">
                                  {type.features.slice(0, 2).map((feature, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {feature}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="currency">Primary Currency *</Label>
                <Select 
                  value={formData.primaryCurrency} 
                  onValueChange={(value) => updateField('primaryCurrency', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.symbol} value={currency.symbol}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{currency.symbol}</span>
                          <span className="text-sm text-gray-500">- {currency.name}</span>
                          {currency.stable && (
                            <Badge variant="outline" className="text-xs">Stable</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minDeposit">Minimum Deposit *</Label>
                  <Input
                    id="minDeposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minDeposit}
                    onChange={(e) => updateField('minDeposit', e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    in {formData.primaryCurrency}
                  </p>
                </div>

                <div>
                  <Label htmlFor="maxDeposit">Maximum Deposit</Label>
                  <Input
                    id="maxDeposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.maxDeposit}
                    onChange={(e) => updateField('maxDeposit', e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave at 1M for unlimited
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="performanceFee">Performance Fee (%)</Label>
                  <Input
                    id="performanceFee"
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    value={formData.performanceFee}
                    onChange={(e) => updateField('performanceFee', e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fee on profits (max 20%)
                  </p>
                </div>

                <div>
                  <Label htmlFor="managementFee">Management Fee (%)</Label>
                  <Input
                    id="managementFee"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={formData.managementFee}
                    onChange={(e) => updateField('managementFee', e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Annual fee (max 5%)
                  </p>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Fees help sustain vault operations and incentivize performance. 
                  Recommended: 15% performance fee, 2% management fee.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 3: Strategy & Risk */}
          {step === 3 && (
            <div className="space-y-6">
              {formData.vaultType === 'yield' && (
                <div>
                  <Label className="mb-3 block">Yield Strategy *</Label>
                  <div className="space-y-3">
                    {YIELD_STRATEGIES.map((strategy) => (
                      <Card
                        key={strategy.id}
                        className={`cursor-pointer transition-all ${
                          formData.yieldStrategy === strategy.id
                            ? 'ring-2 ring-blue-600 bg-blue-50'
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => updateField('yieldStrategy', strategy.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{strategy.name}</h4>
                              <p className="text-sm text-gray-600">
                                Expected APY: {strategy.apy}
                              </p>
                            </div>
                            <Badge 
                              variant={strategy.risk === 'low' ? 'default' : 'outline'}
                              className={
                                strategy.risk === 'low' ? 'bg-green-100 text-green-800' :
                                strategy.risk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }
                            >
                              {strategy.risk} risk
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="mb-3 block">Risk Level *</Label>
                <div className="grid grid-cols-3 gap-4">
                  {(['low', 'medium', 'high'] as const).map((risk) => (
                    <Card
                      key={risk}
                      className={`cursor-pointer transition-all ${
                        formData.riskLevel === risk
                          ? 'ring-2 ring-blue-600 bg-blue-50'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => updateField('riskLevel', risk)}
                    >
                      <CardContent className="p-4 text-center">
                        <Shield className={`w-8 h-8 mx-auto mb-2 ${
                          risk === 'low' ? 'text-green-600' :
                          risk === 'medium' ? 'text-yellow-600' :
                          'text-red-600'
                        }`} />
                        <h4 className="font-semibold capitalize">{risk}</h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {risk === 'low' && 'Conservative, stable returns'}
                          {risk === 'medium' && 'Balanced risk-reward'}
                          {risk === 'high' && 'Aggressive, higher returns'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Risk level determines investment strategies and asset allocation. 
                  This setting cannot be changed after vault creation.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-6">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Review your vault configuration carefully. Once created, some settings cannot be changed.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Vault Name</Label>
                    <p className="font-semibold">{formData.name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Vault Type</Label>
                    <p className="font-semibold capitalize">
                      {getVaultTypeConfig()?.name}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-500">Description</Label>
                  <p className="text-sm">{formData.description}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-500">Currency</Label>
                    <p className="font-semibold">{formData.primaryCurrency}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Min Deposit</Label>
                    <p className="font-semibold">
                      {formData.minDeposit} {formData.primaryCurrency}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Max Deposit</Label>
                    <p className="font-semibold">
                      {formData.maxDeposit} {formData.primaryCurrency}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Performance Fee</Label>
                    <p className="font-semibold">{formData.performanceFee}%</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Management Fee</Label>
                    <p className="font-semibold">{formData.managementFee}%</p>
                  </div>
                </div>

                {formData.vaultType === 'yield' && formData.yieldStrategy && (
                  <div>
                    <Label className="text-gray-500">Yield Strategy</Label>
                    <p className="font-semibold">
                      {YIELD_STRATEGIES.find(s => s.id === formData.yieldStrategy)?.name}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-gray-500">Risk Level</Label>
                  <Badge className={
                    formData.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                    formData.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }>
                    {formData.riskLevel.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div>
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              
              {step < 4 ? (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  {isSubmitting ? (
                    <>
                      <Settings className="w-4 h-4 mr-2 animate-spin" />
                      Creating Vault...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Create Vault
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default VaultCreationWizard;
