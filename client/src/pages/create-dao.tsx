import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from './hooks/useWallet';
import { useFormPersistence } from './hooks/useFormPersistence';
import { useStepValidation } from './hooks/useStepValidation';
import { useTreasury } from '@/hooks/useTreasury';
import { useTreasuryIntelligence } from '@/hooks/useTreasuryIntelligence';
import { getTreasuryConfigForDAOType } from '@/config/treasury.config';
import { ErrorAlert } from '@/components/ErrorAlert';
import { DAOOrchestratorProvider, useDAOOrchestrator } from '@/context/daoOrchestratorSystem';
import {
  SystemHealthBanner,
  AdaptiveReadinessMeter,
  WarningsAndSuggestionsPanel,
  OperationalModeIndicator,
  RiskLevelBadge,
} from '@/components/dao-creation/AdaptiveUIComponents';
import type { DAOType } from '@/types/treasury';
import { CharacterCounter } from '@/components/CharacterCounter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// icon imports intentionally omitted; lightweight emoji fallbacks are used below during refactor
import { t } from '@/lib/uiLabels';
import { useQuery } from '@tanstack/react-query';
import { DAO_TYPE_CONFIG } from '@/config/daoTypes.config';
import MultisigManager from '@/components/multisig/MultisigManager';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { authClient } from '@/utils/authClient';

// Fallback lightweight icon components (emoji) to avoid build failures during onboarding edits.
const Icon = ({ children, className }: any) => <span className={className} aria-hidden>{children}</span>;
const ChevronDown = (p: any) => <Icon {...p}>⌄</Icon>;
const ChevronUp = (p: any) => <Icon {...p}>˄</Icon>;
const Users = (p: any) => <Icon {...p}>👥</Icon>;
const Shield = (p: any) => <Icon {...p}>🛡️</Icon>;
const Wallet = (p: any) => <Icon {...p}>👛</Icon>;
const Settings = (p: any) => <Icon {...p}>⚙️</Icon>;
const Eye = (p: any) => <Icon {...p}>👁️</Icon>;
const Send = (p: any) => <Icon {...p}>📤</Icon>;
const CheckCircle = (p: any) => <Icon {...p}>✅</Icon>;
const Plus = (p: any) => <Icon {...p}>＋</Icon>;
const Trash2 = (p: any) => <Icon {...p}>🗑️</Icon>;
const Upload = (p: any) => <Icon {...p}>⬆️</Icon>;
const Copy = (p: any) => <Icon {...p}>📋</Icon>;
const Info = (p: any) => <Icon {...p}>ℹ️</Icon>;
const HelpCircle = (p: any) => <Icon {...p}>❓</Icon>;
const AlertCircle = (p: any) => <Icon {...p}>⚠️</Icon>;
const BookOpen = (p: any) => <Icon {...p}>📘</Icon>;
const AlertTriangle = (p: any) => <Icon {...p}>⚠️</Icon>;
const Zap = (p: any) => <Icon {...p}>⚡</Icon>;
const Heart = (p: any) => <Icon {...p}>❤️</Icon>;
const ChartBar = (p: any) => <Icon {...p}>📊</Icon>;
const BarChart2 = (p: any) => <Icon {...p}>📈</Icon>;
const AlertOctagon = (p: any) => <Icon {...p}>🛑</Icon>;

const WhatIsDAOExplainer = ({ onContinue }: { onContinue: () => void }) => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center mx-auto mb-4">
        <BookOpen className="w-8 h-8 text-teal-600 dark:text-teal-400" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Before You Start</h1>
      <p className="text-gray-600 dark:text-gray-400">Let's make sure you understand what you're creating</p>
    </div>

    <Card className="border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-teal-800 dark:text-teal-200">
          <Users className="w-5 h-5" />
          {`What is a ${t('dao')}? (A simple digital group)`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
        <p>
          A <strong>{t('dao')}</strong> is like a <strong>chama or savings group</strong> that manages money and decisions together online.
          Instead of paper records or individual ledgers, members keep a shared, permanent record everyone can access.
        </p>

        <div className="grid gap-3 mt-4">
          <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium">Transparent like M-Pesa history</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Every contribution and withdrawal is recorded and visible to all members</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium">Democratic like a community meeting</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Members vote on decisions - just like raising hands at a baraza</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-medium">Protected by technology</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">No single person can run away with the money - rules are enforced automatically</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Alert className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
          <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
      <AlertTitle className="text-orange-800 dark:text-orange-200">Important: This is Permanent</AlertTitle>
      <AlertDescription className="text-orange-700 dark:text-orange-300">
        <p className="mb-2">
          Once you create a {t('dao')}, it becomes a <strong>permanent shared record</strong>.
          Think carefully about name and rules — they will be visible to your members and retained long-term.
        </p>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>You <strong>cannot delete</strong> a {t('dao')} once created</li>
          <li>The name and rules you set will be <strong>public and visible</strong> to anyone</li>
          <li>All transactions will be <strong>recorded permanently</strong></li>
        </ul>
      </AlertDescription>
    </Alert>

    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
      <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Who should create a {t('dao')}?</h4>
      <div className="grid gap-2 text-sm text-gray-600 dark:text-gray-400">
        <p>A {t('dao')} is perfect for:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Savings groups (Chamas)</strong> - Pool money together transparently</li>
          <li><strong>Merry-go-rounds</strong> - Take turns receiving contributions</li>
          <li><strong>Community projects</strong> - Fundraise for schools, water, etc.</li>
          <li><strong>Welfare groups</strong> - Burial funds, emergency support</li>
          <li><strong>Investment clubs</strong> - Pool resources for larger investments</li>
        </ul>
      </div>
    </div>

    <Button
      onClick={onContinue}
      className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800"
      size="lg"
      data-testid="button-understand-continue"
    >
      I Understand, Let's Create My Group
      <ChevronDown className="w-4 h-4 ml-2" />
    </Button>
  </div>
);

const BlockchainWarningBanner = () => (
  <Alert className="mb-4 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
    <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
      Remember: Once created, your group will be <strong>permanent and public</strong>. Choose your name and settings carefully.
    </AlertDescription>
  </Alert>
);

const MINIMUM_QUORUM = 20; // 20% minimum quorum

