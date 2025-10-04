import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'; // Assuming Shadcn has Tooltip or add Radix
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  Sparkles,
  DollarSign
} from 'lucide-react';
import { useAccount, useBalance } from 'wagmi';
import { parseEther } from 'viem';

interface VaultFormData {
  name: string;
  description: string;
  vaultType: 'regular' | 'savings' | 'locked_savings' | 'yield' | 'dao_treasury';
  primaryCurrency: 'CELO' | 'cUSD' | 'cEUR' | 'cREAL' | 'USDT' | 'USDC' | 'VEUR' | 'MTAA';
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
  { id: 'mento_pool', name: 'Mento Liquidity Pool', apy: '6-10%', risk: 'low' },
  { id: 'ubeswap_lp', name: 'Ubeswap LP Farming', apy: '10-20%', risk: 'medium' },
  { id: 'beefy_compound', name: 'Beefy Auto-Compounding', apy: '8-15%', risk: 'low' },
  { id: 'multi_strategy', name: 'Multi-Strategy (incl. Restaking)', apy: '12-18%', risk: 'medium' }
];

const CURRENCIES = [
  { symbol: 'cUSD', name: 'Celo Dollar', stable: true },
  { symbol: 'CELO', name: 'Celo Native', stable: false },
  { symbol: 'cEUR', name: 'Celo Euro', stable: true },
  { symbol: 'cREAL', name: 'Celo Real', stable: true },
  { symbol: 'USDT', name: 'Tether (Native)', stable: true },
  { symbol: 'USDC', name: 'USD Coin (Native)', stable: true },
  { symbol: 'VEUR', name: 'VNX Euro', stable: true },
  { symbol: 'MTAA', name: 'MtaaDAO Token', stable: false }
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
  const [showConfirm, setShowConfirm] = useState(false);
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

  const { address } = useAccount();
  const { data: balance } = useBalance({ address, token: formData.primaryCurrency === 'CELO' ? undefined : '0x...' }); // Add token addresses

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
        if (!formData.description || formData.description.length < 20) {
          setError('Description must be at least 20 characters');
          return false;
        }
        return true;
      case 2:
        const minDep = parseFloat(formData.minDeposit);
        const maxDep = parseFloat(formData.maxDeposit);
        if (minDep <= 0) {
          setError('Minimum deposit must be greater than 0');
          return false;
        }
        if (maxDep < minDep) {
          setError('Maximum deposit must be greater than minimum');
          return false;
        }
        return true;
      case 3:
        if (formData.vaultType === 'yield' && !formData.yieldStrategy) {
          setError('Please select a yield strategy');
          return false;
        }
        if (formData.vaultType === 'dao_treasury' && !formData.daoId) {
          setError('DAO ID required for treasury vaults');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const estimatedAPY = useMemo(() => {
    if (!formData.yieldStrategy) return 'N/A';
    const strategy = YIELD_STRATEGIES.find(s => s.id === formData.yieldStrategy);
    let baseAPY = strategy?.apy || '0-0%';
    // Adjust based on risk (simulated)
    if (formData.riskLevel === 'high') baseAPY = baseAPY.replace(/(\d+)-(\d+)/, (_, min, max) => `${+min + 5}-${+max + 5}`);
    return baseAPY;
  }, [formData.yieldStrategy, formData.riskLevel]);

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
    if (balance && balance.value < parseEther('0.01')) { // Example fee check
      setError('Insufficient balance for gas/fees');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setShowConfirm(false);

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
    <div className="flex items-center justify-center mb-8 flex-wrap gap-2 sm:gap-0">
      {[1, 2, 3, 4].map((stepNum) => (
        <React.Fragment key={stepNum}>
          <Tooltip>
            <TooltipTrigger>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                stepNum <= step 
                  ? 'bg-blue-600 border-blue-600 text-white' 
                  : 'border-gray-300 text-gray-400'
              }`}>
                {stepNum < step ? <CheckCircle className="w-5 h-5" /> : stepNum}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Step {stepNum}: {stepNum === 1 ? 'Basics' : stepNum === 2 ? 'Config' : stepNum === 3 ? 'Strategy' : 'Review'}
            </TooltipContent>
          </Tooltip>
          {stepNum < 4 && (
            <div className={`hidden sm:block w-16 h-0.5 ${stepNum < step ? 'bg-blue-600' : 'bg-gray-300'}`} />
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
            Create Investment Vault (Celo L2 Powered)
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
                  <Label htmlFor="vaultName">Vault Name * <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                  <TooltipContent>Name your vault clearly for users.</TooltipContent>
                  <Input
                    id="vaultName"
                    placeholder="e.g., Community Growth Fund"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="mt-1"
                    aria-required="true"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description * <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                  <TooltipContent>Explain goals, benefits, and target users.</TooltipContent>
                  <Textarea
                    id="description"
                    placeholder="Describe the purpose and goals of this vault..."
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="mt-1"
                    rows={4}
                    aria-required="true"
                  />
                </div>

                <div>
                  <Label className="mb-3 block">Vault Type * <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                  <TooltipContent>Select based on your investment style.</TooltipContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {VAULT_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = formData.vaultType === type.id;
                      return (
                        <Card
                          key={type.id}
                          className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-600 bg-blue-50' : 'hover:shadow-md'}`}
                          onClick={() => updateField('vaultType', type.id)}
                          aria-selected={isSelected}
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
                                  {type.features.map((feature, idx) => (
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
                <Label htmlFor="currency">Primary Currency * <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                <TooltipContent>Choose a stablecoin for lower volatility.</TooltipContent>
                <Select 
                  value={formData.primaryCurrency} 
                  onValueChange={(value) => updateField('primaryCurrency', value)}
                >
                  <SelectTrigger className="mt-1" aria-label="Select currency">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minDeposit">Minimum Deposit * <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                  <TooltipContent>Set a reasonable entry barrier.</TooltipContent>
                  <Input
                    id="minDeposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minDeposit}
                    onChange={(e) => updateField('minDeposit', e.target.value)}
                    className="mt-1"
                    aria-required="true"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    in {formData.primaryCurrency}
                  </p>
                </div>

                <div>
                  <Label htmlFor="maxDeposit">Maximum Deposit <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                  <TooltipContent>Set to prevent over-concentration.</TooltipContent>
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
                    Set high for unlimited (e.g., 1M)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="performanceFee">Performance Fee (%) <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                  <TooltipContent>Charged on profits; max 20%.</TooltipContent>
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
                </div>

                <div>
                  <Label htmlFor="managementFee">Management Fee (%) <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                  <TooltipContent>Annual; max 5%.</TooltipContent>
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
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Fees sustain operations. 2025 rec: 15% perf, 2% mgmt. Wallet balance: {balance?.formatted || 'N/A'} {formData.primaryCurrency}.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 3: Strategy & Risk */}
          {step === 3 && (
            <div className="space-y-6">
              {formData.vaultType === 'dao_treasury' && (
                <div>
                  <Label htmlFor="daoId">DAO ID * <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                  <TooltipContent>Link to your DAO for governance.</TooltipContent>
                  <Input
                    id="daoId"
                    placeholder="e.g., mtaa-dao-123"
                    value={formData.daoId}
                    onChange={(e) => updateField('daoId', e.target.value)}
                    className="mt-1"
                    aria-required="true"
                  />
                </div>
              )}

              {formData.vaultType === 'yield' && (
                <div>
                  <Label className="mb-3 block">Yield Strategy * <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                  <TooltipContent>Choose based on risk/return; Est. APY: {estimatedAPY}</TooltipContent>
                  <div className="space-y-3">
                    {YIELD_STRATEGIES.map((strategy) => (
                      <Card
                        key={strategy.id}
                        className={`cursor-pointer transition-all ${formData.yieldStrategy === strategy.id ? 'ring-2 ring-blue-600 bg-blue-50' : 'hover:shadow-md'}`}
                        onClick={() => updateField('yieldStrategy', strategy.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{strategy.name}</h4>
                              <p className="text-sm text-gray-600">
                                Est. APY: {strategy.apy} (2025 data)
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
                <Label className="mb-3 block">Risk Level * <TooltipTrigger><Info className="w-4 h-4 inline" /></TooltipTrigger></Label>
                <TooltipContent>Affects strategy allocation; cannot change later.</TooltipContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(['low', 'medium', 'high'] as const).map((risk) => (
                    <Card
                      key={risk}
                      className={`cursor-pointer transition-all ${formData.riskLevel === risk ? 'ring-2 ring-blue-600 bg-blue-50' : 'hover:shadow-md'}`}
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
                          {risk === 'high' && 'Aggressive, higher potential'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Risk determines allocations. Celo L2 offers low fees (~$0.001/tx in 2025).
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
                  Review carefully. Est. APY: {estimatedAPY}. Gas: ~0.01 CELO.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      {YIELD_STRATEGIES.find(s => s.id === formData.yieldStrategy)?.name} (Est. APY: {estimatedAPY})
                    </p>
                  </div>
                )}

                {formData.vaultType === 'dao_treasury' && formData.daoId && (
                  <div>
                    <Label className="text-gray-500">DAO ID</Label>
                    <p className="font-semibold">{formData.daoId}</p>
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
                <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                  <DialogTrigger asChild>
                    <Button 
                      disabled={isSubmitting}
                      className="bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Create Vault
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Vault Creation</DialogTitle>
                      <DialogDescription>
                        This will deploy a smart contract on Celo L2. Estimated gas: 0.01 CELO. Proceed?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
                      <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Confirm'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default VaultCreationWizard;