import React, { useState, useEffect, useMemo } from 'react';
import { Strategy, RiskControl } from '../../hooks/useStrategyRegistry';
import { StrategySelector } from './StrategySelector';
import { StrategyConfigurator } from './StrategyConfigurator';
import { RiskControlPanel } from './RiskControlPanel';
import { ExchangeSelector } from './ExchangeSelector';
import { DeploymentPreview } from './DeploymentPreview';
import { Lucide } from '../../src/lib/icons';
const { Target, Settings, Shield, Globe, Eye, Loader, PartyPopper, Check } = (Lucide as any) || {};

type WizardStep = 'select' | 'configure' | 'risk' | 'exchanges' | 'preview' | 'deploying' | 'success';

interface StrategyDeploymentWizardProps {
  strategies: Strategy[];
  onDeploy: (
    strategyId: string,
    inputs: Record<string, any>,
    riskControl: RiskControl,
    exchanges: string[],
    botName: string,
    initialCapital: number
  ) => Promise<any>;
  isLoading?: boolean;
}

export const StrategyDeploymentWizard: React.FC<StrategyDeploymentWizardProps> = ({
  strategies,
  onDeploy,
  isLoading = false
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('select');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [strategyInputs, setStrategyInputs] = useState<Record<string, any>>({});
  const [riskControl, setRiskControl] = useState<RiskControl | null>(null);
  const [exchanges, setExchanges] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [botName, setBotName] = useState('');
  const [initialCapital, setInitialCapital] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [deployedBotId, setDeployedBotId] = useState<string | null>(null);

  const steps: WizardStep[] = ['select', 'configure', 'risk', 'exchanges', 'preview'];

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 'select':
        return selectedStrategy !== null;
      case 'configure':
        // If a strategy has no inputs, treat configure as valid. Otherwise require inputs.
        return (
          selectedStrategy !== null &&
          (Array.isArray(selectedStrategy.inputs) && selectedStrategy.inputs.length === 0
            ? true
            : Object.keys(strategyInputs).length > 0)
        );
      case 'risk':
        return riskControl !== null;
      case 'exchanges':
        return exchanges.length > 0;
      case 'preview':
        return (
          selectedStrategy !== null &&
          riskControl !== null &&
          exchanges.length > 0 &&
          botName.trim().length > 0 &&
          initialCapital >= 10
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (isLoading) return; // prevent navigation while loading
    if (isStepValid()) {
      const nextIndex = Math.min(currentStepIndex + 1, steps.length - 1);
      setCurrentStep(steps[nextIndex]);
      setError(null);
    } else {
      setError('Please complete this step before proceeding');
    }
  };

  const handlePrev = () => {
    if (isLoading) return;
    const prevIndex = Math.max(currentStepIndex - 1, 0);
    setCurrentStep(steps[prevIndex]);
    setError(null);
  };

  const handleDeploy = async () => {
    if (!selectedStrategy || !riskControl) return;

    try {
      setCurrentStep('deploying');
      setError(null);

      // Race the deploy against a timeout so user isn't stuck forever
      const deployPromise = onDeploy(
        selectedStrategy.id,
        strategyInputs,
        riskControl,
        exchanges,
        botName,
        initialCapital
      );

      const timeoutMs = 30000; // 30s
      let result: any;
      try {
        result = await Promise.race([
          deployPromise,
          new Promise((_, rej) => setTimeout(() => rej(new Error('Deployment timeout')), timeoutMs)),
        ]);
      } catch (err) {
        throw err;
      }

      // If the API returned an id, use it; otherwise fallback to mock id
      if (result && typeof result === 'object' && result.id) {
        setDeployedBotId(String(result.id));
      } else {
        setDeployedBotId(`bot-${Date.now()}`);
      }

      setCurrentStep('success');
    } catch (err) {
      setCurrentStep('preview');
      setError(err instanceof Error ? err.message : 'Deployment failed');
    }
  };

  const handleReset = () => {
    setCurrentStep('select');
    setSelectedStrategy(null);
    setStrategyInputs({});
    setRiskControl(null);
    setExchanges([]);
    setBotName('');
    setInitialCapital(100);
    setError(null);
    setDeployedBotId(null);
  };

  // Reset inputs and risk control when user selects a different strategy
  useEffect(() => {
    if (!selectedStrategy) {
      setStrategyInputs({});
      setRiskControl(null);
      return;
    }

    // Initialize inputs from strategy defaults if provided
    const defaults: Record<string, any> = {};
    if (Array.isArray(selectedStrategy.inputs)) {
      for (const inp of selectedStrategy.inputs) {
        defaults[inp.name] = inp.value !== undefined ? inp.value : inp.default;
      }
    }
    setStrategyInputs(defaults);
    // Initialize risk control to strategy's defaults if present
    setRiskControl(selectedStrategy.riskControl || null);
  }, [selectedStrategy]);

  // Filtering for StrategySelector: keep local search/category state and pass filtered list
  const filteredStrategies = useMemo(() => {
    return strategies.filter((s) => {
      const matchesCategory = !categoryFilter || s.category === categoryFilter;
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [strategies, searchQuery, categoryFilter]);

  const stepTitles: Record<WizardStep, string> = {
    select: 'Select Strategy',
    configure: 'Configure Inputs',
    risk: 'Risk Controls',
    exchanges: 'Exchanges',
    preview: 'Review & Deploy',
    deploying: 'Deploying...',
    success: 'Success!'
  };

  const stepIcons: Record<WizardStep, JSX.Element> = {
    select: <Target className="inline w-6 h-6 mr-2" />,
    configure: <Settings className="inline w-6 h-6 mr-2" />,
    risk: <Shield className="inline w-6 h-6 mr-2" />,
    exchanges: <Globe className="inline w-6 h-6 mr-2" />,
    preview: <Eye className="inline w-6 h-6 mr-2" />,
    deploying: <Loader className="inline w-6 h-6 mr-2 animate-spin" />,
    success: <PartyPopper className="inline w-6 h-6 mr-2" />,
  };

  // Success Screen
  if (currentStep === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6 flex items-center justify-center">
        <div className="max-w-2xl w-full space-y-6">
          <div className="text-center">
            <div className="text-6xl mb-4"><PartyPopper className="w-20 h-20 mx-auto text-yellow-400" /></div>
            <h1 className="text-4xl font-bold text-white mb-2">Bot Deployed Successfully!</h1>
            <p className="text-slate-300 mb-4">
              Your trading strategy "{botName}" is now live and running
            </p>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-slate-400">Bot ID</div>
              <div className="font-mono font-bold text-green-400">{deployedBotId}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-slate-400">Strategy</div>
              <div className="font-bold text-white">{selectedStrategy?.name}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-slate-400">Initial Capital</div>
              <div className="font-bold text-white">${initialCapital}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-slate-400">Exchanges</div>
              <div className="flex gap-2">
                {exchanges.map(e => (
                  <span key={e} className="px-2 py-1 bg-blue-600 text-white text-sm rounded capitalize">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-green-900 border-l-4 border-green-500 p-4 rounded">
            <div className="font-bold text-green-100 mb-2"><Check className="inline w-4 h-4 mr-2" />What's Next?</div>
            <ul className="text-sm text-green-200 space-y-1">
              <li>• Monitor bot performance in Trading Dashboard → Bots section</li>
              <li>• Check real-time trades in History tab</li>
              <li>• Adjust risk controls if needed (live updates)</li>
              <li>• Set up alerts for important events</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep('preview')}
              className="flex-1 px-4 py-3 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors text-white font-bold"
            >
              View Details
            </button>
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-white font-bold"
            >
              Deploy Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Deploying Screen
  if (currentStep === 'deploying') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="text-6xl">
            <Loader className="w-20 h-20 mx-auto animate-spin text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Deploying Your Bot...</h1>
          <p className="text-slate-300">
            Setting up strategy "{botName}" on {exchanges.length} exchange(s)
          </p>

          <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 animate-pulse" />
          </div>

          <div className="text-sm text-slate-400 space-y-1">
            <p>• Validating strategy parameters...</p>
            <p>• Connecting to exchanges...</p>
            <p>• Starting execution engine...</p>
          </div>
        </div>
      </div>
    );
  }

  // Normal Wizard Flow
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            {stepIcons[currentStep]} {stepTitles[currentStep]}
          </h1>
          <p className="text-slate-400">
            Step {currentStepIndex + 1} of {steps.length}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 space-y-2">
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 w-[${progress}%]`} />
          </div>

          {/* Step Indicators */}
          <div className="flex justify-between">
            {steps.map((step, idx) => (
              <div
                key={step}
                className={`text-xs font-bold ${
                  idx <= currentStepIndex ? 'text-blue-400' : 'text-slate-500'
                }`}
              >
                {stepTitles[step as WizardStep]}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900 border-l-4 border-red-500 rounded text-red-100">
            {error}
          </div>
        )}

        {/* Content Area */}
        <div className="bg-slate-800 rounded-lg p-8 mb-8 min-h-96">
          {currentStep === 'select' && (
            <StrategySelector
              strategies={filteredStrategies}
              selectedStrategyId={selectedStrategy?.id ?? null}
              onStrategySelect={setSelectedStrategy}
              onCategoryFilter={(c) => setCategoryFilter(c)}
              onSearch={(q) => setSearchQuery(q)}
            />
          )}

          {currentStep === 'configure' && (
            <StrategyConfigurator
              strategy={selectedStrategy}
              onInputsChange={setStrategyInputs}
            />
          )}

          {currentStep === 'risk' && (
            <RiskControlPanel
              strategy={selectedStrategy}
              onRiskControlChange={setRiskControl}
            />
          )}

          {currentStep === 'exchanges' && (
            <ExchangeSelector
              selectedExchanges={exchanges}
              onExchangesChange={setExchanges}
            />
          )}

          {currentStep === 'preview' && (
            <DeploymentPreview
              strategy={selectedStrategy}
              inputs={strategyInputs}
              riskControl={riskControl}
              exchanges={exchanges}
              botName={botName}
              initialCapital={initialCapital}
              onBotNameChange={setBotName}
              onInitialCapitalChange={setInitialCapital}
              isValid={isStepValid()}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-4 justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="px-6 py-3 border border-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold"
          >
            ← Previous
          </button>

          <div className="flex gap-3">
            {currentStep === 'preview' && (
              <>
                <button
                  onClick={handlePrev}
                  className="px-6 py-3 border border-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-bold"
                >
                  Back
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={!isStepValid() || isLoading}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold flex items-center gap-2"
                >
                  🚀 Deploy Bot
                </button>
                {!isStepValid() && (
                  <div className="text-xs text-slate-300 mt-2">{
                    !botName.trim() ? 'Enter a bot name above to enable deployment.' :
                    initialCapital < 10 ? 'Initial capital must be at least $10.' :
                    'Please complete required fields.'
                  }</div>
                )}
              </>
            )}
            {currentStep !== 'preview' && (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold"
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 p-4 bg-slate-700 rounded-lg text-sm text-slate-300">
          <strong>💡 Tip:</strong> You can always pause, modify, or stop any deployed bot from the
          Trading Dashboard. Start with small capital and monitor performance closely.
        </div>
      </div>
    </div>
  );
};