const CreateDAOFlowContent = () => {
  // Orchestrator system for stateful UI feedback
  const orchestrator = useDAOOrchestrator();

  const [showExplainer, setShowExplainer] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const { address: walletAddress, isConnected } = useWallet();
  
  // Initialize treasury hook
  const {
    treasury,
    error: treasuryError,
    initializeTreasury,
    validate: validateTreasury,
    getSummary: getTreasurySummary
  } = useTreasury();

  const initialDaoData: DaoData = useMemo(() => ({
    name: '',
    description: '',
    logo: '🏛️',
    category: '',
    regionalTags: [],
    causeTags: [],
    primaryCause: '', // User's custom cause/reason
    visibility: 'public',
    governanceModel: '1-person-1-vote',
    quorum: 50,
    votingPeriod: '7d',
    founderWallet: '',
    treasuryType: 'cusd',
    initialFunding: '',
    depositRequired: false,
    members: [],
    inviteMessage: '',
    enableSocialReactions: true,
    enableDiscovery: true,
    featuredMessage: '',
    selectedElders: [],
    // Multisig defaults
    enableMultisig: false,
    multisigSigners: [],
    multisigRequiredSignatures: 2
  }), []);

  const { data: daoData, setData: setDaoData, lastSaved, clearDraft } = useFormPersistence(initialDaoData);
  const { isValid: isStepValid, errors: validationErrors } = useStepValidation(currentStep, daoData);

  useEffect(() => {
    if (walletAddress) {
      setDaoData(prev => ({
        ...prev,
        founderWallet: walletAddress,
        members: prev.members.length === 0
          ? [{ address: walletAddress, role: 'governor', name: 'You (Founder)' }]
          : prev.members.map((m, i) =>
              i === 0 ? { ...(m as Member), address: walletAddress } : m as Member
            )
      }));
    }
  }, [walletAddress]);

  const [newMember, setNewMember] = useState({ address: '', role: 'member', name: '' });
  const [newMultisigSigner, setNewMultisigSigner] = useState('');
  const [showMultisigManager, setShowMultisigManager] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellRequiredTier, setUpsellRequiredTier] = useState<string | null>(null);
  const { toast } = useToast();

  // Input sanitization helper
  const sanitizeInput = useCallback((input: string, maxLength: number = 500): string => {
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove remaining < >
      .substring(0, maxLength)
      .trim();
  }, []);

  // Validate wallet/phone/email address
  const validateAddress = useCallback((address: string): boolean => {
    // Wallet address (0x...)
    if (/^0x[a-fA-F0-9]{40}$/.test(address)) return true;
    // Phone number (+254...)
    if (/^\+\d{10,15}$/.test(address)) return true;
    return false;
  }, []);

  // Simplified DAO Type Options for Chama-first onboarding
  const daoTypeOptions = [
    {
      id: 'harambee',
      label: 'Harambee / Emergency Fund',
      icon: '⚡',
      duration: '1-4 weeks',
      description: 'One-time collection and immediate payout',
      examples: ['Emergency fund', 'Event collection'],
      requiresGovernance: false,
      defaultTreasuryType: 'cusd',
      badge: 'HARAM'
    },
    {
      id: 'shortTerm',
      label: 'Short-Term Fund',
      icon: '⏳',
      duration: '1-3 months',
      description: 'Targeted short-term savings with milestones',
      examples: ['School fees', 'Medical plan'],
      requiresGovernance: false,
      defaultTreasuryType: 'cusd',
      badge: 'SHORT'
    },
    {
      id: 'savings',
      label: 'Savings Group',
      icon: '🤝',
      duration: 'Ongoing',
      description: 'Chama, table banking, regular savings',
      examples: ['Savings group', 'Investment club'],
      requiresGovernance: false,
      defaultTreasuryType: 'cusd',
      badge: 'SAVINGS'
    },
    {
      id: 'community',
      label: 'Community',
      icon: '🏛️',
      duration: 'Ongoing',
      description: 'Community projects and collective decisions',
      examples: ['Community council', 'Welfare group'],
      requiresGovernance: true,
      defaultTreasuryType: 'cusd',
      badge: 'COMMUNITY'
    }
    ,
    {
      id: 'investment',
      label: 'Investment Club',
      icon: '📈',
      duration: 'Ongoing',
      description: 'Pool resources to invest together with shared returns',
      examples: ['Investment club', 'Group portfolio'],
      requiresGovernance: true,
      defaultTreasuryType: 'cusd',
      badge: 'INVEST'
    },
    {
      id: 'merryGoRound',
      label: 'Merry-Go-Round',
      icon: '🎡',
      duration: 'Rotating cycle',
      description: 'Simple rotating savings where each member receives the pot in turn',
      examples: ['Rotation savings', 'Chama cycle'],
      requiresGovernance: false,
      defaultTreasuryType: 'cusd',
      badge: 'ROTATION'
    }
  ];

  // For onboarding we show all simplified DAO types (no subscription gating)
  const getAvailableDaoTypes = (_userTier: string) => {
    return daoTypeOptions;
  };

  // Get user's current subscription tier (you'll need to fetch this)
  // NOTE: This requires React Query to be set up in your project.
  // If you don't have it, you'll need to replace this with a state management solution
  // or a direct API call within useEffect.
  const { data: userSubscription } = useQuery({
    queryKey: ['/api/user/subscription'],
    queryFn: async () => {
      return await authClient.get('/api/user/subscription');
    },
    enabled: isConnected, // Only fetch if wallet is connected
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const userTier = userSubscription?.tier || 'free';
  const availableDaoTypes = getAvailableDaoTypes(userTier);

  const steps = [
    { id: 1, title: 'Group Type', icon: Settings },
    { id: 2, title: 'Name & Info', icon: Settings },
    { id: 3, title: 'Members', icon: Users },
    { id: 4, title: 'Confirm', icon: CheckCircle }
  ];

  const logoOptions = ['🏛️', '🌍', '🤝', '💎', '🚀', '⚡', '🌱', '🔥', '💰'];

  // Dynamic categories based on DAO type
  const getCategoriesForType = (type?: string) => {
    const categoriesByType: Record<string, typeof categories> = {
      shortTerm: [
        { value: 'merry-go-round', label: 'Merry-Go-Round', emoji: '🎡', description: 'Rotating savings group' },
        { value: 'harambee', label: 'Harambee Fund', emoji: '🙌', description: 'Community contribution event' },
        { value: 'burial', label: 'Burial/Bereavement', emoji: '🕊️', description: 'Support in loss' },
        { value: 'event', label: 'Event Fund', emoji: '🎉', description: 'Wedding, graduation, etc.' },
        { value: 'emergency', label: 'Emergency Relief', emoji: '🆘', description: 'Quick response fund' },
        { value: 'harvest', label: 'Harvest Pool', emoji: '🌾', description: 'Agricultural sharing' }
      ],
      collective: [
        { value: 'savings', label: 'Savings Group', emoji: '💰', description: 'Regular savings with growth' },
        { value: 'table-banking', label: 'Table Banking', emoji: '🏦', description: 'Microfinance circle' },
        { value: 'investment', label: 'Investment Club', emoji: '📈', description: 'Pool for investments' },
        { value: 'traders-coop', label: 'Traders Cooperative', emoji: '🛍️', description: 'Market vendors' },
        { value: 'farmers-union', label: 'Farmers Union', emoji: '🚜', description: 'Agricultural collective' },
        { value: 'labor-group', label: 'Labor Group', emoji: '👷', description: 'Communal work' }
      ],
      governance: [
        { value: 'community-council', label: 'Community Council', emoji: '🏛️', description: 'Decision making body' },
        { value: 'social-impact', label: 'Social Impact', emoji: '🌍', description: 'Community welfare' },
        { value: 'education', label: 'Education Fund', emoji: '🎓', description: 'Scholarships and learning' },
        { value: 'health', label: 'Health Initiative', emoji: '🏥', description: 'Community health' },
        { value: 'environment', label: 'Environment Fund', emoji: '🌱', description: 'Environmental conservation' },
        { value: 'youth', label: 'Youth Empowerment', emoji: '⚡', description: 'Youth development' }
      ],
      free: [ // Categories for Free DAO type
        { value: 'general', label: 'General Community', emoji: '👥', description: 'Open community for any purpose' },
        { value: 'project', label: 'Project Group', emoji: '🚀', description: 'For specific short-term projects' },
        { value: 'learning', label: 'Learning Circle', emoji: '📚', description: 'For study groups or skill sharing' },
        { value: 'social', label: 'Social Gathering', emoji: '🎉', description: 'Organize events or meetups' },
      ],
      meta: [ // Categories for MetaDAO type
        { value: 'regional-network', label: 'Regional Network', emoji: '📍', description: 'Coordinating DAOs within a region' },
        { value: 'federation', label: 'DAO Federation', emoji: '🔗', description: 'Connecting multiple DAOs for shared goals' },
        { value: 'ecosystem', label: 'Ecosystem Hub', emoji: '🌐', description: 'Central point for DAO ecosystem development' },
        { value: 'protocol-dao', label: 'Protocol DAO', emoji: '⚙️', description: 'DAO governing a decentralized protocol' },
      ]
    };

    // Default to collective if type not specified or if type has no specific categories
    return categoriesByType[type || 'collective'] || categoriesByType['collective'];
  };

  const categories = [
    { value: 'savings', label: 'Savings Group', emoji: '💰', description: 'Regular savings and collective financial growth' },
    { value: 'chama', label: 'Chama', emoji: '🤝', description: 'Traditional community savings and investment group' },
    { value: 'investment', label: 'Investment Club', emoji: '📈', description: 'Pool funds for investment opportunities' },
    { value: 'social', label: 'Social Impact', emoji: '🌍', description: 'Community welfare and social causes' },
    { value: 'governance', label: t('governance'), emoji: '🏛️', description: 'Decision-making and community leadership' },
    { value: 'funeral', label: 'Funeral Fund', emoji: '🕊️', description: 'Support members during bereavement' },
    { value: 'education', label: 'Education', emoji: '🎓', description: 'Scholarship and learning initiatives' },
    { value: 'youth', label: 'Youth Empowerment', emoji: '⚡', description: 'Youth development and mentorship' },
    { value: 'women', label: "Women's Group", emoji: '👭', description: "Women's economic empowerment" },
    { value: 'other', label: 'Other', emoji: '✨', description: 'Custom community purpose' }
  ];

  const regionalTags = [
    { value: 'nairobi', label: 'Nairobi' },
    { value: 'mombasa', label: 'Mombasa' },
    { value: 'kisumu', label: 'Kisumu' },
    { value: 'nakuru', label: 'Nakuru' },
    { value: 'eldoret', label: 'Eldoret' }
  ];

  const causeTags = [
    { value: 'youthempowerment', label: 'Youth Empowerment', emoji: '⚡' },
    { value: 'funeralfund', label: 'Funeral Fund', emoji: '🕊️' },
    { value: 'education', label: 'Education', emoji: '🎓' },
    { value: 'healthcare', label: 'Healthcare', emoji: '🏥' },
    { value: 'agriculture', label: 'Agriculture', emoji: '🌾' },
    { value: 'smallbusiness', label: 'Small Business', emoji: '💼' }
  ];

  const governanceModels = [
    {
      value: '1-person-1-vote',
      label: 'Equal Voice (1 Person = 1 Vote)',
      desc: 'Every member has equal say, regardless of how much they contributed',
      best_for: 'Burial funds, welfare groups, community projects',
      example: 'Like a village baraza - the elder and the youth both raise one hand each when voting',
      emoji: 'people-holding-hands'
    },
    {
      value: 'weighted-stake',
      label: 'Contribution-Based Voting',
      desc: 'Those who contribute more have more voting power',
      best_for: 'Investment clubs, business ventures, table banking',
      example: 'Like shareholders in a company - if you put in more money, you have more say in decisions',
      emoji: 'money-with-wings'
    },
    {
      value: 'delegated',
      label: 'Choose a Representative',
      desc: 'Let someone you trust vote on your behalf',
      best_for: 'Large groups, people who are too busy to attend every meeting',
      example: 'Like sending your relative to represent you at a family meeting',
      emoji: 'raised-hand'
    }
  ];

  const treasuryTypes = [
    {
      value: 'cusd',
      label: 'Stable Money (cUSD)',
      desc: 'Your group\'s money stays the same value as USD - no surprises',
      example: 'Like keeping money in a bank that doesn\'t fluctuate - 1000 stays 1000'
    },
    {
      value: 'dual',
      label: 'Mixed (Stable + Growth)',
      desc: 'Some money is stable, some can grow in value over time',
      example: 'Like having some savings in a bank account and some in shares'
    },
    {
      value: 'custom',
      label: 'Other Currencies',
      desc: 'USDT, DAI or other digital currencies (coming soon)',
      example: 'Coming soon - for advanced users'
    }
  ];

  // DAO types that require multisig by default (map to simplified types)
  const multisigRequiredTypes = ['savings', 'community', 'investment', 'merryGoRound'];

  // Ensure multisig is enabled automatically for required types
  useEffect(() => {
    // Auto-configure sensible defaults per DAO type (chama-first)
    const type = String(daoData.daoType || '');
    if (!type) return;
    if (type === 'harambee') {
      setDaoData(prev => ({ ...prev, governanceModel: '1-person-1-vote', quorum: 51, votingPeriod: '24h', treasuryType: 'cusd', enableMultisig: true, multisigRequiredSignatures: 1, duration: 14 }));
    } else if (type === 'shortTerm') {
      setDaoData(prev => ({ ...prev, governanceModel: '1-person-1-vote', quorum: 50, votingPeriod: '3d', treasuryType: 'cusd', enableMultisig: true, multisigRequiredSignatures: 2, duration: 60 }));
    } else if (type === 'savings') {
      setDaoData(prev => ({ ...prev, governanceModel: '1-person-1-vote', quorum: 50, votingPeriod: '7d', treasuryType: 'cusd', enableMultisig: true, multisigRequiredSignatures: 2 }));
    } else if (type === 'community') {
      setDaoData(prev => ({ ...prev, governanceModel: '1-person-1-vote', quorum: 60, votingPeriod: '7d', treasuryType: 'cusd', enableMultisig: true, multisigRequiredSignatures: 2 }));
    } else if (type === 'investment') {
      // Investment clubs prefer contribution-weighted voting
      setDaoData(prev => ({ ...prev, governanceModel: 'weighted-stake', quorum: 60, votingPeriod: '7d', treasuryType: 'cusd', enableMultisig: true, multisigRequiredSignatures: 2 }));
    } else if (type === 'merryGoRound') {
      setDaoData(prev => ({ ...prev, governanceModel: '1-person-1-vote', quorum: 51, votingPeriod: '3d', treasuryType: 'cusd', enableMultisig: true, multisigRequiredSignatures: 1 }));
    }
  }, [daoData.daoType]);

  // Pre-populate multisig signers when multisig is enabled
  useEffect(() => {
    if (daoData.enableMultisig && (!daoData.multisigSigners || daoData.multisigSigners.length === 0)) {
      const founders = [walletAddress || ''];
      const elders = daoData.selectedElders || [];
      const unique = Array.from(new Set([...founders.filter(Boolean), ...elders]));
      setDaoData(prev => ({ ...prev, multisigSigners: unique, multisigRequiredSignatures: Math.max(2, Math.min(prev.multisigRequiredSignatures || 2, unique.length)) }));
    }
  }, [daoData.enableMultisig, daoData.selectedElders, walletAddress]);

  // Initialize treasury when DAO type is selected
  useEffect(() => {
    if (daoData.daoType && currentStep >= 4) {
      initializeTreasury(
        `dao-${Date.now()}`, // temporary ID until deployed
        daoData.daoType as DAOType
      );
    }
  }, [daoData.daoType, currentStep, initializeTreasury]);

  // Dynamic treasury options based on DAO type
  // Get treasury options derived from treasury.config (single source of truth)
  const getTreasuryOptionsForType = (type?: string) => {
    try {
      const config = getTreasuryConfigForDAOType((type || 'collective') as DAOType);
      // Derive chain options from the config's supported chains
      return config.defaultChains.map(chain => ({
        value: chain.toLowerCase(),
        label: `${chain === 'CELO' ? 'cUSD' : 'USDC'} on ${chain}`,
        desc: `Treasury using stablecoins on ${chain}`
      }));
    } catch {
      // Fallback for error cases
      return [
        { value: 'cusd', label: 'cUSD Vault', desc: 'Standard stablecoin treasury' }
      ];
    }
  };

  const roleTypes = ['member', 'moderator', 'treasurer', 'governor'];

  interface Member {
    address: string;
    role: string;
    name: string;
    id?: number;
    isPeerInvite?: boolean; // New field for peer system
  }

  interface DaoData {
    name: string;
    description: string;
    logo: string;
    category: string;
    regionalTags: string[];
    causeTags: string[];
    primaryCause?: string; // User's custom cause/reason for DAO
    visibility: string;
    governanceModel: string;
    quorum: number;
    votingPeriod: string;
    founderWallet: string;
    treasuryType: string;
    customTokenAddress?: string; // For custom stablecoin treasury
    initialFunding: string;
    depositRequired: boolean;
    members: Member[];
    inviteMessage: string;
    enableSocialReactions: boolean;
    enableDiscovery: boolean;
    featuredMessage: string;
    deployedAddress?: string;
    daoType?: 'free' | 'shortTerm' | 'collective' | 'governance' | 'meta' | 'harambee' | 'savings' | 'community' | 'investment' | 'merryGoRound';
    duration?: number;
    selectedElders: string[]; // NEW: Track selected elders
    // Multisig settings
    enableMultisig?: boolean;
    multisigSigners?: string[];
    multisigRequiredSignatures?: number;
  }

  interface NewMember {
    address: string;
    role: string;
    name: string;
  }

  type UpdateDaoDataKey = keyof DaoData;

  const updateDaoData = useCallback((key: UpdateDaoDataKey, value: DaoData[UpdateDaoDataKey]) => {
    // Sanitize string inputs
    let sanitizedValue = value;
    if (typeof value === 'string' && (key === 'name' || key === 'description')) {
      sanitizedValue = sanitizeInput(value as string, key === 'name' ? 100 : 500);
    }
    setDaoData(prev => ({ ...prev, [key]: sanitizedValue }));
  }, [sanitizeInput, setDaoData]);

  // Update orchestrator metrics when member count changes
  useEffect(() => {
    const memberCount = daoData.members.filter(m => m.address.trim()).length;
    const decentralizationLevel = Math.min(100, memberCount * 15); // More members = more decentralized
    const founderControl = Math.max(10, 100 - decentralizationLevel);
    const governanceComplexity = daoData.governanceModel === '1-person-1-vote' ? 30 : daoData.governanceModel === 'delegated' ? 60 : 80;

    orchestrator.actions.updateGovernanceMetrics({
      decentralizationLevel,
      founderControl,
      governanceComplexity,
    });

    // Update participation metrics
    const expectedParticipation = Math.min(100, (memberCount / 10) * 100);
    const quorumRealism = daoData.quorum > 60 ? Math.max(20, 100 - daoData.quorum) : 80;

    orchestrator.actions.updateParticipationMetrics({
      expectedParticipation,
      quorumRealism,
    });
  }, [daoData.members, daoData.governanceModel, daoData.quorum]);

  // Update treasury metrics
  useEffect(() => {
    const treasuryReady = daoData.initialFunding !== '' && parseFloat(daoData.initialFunding) > 0 ? 80 : 30;
    const riskLevel = 100 - (daoData.depositRequired ? 70 : 40);

    orchestrator.actions.updateTreasuryMetrics({
      treasuryReadiness: treasuryReady,
      treasuryRisk: riskLevel,
    });
  }, [daoData.initialFunding, daoData.depositRequired]);

  // Update operational mode based on current step
  useEffect(() => {
    const modeMap: { [key: number]: any } = {
      1: 'definition',
      2: 'definition',
      3: 'people',
      4: 'execution',
      5: 'execution',
    };
    orchestrator.actions.setOperationalMode(modeMap[currentStep] || 'definition');
  }, [currentStep]);

  const addMember = useCallback(() => {
    const trimmedAddress = newMember.address.trim();

    if (!trimmedAddress) {
      alert('Please enter a wallet address, phone number, or email');
      return;
    }

    if (!validateAddress(trimmedAddress)) {
      alert('Invalid address format. Use wallet (0x...), phone (+254...), or email');
      return;
    }

    // Check for duplicates
    if (daoData.members.some(m => m.address === trimmedAddress)) {
      alert('This member has already been added');
      return;
    }

    setDaoData(prev => ({
      ...prev,
      members: [...prev.members, {
        address: trimmedAddress,
        name: sanitizeInput(newMember.name, 100),
        role: newMember.role.toLowerCase(),
        id: Date.now(),
        isPeerInvite: true
      }]
    }));
    setNewMember({ address: '', role: 'member', name: '' });
  }, [newMember, daoData.members, validateAddress, sanitizeInput, setDaoData]);

  const removeMember = useCallback((index: number) => {
    const memberToRemove = daoData.members[index];
    setDaoData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
      // Remove from elders if selected
      selectedElders: prev.selectedElders.filter(e => e !== memberToRemove.address)
    }));
  }, [daoData.members, setDaoData]);

  const deployDAO = async () => {
    setIsDeploying(true);
    try {
      if (!walletAddress || !isConnected) {
        alert('Please connect your wallet before deploying.');
        setIsDeploying(false);
        return;
      }

      const eligibilityData = await authClient.get('/api/v1/daos/*/abuse/eligibility');

      if (!eligibilityData.success || !eligibilityData.data.canCreate) {
        alert(eligibilityData.data.reason || 'You cannot create a DAO at this time');
        setIsDeploying(false);
        return;
      }

      // Extract invited members (exclude founder)
      const invitedMembers = daoData.members
        .filter(m => m.address !== walletAddress)
        .map(m => m.address);

      const typeConfig = DAO_TYPE_CONFIG[daoData.daoType || ''] || {};

      // Client-side subscription gating: show upsell prompt if user tier is insufficient
      const requiredTier = typeConfig.requiredTier || 'free';
      const tierHierarchy = ['free', 'growth', 'professional', 'enterprise'];
      const userTierIndex = Math.max(0, tierHierarchy.indexOf(userTier));
      const requiredTierIndex = Math.max(0, tierHierarchy.indexOf(requiredTier));

      if (userTierIndex < requiredTierIndex) {
        // Show inline upsell modal instead of blocking confirm
        toast({ title: 'Upgrade required', description: `Creating a ${daoData.daoType} requires the ${requiredTier} plan.`, variant: 'destructive' });
        setUpsellRequiredTier(requiredTier);
        setUpsellOpen(true);
        setIsDeploying(false);
        return;
      }

      const result = await authClient.post('/api/dao-deploy', {
          daoData: {
            name: sanitizeInput(daoData.name, 100),
            description: sanitizeInput(daoData.description, 500),
            daoType: daoData.daoType,
            category: daoData.category,
            treasuryType: daoData.treasuryType,
        modules: typeConfig.modules || [],
        features: { ...(typeConfig.features || {}) },
            customTokenAddress: daoData.treasuryType === 'custom' ? daoData.customTokenAddress : undefined,
            durationDays: daoData.duration,
            rotationFrequency: daoData.daoType === 'shortTerm' ? 'monthly' : undefined
          },
          founderWallet: walletAddress,
          invitedMembers: invitedMembers,
          selectedElders: daoData.selectedElders,
          multisig: {
            enabled: !!daoData.enableMultisig,
            signers: daoData.multisigSigners || [],
            requiredSignatures: daoData.multisigRequiredSignatures || 2
          }
        });

      if (result && result.daoAddress) {
        setDaoData(prev => ({ ...prev, deployedAddress: result.daoAddress }));
        setCurrentStep(5);
      } else {
        throw new Error(result?.error || 'Deployment failed');
      }
    } catch (err) {
      console.error('Deployment error:', err);
      alert('Failed to deploy DAO. Please try again.');
    }
    setIsDeploying(false);
  };

  const nextStep = useCallback(() => {
    // Validate using hook
    if (!isStepValid) {
      return; // Errors will be shown via ErrorAlert
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      return;
    }

    // On final confirmation, deploy the DAO
    if (currentStep === 4) {
      deployDAO();
      return;
    }
  }, [currentStep, isStepValid, daoData.daoType]);

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const InfoTooltip = ({ text }: { text: string }) => (
    <Tooltip>
      <TooltipTrigger>
        <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  );

  // Step 1 - DAO Type Selection
  const renderDaoTypeSelection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">What type of group are you creating?</h2>
        <p className="text-gray-600 dark:text-gray-400">Choose the structure that best matches what your group does</p>
      </div>

      <div className="grid gap-4">
        {availableDaoTypes.map(type => (
          <Card
            key={type.id}
            className={`cursor-pointer transition-all ${
              daoData.daoType === type.id
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30'
                : 'hover:border-gray-300'
            }`}
            onClick={() => {
              setDaoData(prev => ({
                ...prev,
                daoType: type.id as any,
                treasuryType: type.defaultTreasuryType
              }));
            }}
          >
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="text-4xl">{type.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{type.label}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{type.description}</p>
                  {type.duration && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">⏱️ Duration: {type.duration}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {type.examples.map(ex => (
                      <Badge key={ex} variant="outline" className="text-xs">
                        {ex}
                      </Badge>
                    ))}
                  </div>
                </div>
                {daoData.daoType === type.id && (
                  <CheckCircle className="w-6 h-6 text-teal-500 flex-shrink-0" />
                )}
              </div>
              {type.badge && (
                <Badge className="absolute top-3 right-3 text-xs" variant={type.id === 'free' ? 'default' : 'secondary'}>
                  {type.badge}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
        {/* Upsell Modal for insufficient tier */}
        <Dialog open={upsellOpen} onOpenChange={setUpsellOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upgrade Required</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm">Creating a <strong>{daoData.daoType}</strong> requires a <strong>{upsellRequiredTier}</strong> subscription. Upgrade to unlock this DAO type and its features.</p>
              <ul className="mt-3 text-sm list-disc list-inside">
                {(DAO_TYPE_CONFIG[daoData.daoType || '']?.features ? Object.keys(DAO_TYPE_CONFIG[daoData.daoType || ''].features) : []).map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <DialogFooter>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setUpsellOpen(false)}>Cancel</Button>
                <Button onClick={() => { window.open('/pricing', '_blank'); setUpsellOpen(false); }}>View Plans</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );

  // Step 2 - Basic Info
  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Name Your Group</h2>
        <p className="text-gray-600 dark:text-gray-400">This name will be visible to everyone and cannot be changed later</p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center">
            <Label htmlFor="dao-name" className="text-sm font-medium">Group Name *</Label>
            <InfoTooltip text="This is the public name everyone will see. Choose something your members will recognize." />
          </div>
          <Input
            id="dao-name"
            placeholder="e.g., Kilifi Savings Group"
            value={daoData.name}
            onChange={(e) => updateDaoData('name', e.target.value)}
            className="mt-1"
            maxLength={100}
          />
          <CharacterCounter current={daoData.name.length} max={100} min={3} />
        </div>

        <div>
          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
          <Textarea
            id="description"
            placeholder="Tell people what your DAO is about..."
            value={daoData.description}
            onChange={(e) => updateDaoData('description', e.target.value)}
            className="mt-1 min-h-[100px]"
            maxLength={500}
          />
          <CharacterCounter current={daoData.description.length} max={500} min={20} />
        </div>

        <div>
          <Label className="text-sm font-medium">Choose a Logo</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {logoOptions.map(emoji => (
              <Button
                key={emoji}
                variant={daoData.logo === emoji ? "default" : "outline"}
                size="sm"
                onClick={() => updateDaoData('logo', emoji)}
                className="text-lg w-12 h-12"
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm font-medium">Category *</Label>
            <InfoTooltip text="Choose the category that best describes your DAO's primary purpose" />
          </div>
          <Select value={daoData.category} onValueChange={(value) => updateDaoData('category', value)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="What type of DAO is this?" />
            </SelectTrigger>
            <SelectContent>
              {getCategoriesForType(daoData.daoType).map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div className="flex items-start gap-2">
                    <span>{cat.emoji}</span>
                    <div>
                      <div className="font-medium">{cat.label}</div>
                      <div className="text-xs text-gray-500">{cat.description}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm font-medium">📍 Region (Select up to 2)</Label>
            <InfoTooltip text="Help people in your region discover your DAO" />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {regionalTags.map(tag => (
              <Button
                key={tag.value}
                variant={daoData.regionalTags.includes(tag.value) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const current = daoData.regionalTags;
                  if (current.includes(tag.value)) {
                    updateDaoData('regionalTags', current.filter(t => t !== tag.value));
                  } else if (current.length < 2) {
                    updateDaoData('regionalTags', [...current, tag.value]);
                  }
                }}
                className="text-xs"
              >
                {tag.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm font-medium">🎯 Cause & Purpose (Select up to 3)</Label>
            <InfoTooltip text="Tags help people find DAOs that align with their interests" />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {causeTags.map(tag => (
              <Button
                key={tag.value}
                variant={daoData.causeTags.includes(tag.value) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const current = daoData.causeTags;
                  if (current.includes(tag.value)) {
                    updateDaoData('causeTags', current.filter(t => t !== tag.value));
                  } else if (current.length < 3) {
                    updateDaoData('causeTags', [...current, tag.value]);
                  }
                }}
                className="text-xs"
              >
                <span className="mr-1">{tag.emoji}</span>
                {tag.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm font-medium">💬 What's your main cause? (Custom & Personal)</Label>
            <InfoTooltip text="Describe your specific reason in your own words - e.g., 'raising bond/bail money', 'funeral fund for my family', 'medical emergency support', 'education for kids'" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
            People got different needs, define yours
          </p>
          <Input
            placeholder="e.g., 'raising bail money', 'burial fund', 'business startup capital', 'medical emergency', 'education fees'"
            value={daoData.primaryCause || ''}
            onChange={(e) => updateDaoData('primaryCause', e.target.value.slice(0, 100))}
            className="mt-2"
            maxLength={100}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {(daoData.primaryCause || '').length}/100 characters
          </p>
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm font-medium">🌍 Discovery & Visibility</Label>
            <InfoTooltip text="Control who can find and join your DAO" />
          </div>
          <RadioGroup
            value={daoData.visibility}
            onValueChange={(value) => updateDaoData('visibility', value)}
            className="mt-2 space-y-2"
          >
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="public" id="public" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="public" className="font-medium cursor-pointer">
                  🌐 Public - Discover Everywhere
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Appears in discovery feed, trending lists, and search results
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="regional" id="regional" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="regional" className="font-medium cursor-pointer">
                  📍 Regional Only
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Only visible in your region's discovery feed
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="private" id="private" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="private" className="font-medium cursor-pointer">
                  🔒 Private - Invite Only
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Not discoverable, members join via invite link only
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );

  // Step 3 - Select Elders (Trustees)
  const renderElderSelection = () => {
    // Get members excluding founder for elder selection
    const selectableMembers = daoData.members.filter(m => m.address !== walletAddress);
    const minElders = daoData.daoType === 'shortTerm' || daoData.daoType === 'free' ? 1 : 2;
    const maxElders = daoData.daoType === 'shortTerm' || daoData.daoType === 'free' ? 3 : 5;
    const isElderValid = daoData.selectedElders.length >= minElders && daoData.selectedElders.length <= maxElders;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose Your Trustees (Elders)</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Select {minElders}-{maxElders} trusted people who will help manage the group's money
          </p>
        </div>

        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">What are Elders? (Like Table Banking Signatories)</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 mb-2">
                  Think of Elders like the trusted signatories in a table banking group. Just like how table banking
                  requires multiple signatories to approve withdrawals, Elders must agree before money can be moved.
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>Multiple Elders must approve before money leaves the group</li>
                  <li>Protects against fraud - no single person can run off with funds</li>
                  <li>They vote on important group decisions</li>
                  <li>Choose people the group trusts - like your chama officials</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              👤 You (founder) will automatically be an elder
            </p>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Select Additional Elders</Label>
              <Badge variant={isElderValid ? 'default' : 'destructive'} className="text-xs">
                {daoData.selectedElders.length}/{minElders}-{maxElders}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Select {minElders}-{maxElders} members to be elders
            </p>
          </div>

          {selectableMembers.length === 0 ? (
            <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardContent className="p-6">
                <p className="text-center text-gray-500 dark:text-gray-400">
                  No additional members to select. Please add members first in step 5.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {selectableMembers.map((member) => (
                <Card key={member.address} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setDaoData(prev => {
                      const newElders = prev.selectedElders.includes(member.address)
                        ? prev.selectedElders.filter(a => a !== member.address)
                        : prev.selectedElders.length < maxElders
                          ? [...prev.selectedElders, member.address]
                          : prev.selectedElders;
                      return { ...prev, selectedElders: newElders };
                    });
                  }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          title={`Select ${member.name || 'this member'} as elder`}
                          checked={daoData.selectedElders.includes(member.address)}
                          onChange={() => {}}
                          disabled={!daoData.selectedElders.includes(member.address) && daoData.selectedElders.length >= maxElders}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                          aria-label={`Select ${member.name || 'member'} as elder`}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{member.name || 'Anonymous'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{member.address}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={member.role === 'governor' ? 'default' : 'secondary'} className="text-xs">
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {!isElderValid && selectableMembers.length > 0 && (
          <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">
                    Select {minElders}-{maxElders} elders to continue
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Currently selected: {daoData.selectedElders.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Step 4 - Governance
  const renderGovernance = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">How Will Your Group Make Decisions?</h2>
        <p className="text-gray-600 dark:text-gray-400">Choose how members will vote on {t('proposals').toLowerCase()} and approve spending</p>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center mb-3">
            <Label className="text-sm font-medium">Voting Method</Label>
            <InfoTooltip text="This decides who has more say in group decisions" />
          </div>
          <RadioGroup
            value={daoData.governanceModel}
            onValueChange={(value) => updateDaoData('governanceModel', value)}
            className="space-y-3"
          >
            {governanceModels.map(model => (
              <div key={model.value} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <RadioGroupItem value={model.value} id={model.value} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={model.value} className="font-medium cursor-pointer">
                    {model.label}
                  </Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{model.desc}</p>
                  <p className="text-xs text-teal-600 dark:text-teal-400 mt-1 italic">{model.example}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Best for: {model.best_for}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Label className="text-sm font-medium">Minimum Voters Required: {daoData.quorum}%</Label>
              <InfoTooltip text="How many members must vote for a decision to count? At least 20% must participate to prevent a small group from making all decisions." />
            </div>
            {daoData.quorum < MINIMUM_QUORUM && (
              <Badge variant="destructive" className="text-xs">Below minimum</Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Example: If you have 10 members and set this to 50%, at least 5 people must vote for the vote to count
          </p>
          <Slider
            value={[daoData.quorum]}
            onValueChange={([value]) => updateDaoData('quorum', Math.max(value, MINIMUM_QUORUM))}
            min={MINIMUM_QUORUM}
            max={100}
            step={5}
            className="mt-2"
          />
          {daoData.quorum === MINIMUM_QUORUM && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
              ⚠️ This is the minimum allowed quorum for democratic governance
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm font-medium">Voting Period</Label>
            <InfoTooltip text={`How long members have to vote on ${t('proposals').toLowerCase()}`} />
          </div>
          <Select value={daoData.votingPeriod} onValueChange={(value) => updateDaoData('votingPeriod', value)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 hours</SelectItem>
              <SelectItem value="3d">3 days</SelectItem>
              <SelectItem value="7d">7 days (Recommended)</SelectItem>
              <SelectItem value="14d">14 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  // Step 5 - Treasury
  const renderTreasury = () => {
    // Get treasury intelligence
    const { intelligence, treasuryCharacter, healthStatus, analyze } = useTreasuryIntelligence();

    // Analyze treasury when it becomes available
    useEffect(() => {
      if (treasury) {
        // Use mock price data for now - in production this would come from an oracle
        const mockPriceData: Record<string, number> = {
          'CELO-CELO': 0.75,
          'cUSD-CELO': 1.0,
          'USDC-ETH': 1.0,
          'DAI-ETH': 1.0,
          'USDC-BSC': 1.0
        };
        analyze(treasury, mockPriceData);
      }
    }, [treasury, analyze]);

    return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Set Up Your Group's Treasury</h2>
        <p className="text-gray-600 dark:text-gray-400">This is where your group's money will be kept - like a shared bank account</p>
      </div>

      {/* Treasury Configuration Summary */}
      {treasury && (
        <Card className="bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800">
          <CardHeader>
            <CardTitle className="text-teal-800 dark:text-teal-200 flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Treasury Configuration for {daoData.daoType?.toUpperCase() || 'Your DAO'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Supported Assets</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {treasury.assets.map((asset, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {asset.symbol} ({asset.chain})
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Multisig Required</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={treasury.multisigRequired ? 'destructive' : 'secondary'} className="text-xs">
                    {treasury.multisigRequired ? `Yes (${treasury.minSigners} signers min)` : 'Optional'}
                  </Badge>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Member Deposits</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={treasury.membersCanDeposit ? 'secondary' : 'outline'} className="text-xs">
                    {treasury.membersCanDeposit ? 'Allowed' : 'Not Allowed'}
                  </Badge>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Custom Tokens</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={treasury.customTokenAllowed ? 'secondary' : 'outline'} className="text-xs">
                    {treasury.customTokenAllowed ? 'Allowed' : 'Not Allowed'}
                  </Badge>
                </div>
              </div>
            </div>

            <Alert className="border-teal-200 dark:border-teal-800 bg-teal-100/50 dark:bg-teal-900/20">
              <Info className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <AlertDescription className="text-teal-700 dark:text-teal-300 text-sm">
                All settings above are automatically configured based on your DAO type for security and best practices.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Treasury Intelligence Dashboard - Layer 3 */}
      {intelligence && (
        <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="text-purple-800 dark:text-purple-200 flex items-center gap-2">
              <BarChart2 className="w-5 h-5" />
              Treasury Intelligence & Insights
            </CardTitle>
            <p className="text-sm text-purple-700 dark:text-purple-300 mt-2">AI-powered analysis of your treasury setup</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Treasury Character & Health Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border-l-4 border-purple-500">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-2">Treasury Character</p>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <Badge className="text-xs" variant="outline">
                    {treasuryCharacter() || 'Analyzing...'}
                  </Badge>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-2">Health Status</p>
                <div className="flex items-center gap-2">
                  {healthStatus() === 'healthy' && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
                  {healthStatus() === 'caution' && <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  {healthStatus() === 'critical' && <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />}
                  <Badge className="text-xs" variant={healthStatus() === 'healthy' ? 'secondary' : healthStatus() === 'caution' ? 'outline' : 'destructive'}>
                    {healthStatus()?.charAt(0).toUpperCase() + healthStatus()?.slice(1) || 'Analyzing...'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Governance Formula Recommendation */}
            {intelligence.recommendedGovernanceFormula && (
              <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border-l-4 border-indigo-500">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-2">Recommended Voting Formula</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                      {intelligence.recommendedGovernanceFormula.charAt(0).toUpperCase() + intelligence.recommendedGovernanceFormula.slice(1)}
                    </p>
                  </div>
                  <Send className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                </div>
              </div>
            )}

            {/* Risks Section */}
            {intelligence.risks && intelligence.risks.length > 0 && (
              <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border-l-4 border-red-500">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-3">⚠️ Identified Risks</p>
                <div className="space-y-2">
                  {intelligence.risks.slice(0, 3).map((risk, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <span>{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opportunities Section */}
            {intelligence.opportunities && intelligence.opportunities.length > 0 && (
              <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border-l-4 border-green-500">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-3">💡 Opportunities</p>
                <div className="space-y-2">
                  {intelligence.opportunities.slice(0, 3).map((opp, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Zap className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <span>{opp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Insights */}
            {intelligence.semanticSummary?.keyInsights && intelligence.semanticSummary.keyInsights.length > 0 && (
              <Alert className="border-purple-200 dark:border-purple-800 bg-purple-100/50 dark:bg-purple-900/20">
                <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <AlertDescription>
                  <p className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-2">Key Insights:</p>
                  <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1 list-disc list-inside">
                    {intelligence.semanticSummary.keyInsights.slice(0, 2).map((insight, idx) => (
                      <li key={idx}>{insight}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {treasuryError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{treasuryError}</AlertDescription>
        </Alert>
      )}

      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="font-medium">Advanced governance and multisig configuration have moved to the DAO Settings.</p>
        <p className="text-xs text-gray-500">You can review and customize voting, quorum(votes required), and multisig signers anytime in Settings.</p>
        <div className="mt-3">
          <Button onClick={() => window.location.href = '/dao/settings'}>Open DAO Settings</Button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center mb-3">
            <Label className="text-sm font-medium">Treasury Type</Label>
            <InfoTooltip text="Choose how your DAO will store and manage funds" />
          </div>
          <div className="space-y-3">
            {getTreasuryOptionsForType(daoData.daoType).map(treasury => (
              <Card
                key={treasury.value}
                className={`cursor-pointer transition-all ${
                  daoData.treasuryType === treasury.value
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => updateDaoData('treasuryType', treasury.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      daoData.treasuryType === treasury.value
                        ? 'bg-teal-500 border-teal-500'
                        : 'border-gray-300'
                    }`}>
                      {daoData.treasuryType === treasury.value && (
                        <div className="w-2 h-2 rounded-full bg-white mx-auto mt-0.5"></div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">{treasury.label}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{treasury.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Custom Token Address Input - Only shown for custom treasury */}
        {daoData.treasuryType === 'custom' && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Custom Stablecoin Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center">
                  <Label htmlFor="custom-token" className="text-sm font-medium">Token Contract Address</Label>
                  <InfoTooltip text="The contract address of your custom stablecoin (e.g., USDT on Celo, DAI, etc.)" />
                </div>
                <Input
                  id="custom-token"
                  placeholder="0x..."
                  value={daoData.customTokenAddress || ''}
                  onChange={(e) => updateDaoData('customTokenAddress', e.target.value)}
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Must be a valid Celo network contract address starting with 0x followed by 40 hex characters
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Duration selector for short-term DAOs */}
        {daoData.daoType === 'shortTerm' && (
          <div>
            <div className="flex items-center mb-3">
              <Label className="text-sm font-medium">Fund Duration</Label>
              <InfoTooltip text="How long this fund will operate before completion" />
            </div>
            <div className="space-y-3">
              {[
                { value: 30, label: '30 Days', desc: 'Quick fund cycle - ideal for events or urgent needs' },
                { value: 60, label: '60 Days', desc: 'Standard cycle - good for most short-term goals' },
                { value: 90, label: '90 Days', desc: 'Extended cycle - time for participation and growth' }
              ].map(option => (
                <Card
                  key={option.value}
                  className={`cursor-pointer transition-all ${
                    daoData.duration === option.value
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30'
                      : 'hover:border-gray-300'
                  }`}
                  onClick={() => updateDaoData('duration', option.value)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        daoData.duration === option.value
                          ? 'bg-teal-500 border-teal-500'
                          : 'border-gray-300'
                      }`}>
                        {daoData.duration === option.value && (
                          <div className="w-2 h-2 rounded-full bg-white mx-auto mt-0.5"></div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium">{option.label}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{option.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center">
            <Label htmlFor="initial-funding" className="text-sm font-medium">Initial Funding (Optional)</Label>
            <InfoTooltip text="You can add funds to the treasury now or later" />
          </div>
          <div className="relative mt-1">
            <Input
              id="initial-funding"
              type="number"
              placeholder="0.00"
              value={daoData.initialFunding}
              onChange={(e) => updateDaoData('initialFunding', e.target.value)}
              className="pr-16"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              {daoData.treasuryType === 'cusd' ? 'cUSD' : daoData.treasuryType === 'dual' ? 'CELO' : 'USD'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label className="text-sm font-medium">Require Member Deposits</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">Members must deposit to join</p>
          </div>
          <Switch
            checked={daoData.depositRequired}
            onCheckedChange={(checked) => updateDaoData('depositRequired', checked)}
          />
        </div>
      </div>
    </div>
    );
  };

  // Step 6 - Members (with Peer Invite System)
  const renderMembers = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Add Members</h2>
        <p className="text-gray-600 dark:text-gray-400">Invite your community to join the DAO</p>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Peer Invite System</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Members you add now will receive peer invite links. They can use these to onboard others, creating a trusted network effect. Each invite is tracked for accountability.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm">Name (Optional)</Label>
              <Input
                placeholder="John Doe"
                value={newMember.name}
                onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <div className="flex items-center">
                <Label className="text-sm">Wallet / Phone / Email</Label>
                <InfoTooltip text="Enter wallet address, phone number (+254...), or email" />
              </div>
              <Input
                placeholder="Name or phone (+254...) or wallet (0x...)"
                value={newMember.address}
                onChange={(e) => setNewMember(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            {/* Roles are assigned in Settings. Everyone starts as Member during creation. */}
            <div>
              <Label className="text-sm">Role</Label>
              <p className="text-xs text-gray-500">All invited people will start as <strong>Member</strong>. Assign roles later in Settings.</p>
            </div>
          </div>
          <Button onClick={addMember} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Member (Will receive peer invite)
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-medium mb-3">Current Members ({daoData.members.length})</h3>
        <div className="space-y-2">
          {daoData.members.map((member, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="font-medium">{member.name || 'Anonymous'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{member.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === 'governor' ? 'default' : 'secondary'}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                    {member.isPeerInvite && (
                      <Badge variant="outline" className="text-xs">
                        Peer Invite
                      </Badge>
                    )}
                    {index > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMember(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  // Step 7 - Preview
  const renderPreview = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Review Your DAO</h2>
        <p className="text-gray-600 dark:text-gray-400">Everything looks good? Time to deploy!</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Basic Information
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)}>
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{daoData.logo}</div>
              <div>
                <h3 className="font-semibold text-lg">{daoData.name || 'Unnamed DAO'}</h3>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">
                    {daoTypeOptions.find(d => d.id === daoData.daoType)?.label || 'DAO'}
                  </Badge>
                  <Badge variant="outline">
                    {getCategoriesForType(daoData.daoType).find(c => c.value === daoData.category)?.label || 'No category'}
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">{daoData.description || 'No description provided'}</p>
          </CardContent>
        </Card>

        {/* Treasury Section (simplified for creation) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Treasury
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/dao/settings'}>
              Manage
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">STARTING AMOUNT</Label>
                <p className="font-medium">
                  {daoData.initialFunding && parseFloat(daoData.initialFunding) > 0
                    ? `${daoData.initialFunding} cUSD`
                    : 'None'}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">DEPOSITS</Label>
                <p className="font-medium">{daoData.depositRequired ? 'Required' : 'Optional'}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Treasury type defaults to cUSD. Advanced treasury options and analysis are available in DAO Settings after creation.</p>
          </CardContent>
        </Card>

        {/* Governance (moved to settings) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Governance
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/dao/settings'}>
              Manage
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Default: Equal Voice (1-person-1-vote), Quorum 50%, Voting period 7 days.</p>
            <p className="text-xs text-gray-400">Advanced governance settings (quorum, voting period, delegated models) are configurable in DAO Settings after creation.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Members ({daoData.members.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(3)}>
              Edit
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {daoData.members.slice(0, 3).map((member, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{member.address.slice(0, 20)}...</span>
                  <div className="flex gap-2">
                    <Badge variant={member.role === 'governor' ? 'default' : 'secondary'} className="text-xs">
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                    {member.isPeerInvite && (
                      <Badge variant="outline" className="text-xs">Peer</Badge>
                    )}
                  </div>
                </div>
              ))}
              {daoData.members.length > 3 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">+ {daoData.members.length - 3} more members</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 mb-4">
        <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        <AlertTitle className="text-orange-800 dark:text-orange-200">Final Check Before Creating</AlertTitle>
        <AlertDescription className="text-orange-700 dark:text-orange-300">
          <ul className="list-disc list-inside text-sm space-y-1 mt-2">
            <li>The group name <strong>"{daoData.name || 'Your Group'}"</strong> will be <strong>permanent</strong></li>
            <li>Everyone can see your group and its transactions</li>
            <li>You <strong>cannot delete</strong> this group once created</li>
            <li>This is like registering a company - the record exists forever</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-950/30 dark:to-teal-900/30 p-6 rounded-lg border border-teal-200 dark:border-teal-800">
        <div className="flex items-center gap-3 mb-4">
          <Send className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ready to Create Your Group?</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          By clicking below, your group will be permanently created on the blockchain. All settings above are final.
        </p>
        <Button
          onClick={deployDAO}
          disabled={isDeploying}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white py-3"
          size="lg"
          data-testid="button-deploy-dao"
        >
          {isDeploying ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Creating Your Group...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Create My Group (This is Final)
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Step 8 - Success
  const renderSuccess = () => (
    <div className="text-center space-y-8">
      <div className="space-y-4">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">🎉 DAO Created Successfully!</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">Welcome to the future of community governance</p>
        </div>
      </div>

      <Card className="text-left">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {daoData.logo}
            {daoData.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">DAO ADDRESS</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono flex-1">
                {daoData.deployedAddress || '0x8f2e...A4D9'}
              </code>
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(daoData.deployedAddress || '')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">PEER INVITE LINKS</Label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2">
              Each founding member will receive a unique peer invite link to onboard others
            </p>
            <Badge variant="secondary" className="text-xs">
              {daoData.members.filter(m => m.isPeerInvite).length} peer invites generated
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button onClick={() => window.location.href = '/dashboard'}>
          <Settings className="w-4 h-4 mr-2" />
          Go to Dashboard
        </Button>
        <Button variant="outline" onClick={() => window.location.href = `/dao/${daoData.deployedAddress}/invite`}>
          <Users className="w-4 h-4 mr-2" />
          Manage Invites
        </Button>
        <Button variant="outline" onClick={() => window.location.href = `/dao/${daoData.deployedAddress}/fund`}>
          <Wallet className="w-4 h-4 mr-2" />
          Fund Treasury
        </Button>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderDaoTypeSelection();
      case 2: return renderBasicInfo();
      case 3: return renderMembers();
      case 4: return renderPreview();
      case 5: return renderSuccess();
      default: return renderDaoTypeSelection();
    }
  };

  if (showExplainer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardContent className="p-8">
              <WhatIsDAOExplainer onContinue={() => setShowExplainer(false)} />
            </CardContent>
          </Card>
          <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
            <p>Powered by Celo Blockchain</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* SYSTEM HEALTH STATUS - Show on steps 2+ */}
        {currentStep >= 2 && currentStep < 5 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">DAO System Health</h3>
              <RiskLevelBadge />
            </div>
            <SystemHealthBanner />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2">
                <WarningsAndSuggestionsPanel />
              </div>
              <AdaptiveReadinessMeter />
            </div>
          </div>
        )}

        {currentStep < 5 && (
          <div className="mb-8">
            <div className="flex items-center justify-between overflow-x-auto">
              {steps.slice(0, -1).map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div key={step.id} className="flex items-center flex-shrink-0">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      isActive
                        ? 'border-teal-500 bg-teal-500 text-white'
                        : isCompleted
                          ? 'border-teal-500 bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400'
                          : 'border-gray-300 bg-white dark:bg-slate-800 text-gray-400'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="ml-2 hidden sm:block">
                      <p className={`text-sm font-medium whitespace-nowrap ${
                        isActive || isCompleted ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {step.title}
                      </p>
                    </div>
                    {index < steps.length - 2 && (
                      <div className={`w-12 sm:w-20 h-1 mx-4 transition-all ${
                        currentStep > step.id ? 'bg-teal-500' : 'bg-gray-200 dark:bg-gray-700'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Card className="mb-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="p-8">
            {currentStep < 5 && <BlockchainWarningBanner />}

            {lastSaved && (
              <div className="text-xs text-gray-500 mb-4 flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-600" />
                Draft auto-saved at {lastSaved.toLocaleTimeString()}
              </div>
            )}

            <ErrorAlert errors={validationErrors} />

            {renderStepContent()}
          </CardContent>
        </Card>

        {currentStep < 5 && (
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="flex items-center gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                Back
              </Button>
              {currentStep === 1 && lastSaved && (
                <Button
                  variant="ghost"
                  onClick={clearDraft}
                  className="text-xs"
                >
                  Clear Draft
                </Button>
              )}
            </div>

            <Button
              onClick={nextStep}
              disabled={!isStepValid}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700"
            >
              {currentStep === 4 ? 'Create' : 'Continue'}
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="text-center mt-12 text-sm text-gray-500 dark:text-gray-400">
          <p>Powered by Celo • Secured by blockchain • Built for communities</p>
        </div>
      </div>
    </div>
  );
};

// Wrapped component with orchestrator provider
const CreateDAOFlow = () => {
  return (
    <DAOOrchestratorProvider>
      <CreateDAOFlowContent />
    </DAOOrchestratorProvider>
  );
};

export default CreateDAOFlow;