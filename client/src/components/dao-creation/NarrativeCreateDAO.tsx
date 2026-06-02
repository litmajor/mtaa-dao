import React, { useState, useEffect, useMemo } from 'react';
import { useDAOOrchestrator } from '@/context/daoOrchestratorSystem';
import { 
  SystemHealthBanner, 
  AdaptiveReadinessMeter, 
  WarningsAndSuggestionsPanel,
  OperationalModeIndicator,
  RiskLevelBadge,
  EmotionalToneIndicator
} from '@/components/dao-creation/AdaptiveUIComponents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronRight, ChevronLeft, Zap, Users, Wallet, Send } from 'lucide-react';

/**
 * NARRATIVE CREATE DAO EXPERIENCE
 * 
 * A stateful, psychologically responsive UI that guides the user through
 * founding a DAO as if they're establishing a sovereign organization.
 * 
 * Flow:
 * 1. FOUNDATION - Define mission & identity
 * 2. GOVERNANCE - Shape power structure (decentralization, voting)
 * 3. CAPITAL - Allocate treasury resources
 * 4. EXECUTION - Simulate & validate design
 * 5. COMMITMENT - Deploy to blockchain
 */

interface CreateDAOFormData {
  name: string;
  mission: string;
  vision: string;
  logoEmoji: string;
  members: string[];
  governanceModel: 'democratic' | 'delegated' | 'weighted';
  votingPeriod: number; // days
  quorum: number; // percentage
  treasuryAsset: 'cusd' | 'usdc' | 'native';
  initialFunding: string;
  riskTolerance: number; // 0-100
}

const NARRATIVE_STAGES = [
  {
    id: 'foundation',
    title: '🏛️ Founding Your Organization',
    description: 'Define your DAO\'s mission, identity, and core values',
    mode: 'definition' as const,
  },
  {
    id: 'governance',
    title: '⚖️ Shaping Power Structure',
    description: 'Design governance rules, voting mechanisms, and decision-making',
    mode: 'governance' as const,
  },
  {
    id: 'capital',
    title: '💰 Allocating Resources',
    description: 'Define treasury strategy, allocation, and economic behavior',
    mode: 'capital' as const,
  },
  {
    id: 'execution',
    title: '⚡ Validation & Simulation',
    description: 'Preview your design and validate system health',
    mode: 'execution' as const,
  },
  {
    id: 'commitment',
    title: '🚀 Deploy to Blockchain',
    description: 'Commit your DAO to the decentralized world',
    mode: 'commitment' as const,
  },
];

export const NarrativeCreateDAO: React.FC = () => {
  const orchestrator = useDAOOrchestrator();
  const { state: orchState, actions } = orchestrator;

  // Local form state
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [formData, setFormData] = useState<CreateDAOFormData>({
    name: '',
    mission: '',
    vision: '',
    logoEmoji: '🏛️',
    members: [''], // Start with one empty field
    governanceModel: 'democratic',
    votingPeriod: 7,
    quorum: 50,
    treasuryAsset: 'cusd',
    initialFunding: '',
    riskTolerance: 50,
  });

  const currentStage = NARRATIVE_STAGES[currentStageIndex];

  // Sync orchestrator mode with current stage
  useEffect(() => {
    actions.setOperationalMode(currentStage.mode);
  }, [currentStageIndex]);

  // Update metrics based on form data
  useEffect(() => {
    // Governance metrics
    const memberCount = formData.members.filter(m => m.trim()).length;
    const decentralizationLevel = Math.min(100, memberCount * 15); // More members = more decentralized
    const founderControl = Math.max(10, 100 - decentralizationLevel); // Inverse relationship
    const governanceComplexity = formData.governanceModel === 'democratic' ? 40 : 70;

    actions.updateGovernanceMetrics({
      decentralizationLevel,
      founderControl,
      governanceComplexity,
    });

    // Treasury metrics
    const treasuryReady = formData.initialFunding !== '' ? 80 : 20;
    const riskLevel = 100 - formData.riskTolerance; // Higher risk tolerance = lower risk score

    actions.updateTreasuryMetrics({
      treasuryReadiness: treasuryReady,
      treasuryRisk: riskLevel,
    });

    // Participation metrics
    const expectedParticipation = Math.min(100, (memberCount / 10) * 100); // Estimate participation
    const quorumRealism = formData.quorum > 50 ? Math.max(30, 100 - formData.quorum) : 80; // High quorum = less realistic

    actions.updateParticipationMetrics({
      expectedParticipation,
      quorumRealism,
    });
  }, [formData]);

  const handleNextStage = () => {
    if (currentStageIndex < NARRATIVE_STAGES.length - 1) {
      setCurrentStageIndex(currentStageIndex + 1);
    }
  };

  const handlePreviousStage = () => {
    if (currentStageIndex > 0) {
      setCurrentStageIndex(currentStageIndex - 1);
    }
  };

  const handleDeploy = () => {
    // Trigger deployment
    console.log('Deploying DAO with data:', formData);
    actions.advanceStage();
    // Call actual deployment API here
  };

  const canAdvance = () => {
    // Validation logic for each stage
    switch (currentStageIndex) {
      case 0: // Foundation
        return formData.name.trim() !== '' && formData.mission.trim() !== '';
      case 1: // Governance
        return formData.members.filter(m => m.trim()).length >= 2;
      case 2: // Capital
        return formData.initialFunding.trim() !== '';
      case 3: // Execution
        return orchState.overallReadiness > 50; // Can review but system should be somewhat ready
      case 4: // Commitment
        return true; // Final stage
      default:
        return false;
    }
  };

  const canDeploy = orchestrator.helpers.canCommit();

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 rounded-xl">
      {/* HEADER */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-blue-600">
              {currentStage.title}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
              {currentStage.description}
            </p>
          </div>
          <div className="text-right">
            <RiskLevelBadge />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              <EmotionalToneIndicator />
            </p>
          </div>
        </div>
      </div>

      {/* SYSTEM HEALTH & STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SystemHealthBanner />
        </div>
        <AdaptiveReadinessMeter />
      </div>

      {/* STAGE NAVIGATION */}
      <OperationalModeIndicator />

      {/* STAGE-SPECIFIC CONTENT */}
      <div className="space-y-6">
        {currentStageIndex === 0 && (
          <FoundationStage formData={formData} setFormData={setFormData} />
        )}
        {currentStageIndex === 1 && (
          <GovernanceStage formData={formData} setFormData={setFormData} />
        )}
        {currentStageIndex === 2 && (
          <CapitalStage formData={formData} setFormData={setFormData} />
        )}
        {currentStageIndex === 3 && (
          <ExecutionStage formData={formData} />
        )}
        {currentStageIndex === 4 && (
          <CommitmentStage formData={formData} canDeploy={canDeploy} />
        )}
      </div>

      {/* WARNINGS & SUGGESTIONS */}
      <WarningsAndSuggestionsPanel />

      {/* STAGE CONTROLS */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="outline"
          onClick={handlePreviousStage}
          disabled={currentStageIndex === 0}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex gap-1">
          {NARRATIVE_STAGES.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 w-8 rounded-full transition-all ${
                idx <= currentStageIndex
                  ? 'bg-teal-600 dark:bg-teal-400'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {currentStageIndex === NARRATIVE_STAGES.length - 1 ? (
            <Button
              onClick={handleDeploy}
              disabled={!canDeploy}
              className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Deploy DAO
            </Button>
          ) : (
            <Button
              onClick={handleNextStage}
              disabled={!canAdvance()}
              className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STAGE COMPONENTS
// ============================================================================

interface StageProps {
  formData: CreateDAOFormData;
  setFormData: (data: CreateDAOFormData) => void;
}

const FoundationStage: React.FC<StageProps> = ({ formData, setFormData }) => (
  <Card className="border-2 border-blue-200 dark:border-blue-800">
    <CardHeader>
      <CardTitle>Define Your Organization's Foundation</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <Label className="text-base font-semibold mb-2 block">
          Organization Name
        </Label>
        <Input
          placeholder="e.g., Maji Savings Group"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          className="text-lg"
        />
      </div>

      <div>
        <Label className="text-base font-semibold mb-2 block">
          Mission (Why you exist)
        </Label>
        <Textarea
          placeholder="What is your organization's core purpose and mission?"
          value={formData.mission}
          onChange={e => setFormData({ ...formData, mission: e.target.value })}
          rows={3}
        />
      </div>

      <div>
        <Label className="text-base font-semibold mb-2 block">
          Vision (Where you're going)
        </Label>
        <Textarea
          placeholder="What future are you building toward?"
          value={formData.vision}
          onChange={e => setFormData({ ...formData, vision: e.target.value })}
          rows={3}
        />
      </div>

      <div>
        <Label className="text-base font-semibold mb-2 block">
          Organization Symbol
        </Label>
        <div className="flex gap-2">
          <Input
            value={formData.logoEmoji}
            onChange={e => setFormData({ ...formData, logoEmoji: e.target.value })}
            maxLength={2}
            className="w-16 text-2xl"
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Pick an emoji that represents your organization
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const GovernanceStage: React.FC<StageProps> = ({ formData, setFormData }) => (
  <div className="space-y-4">
    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle>Define Members & Voting Rights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-base font-semibold mb-2 block flex items-center gap-2">
            <Users className="w-4 h-4" />
            Add Members
          </Label>
          <div className="space-y-2">
            {formData.members.map((member, idx) => (
              <Input
                key={idx}
                placeholder="Member wallet address or phone"
                value={member}
                onChange={e => {
                  const newMembers = [...formData.members];
                  newMembers[idx] = e.target.value;
                  setFormData({ ...formData, members: newMembers });
                }}
              />
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFormData({ ...formData, members: [...formData.members, ''] })}
            className="mt-2"
          >
            Add Member
          </Button>
        </div>

        <div>
          <Label className="text-base font-semibold mb-3 block">
            Governance Model: {formData.governanceModel}
          </Label>
          <div className="space-y-2">
            {['democratic', 'delegated', 'weighted'].map(model => (
              <button
                key={model}
                onClick={() => setFormData({ ...formData, governanceModel: model as any })}
                className={`p-3 rounded border-2 text-left transition-all ${
                  formData.governanceModel === model
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                <div className="font-semibold capitalize">{model}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {model === 'democratic' && 'One member, one vote'}
                  {model === 'delegated' && 'Voting power can be delegated'}
                  {model === 'weighted' && 'Voting power based on contribution'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle>Voting Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-base font-semibold mb-2 block">
            Voting Period: {formData.votingPeriod} days
          </Label>
          <Slider
            value={[formData.votingPeriod]}
            onValueChange={([val]) => setFormData({ ...formData, votingPeriod: val })}
            min={1}
            max={30}
            step={1}
          />
        </div>

        <div>
          <Label className="text-base font-semibold mb-2 block">
            Quorum Needed: {formData.quorum}%
          </Label>
          <Slider
            value={[formData.quorum]}
            onValueChange={([val]) => setFormData({ ...formData, quorum: val })}
            min={20}
            max={100}
            step={5}
          />
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Minimum {formData.quorum}% of members must vote for decisions to pass
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
);

const CapitalStage: React.FC<StageProps> = ({ formData, setFormData }) => (
  <Card className="border-2 border-emerald-200 dark:border-emerald-800">
    <CardHeader>
      <CardTitle>Define Treasury Strategy</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <Label className="text-base font-semibold mb-2 block flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          Treasury Asset
        </Label>
        <div className="space-y-2">
          {['cusd', 'usdc', 'native'].map(asset => (
            <button
              key={asset}
              onClick={() => setFormData({ ...formData, treasuryAsset: asset as any })}
              className={`p-3 rounded border-2 text-left transition-all ${
                formData.treasuryAsset === asset
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                  : 'border-gray-300 dark:border-gray-700'
              }`}
            >
              <div className="font-semibold">
                {asset === 'cusd' && 'cUSD (Stablecoin)'}
                {asset === 'usdc' && 'USDC (Circle)'}
                {asset === 'native' && 'Native Token'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-base font-semibold mb-2 block">
          Initial Funding
        </Label>
        <Input
          type="number"
          placeholder="Amount (in selected asset)"
          value={formData.initialFunding}
          onChange={e => setFormData({ ...formData, initialFunding: e.target.value })}
        />
      </div>

      <div>
        <Label className="text-base font-semibold mb-2 block">
          Risk Tolerance: {formData.riskTolerance}%
        </Label>
        <Slider
          value={[formData.riskTolerance]}
          onValueChange={([val]) => setFormData({ ...formData, riskTolerance: val })}
          min={0}
          max={100}
          step={10}
        />
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          How much flexibility for treasury allocation? 0% = conservative, 100% = aggressive
        </p>
      </div>
    </CardContent>
  </Card>
);

const ExecutionStage: React.FC<{ formData: CreateDAOFormData }> = ({ formData }) => {
  const orchestrator = useDAOOrchestrator();

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <AlertDescription className="text-blue-900 dark:text-blue-100">
          Review your DAO design. The system has analyzed your governance, treasury, and member structure.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>System Analysis & Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-xs text-gray-600 dark:text-gray-400">Members</div>
              <div className="text-2xl font-bold">{formData.members.filter(m => m.trim()).length}</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-xs text-gray-600 dark:text-gray-400">Governance Model</div>
              <div className="text-lg font-bold capitalize">{formData.governanceModel}</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-xs text-gray-600 dark:text-gray-400">Quorum Required</div>
              <div className="text-2xl font-bold">{formData.quorum}%</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-xs text-gray-600 dark:text-gray-400">Treasury Asset</div>
              <div className="text-lg font-bold uppercase">{formData.treasuryAsset}</div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold mb-3">System Readiness</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Overall Readiness</span>
                <span className="font-bold">{orchestrator.state.overallReadiness}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Governance Health</span>
                <span className="font-bold">{orchestrator.state.decentralizationLevel}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Treasury Readiness</span>
                <span className="font-bold">{orchestrator.state.treasuryReadiness}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const CommitmentStage: React.FC<{ formData: CreateDAOFormData; canDeploy: boolean }> = ({ 
  formData, 
  canDeploy 
}) => (
  <Card className="border-2 border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50 to-blue-50 dark:from-teal-950/20 dark:to-blue-950/20">
    <CardHeader>
      <CardTitle>Ready to Deploy</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-lg">
        Your DAO <strong>{formData.name}</strong> is ready to become a permanent, decentralized organization on the blockchain.
      </p>

      <Alert className={canDeploy ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'}>
        <AlertDescription className={canDeploy ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}>
          {canDeploy 
            ? '✅ Your DAO is ready for deployment. All systems healthy.' 
            : '⚠️ Review suggested improvements before deploying.'}
        </AlertDescription>
      </Alert>

      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold mb-2">This action will:</p>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>Create a permanent record on the blockchain</li>
          <li>Initialize your treasury with {formData.initialFunding} {formData.treasuryAsset}</li>
          <li>Register {formData.members.filter(m => m.trim()).length} members</li>
          <li>Activate governance with {formData.quorum}% quorum requirement</li>
        </ul>
      </div>
    </CardContent>
  </Card>
);
