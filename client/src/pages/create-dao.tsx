import React, { useState, useEffect } from 'react';
import { useWallet } from './hooks/useWallet';
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
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Shield,
  Wallet,
  Settings,
  Eye,
  Rocket,
  CheckCircle,
  Plus,
  Trash2,
  Upload,
  Copy,
  Info,
  HelpCircle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const MINIMUM_QUORUM = 20; // 20% minimum quorum

const CreateDAOFlow = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const { address: walletAddress, isConnected } = useWallet();
  const [daoData, setDaoData] = useState<DaoData>({
    name: '',
    description: '',
    logo: '🏛️',
    category: '',
    regionalTags: [],
    causeTags: [],
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
    featuredMessage: ''
  });

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
  const [selectedElders, setSelectedElders] = useState<string[]>([]); // NEW: Track elder selections

  // DAO Type Options with subscription tier gating
  const daoTypeOptions = [
    {
      id: 'free',
      label: 'Free Community DAO',
      icon: '🆓',
      duration: '30 days (testing)',
      description: 'Test DAO features with basic limits',
      examples: ['Small group', 'Test project'],
      requiresGovernance: false,
      defaultTreasuryType: 'cusd',
      requiredTier: 'free', // Available to all tiers
      badge: 'FREE'
    },
    {
      id: 'shortTerm',
      label: 'Short-Term Fund',
      icon: '⏱️',
      duration: '3-6 months',
      description: 'Quick rotating funds, burial support, harambee',
      examples: ['Merry-go-round', 'Burial fund', 'Event contribution'],
      requiresGovernance: false,
      defaultTreasuryType: 'cusd',
      requiredTier: 'growth', // Requires Growth or higher
      badge: 'GROWTH+'
    },
    {
      id: 'collective',
      label: 'Collective / Savings Group',
      icon: '🤝',
      duration: 'Ongoing',
      description: 'Regular savings, investment clubs, cooperatives',
      examples: ['Savings group', 'Table banking', 'Traders coop'],
      requiresGovernance: true,
      defaultTreasuryType: 'cusd',
      requiredTier: 'professional', // Requires Professional or higher
      badge: 'PRO+'
    },
    {
      id: 'governance',
      label: 'Governance DAO',
      icon: '🏛️',
      duration: 'Ongoing',
      description: 'Community leadership, major decisions',
      examples: ['Community council', 'District leadership'],
      requiresGovernance: true,
      defaultTreasuryType: 'dual',
      requiredTier: 'professional',
      badge: 'PRO+'
    },
    {
      id: 'meta',
      label: 'MetaDAO Network',
      icon: '🌐',
      duration: 'Continuous',
      description: 'Multi-DAO coordination and regional networks',
      examples: ['Regional alliance', 'DAO federation'],
      requiresGovernance: true,
      defaultTreasuryType: 'dual',
      requiredTier: 'enterprise', // Enterprise only
      badge: 'ENTERPRISE'
    }
  ];

  // Filter DAO types based on user's subscription tier
  const getAvailableDaoTypes = (userTier: string) => {
    const tierHierarchy = ['free', 'growth', 'professional', 'enterprise'];
    const userTierIndex = tierHierarchy.indexOf(userTier);

    return daoTypeOptions.filter(option => {
      const requiredTierIndex = tierHierarchy.indexOf(option.requiredTier);
      return userTierIndex >= requiredTierIndex;
    });
  };

  // Get user's current subscription tier (you'll need to fetch this)
  // NOTE: This requires React Query to be set up in your project.
  // If you don't have it, you'll need to replace this with a state management solution
  // or a direct API call within useEffect.
  const { data: userSubscription } = useQuery({
    queryKey: ['/api/user/subscription'],
    queryFn: async () => {
      const response = await fetch('/api/user/subscription', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch subscription');
      return response.json();
    },
    enabled: isConnected, // Only fetch if wallet is connected
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Garbage collect after 10 minutes
  });

  const userTier = userSubscription?.tier || 'free';
  const availableDaoTypes = getAvailableDaoTypes(userTier);

  const steps = [
    { id: 1, title: 'DAO Type', icon: Settings }, // NEW: Step 1
    { id: 2, title: 'Basic Info', icon: Settings },
    { id: 3, title: 'Select Elders', icon: Shield },
    { id: 4, title: 'Governance', icon: Shield },
    { id: 5, title: 'Treasury', icon: Wallet },
    { id: 6, title: 'Members', icon: Users },
    { id: 7, title: 'Preview', icon: Eye },
    { id: 8, title: 'Success', icon: CheckCircle }
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
    { value: 'governance', label: 'Governance', emoji: '🏛️', description: 'Decision-making and community leadership' },
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
      label: '1 Person = 1 Vote',
      desc: 'Every member has equal voting power regardless of contribution',
      best_for: 'Community groups, social DAOs'
    },
    {
      value: 'weighted-stake',
      label: 'Weighted by Stake',
      desc: 'Voting power proportional to treasury contribution',
      best_for: 'Investment clubs, business ventures'
    },
    {
      value: 'delegated',
      label: 'Delegated Voting',
      desc: 'Members can delegate their votes to trusted representatives',
      best_for: 'Large DAOs, governance-focused groups'
    }
  ];

  const treasuryTypes = [
    { value: 'cusd', label: 'cUSD Vault', desc: 'Simple stable treasury in Celo Dollars (USD-pegged)' },
    { value: 'dual', label: 'CELO + cUSD Dual', desc: 'Mixed treasury with growth potential and stability' },
    { value: 'custom', label: 'Custom Stablecoin', desc: 'USDT, DAI or other tokens (coming soon)' }
  ];

  // Dynamic treasury options based on DAO type
  const getTreasuryOptionsForType = (type?: string) => {
    const optionsByType: Record<string, typeof treasuryTypes> = {
      shortTerm: [
        { value: 'cusd', label: 'cUSD Vault', desc: 'Simple stable treasury in Celo Dollars' }
      ],
      collective: [
        { value: 'cusd', label: 'cUSD Vault', desc: 'Stable treasury for regular savings' },
        { value: 'dual', label: 'CELO + cUSD Dual', desc: 'Mixed treasury with growth potential' }
      ],
      governance: [
        { value: 'cusd', label: 'cUSD Vault', desc: 'Stable treasury for governance funds' },
        { value: 'dual', label: 'CELO + cUSD Dual', desc: 'Mixed treasury with growth potential' },
        { value: 'custom', label: 'Custom Stablecoin', desc: 'USDT, DAI or other tokens (coming soon)' }
      ],
      free: [ // Treasury options for Free DAO type
        { value: 'cusd', label: 'cUSD Vault', desc: 'Standard stablecoin treasury' }
      ],
      meta: [ // Treasury options for MetaDAO type
        { value: 'dual', label: 'CELO + cUSD Dual', desc: 'Robust treasury for network operations' },
        { value: 'custom', label: 'Custom Stablecoin', desc: 'Flexible treasury for specific needs' }
      ]
    };

    // Fallback to collective if type not found or specific options not defined
    return optionsByType[type || 'collective'] || optionsByType['collective'];
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
    visibility: string;
    governanceModel: string;
    quorum: number;
    votingPeriod: string;
    founderWallet: string;
    treasuryType: string;
    initialFunding: string;
    depositRequired: boolean;
    members: Member[];
    inviteMessage: string;
    enableSocialReactions: boolean;
    enableDiscovery: boolean;
    featuredMessage: string;
    deployedAddress?: string;
    daoType?: 'free' | 'shortTerm' | 'collective' | 'governance' | 'meta'; // Updated to include new types
    duration?: number;
  }

  interface NewMember {
    address: string;
    role: string;
    name: string;
  }

  type UpdateDaoDataKey = keyof DaoData;

  const updateDaoData = (key: UpdateDaoDataKey, value: DaoData[UpdateDaoDataKey]) => {
    setDaoData(prev => ({ ...prev, [key]: value }));
  };

  const addMember = () => {
    if (newMember.address.trim()) {
      setDaoData(prev => ({
        ...prev,
        members: [...prev.members, {
          ...newMember,
          role: newMember.role.toLowerCase(),
          id: Date.now(),
          isPeerInvite: true // Mark as peer invite
        }]
      }));
      setNewMember({ address: '', role: 'member', name: '' });
    }
  };

  const removeMember = (index: number) => {
    setDaoData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index)
    }));
  };

  const deployDAO = async () => {
    setIsDeploying(true);
    try {
      if (!walletAddress || !isConnected) {
        alert('Please connect your wallet before deploying.');
        setIsDeploying(false);
        return;
      }

      const eligibilityCheck = await fetch('/api/dao-abuse-prevention/check-eligibility', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const eligibilityData = await eligibilityCheck.json();

      if (!eligibilityData.success || !eligibilityData.data.canCreate) {
        alert(eligibilityData.data.reason || 'You cannot create a DAO at this time');
        setIsDeploying(false);
        return;
      }

      // Extract invited members (exclude founder)
      const invitedMembers = daoData.members
        .filter(m => m.address !== walletAddress)
        .map(m => m.address);

      const response = await fetch('/api/dao-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daoData: {
            name: daoData.name,
            description: daoData.description,
            daoType: daoData.daoType,
            category: daoData.category,
            treasuryType: daoData.treasuryType,
            durationDays: daoData.duration,
            rotationFrequency: daoData.daoType === 'shortTerm' ? 'monthly' : undefined
          },
          founderWallet: walletAddress,
          invitedMembers: invitedMembers,
          selectedElders: selectedElders
        })
      });

      const result = await response.json();
      if (response.ok && result.daoAddress) {
        setDaoData(prev => ({ ...prev, deployedAddress: result.daoAddress }));
        setCurrentStep(8);
      } else {
        throw new Error(result.error || 'Deployment failed');
      }
    } catch (err) {
      console.error('Deployment error:', err);
      alert('Failed to deploy DAO. Please try again.');
    }
    setIsDeploying(false);
  };

  const nextStep = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      // DAO type validation
      if (!daoData.daoType) {
        alert('Please select a DAO type to continue');
        return;
      }
    } else if (currentStep === 2) {
      // Basic Info validation
      if (!daoData.name.trim()) {
        alert('Please enter a DAO name');
        return;
      }
    } else if (currentStep === 3) {
      // Elder selection validation
      const minElders = 2;
      const maxElders = 5;
      if (selectedElders.length < minElders || selectedElders.length > maxElders) {
        alert(`Please select ${minElders}-${maxElders} elders to continue`);
        return;
      }
    }

    // For short-term DAOs, skip governance step
    if (currentStep === 4 && daoData.daoType === 'shortTerm') {
      setCurrentStep(5);  // Skip to Treasury
      return;
    }

    if (currentStep < 8) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    // For short-term DAOs, skip governance step when going back
    if (currentStep === 5 && daoData.daoType === 'shortTerm') {
      setCurrentStep(3);  // Jump back to Elder Selection
      return;
    }
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">What type of group is this?</h2>
        <p className="text-gray-600 dark:text-gray-400">Choose the structure that best fits your community</p>
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
                daoType: type.id,
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
    </div>
  );

  // Step 2 - Basic Info
  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Let's create your DAO</h2>
        <p className="text-gray-600 dark:text-gray-400">Start with the basics - what's your community about?</p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center">
            <Label htmlFor="dao-name" className="text-sm font-medium">DAO Name *</Label>
            <InfoTooltip text="This is the public name of your DAO that everyone will see" />
          </div>
          <Input
            id="dao-name"
            placeholder="e.g., Kilifi Savings Group"
            value={daoData.name}
            onChange={(e) => updateDaoData('name', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
          <Textarea
            id="description"
            placeholder="Tell people what your DAO is about..."
            value={daoData.description}
            onChange={(e) => updateDaoData('description', e.target.value)}
            className="mt-1 min-h-[100px]"
          />
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

  // Step 3 - Select Elders
  const renderElderSelection = () => {
    // Get members excluding founder for elder selection
    const selectableMembers = daoData.members.filter(m => m.address !== walletAddress);
    const minElders = daoData.daoType === 'shortTerm' || daoData.daoType === 'free' ? 1 : 2; // Adjusted min for shortTerm/free
    const maxElders = daoData.daoType === 'shortTerm' || daoData.daoType === 'free' ? 3 : 5; // Adjusted max for shortTerm/free
    const isElderValid = selectedElders.length >= minElders && selectedElders.length <= maxElders;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Select Elders</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Choose {minElders}-{maxElders} trusted members to be elders who can approve withdrawals and manage the DAO
          </p>
        </div>

        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">What are Elders?</h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                  <li>✓ Can approve fund withdrawals</li>
                  <li>✓ Vote on important DAO decisions</li>
                  <li>✓ Manage treasury access and permissions</li>
                  <li>✓ Act as trusted custodians of the group</li>
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
                {selectedElders.length}/{minElders}-{maxElders}
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
                    if (selectedElders.includes(member.address)) {
                      setSelectedElders(selectedElders.filter(a => a !== member.address));
                    } else if (selectedElders.length < maxElders) {
                      setSelectedElders([...selectedElders, member.address]);
                    }
                  }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          title={`Select ${member.name || 'this member'} as elder`}
                          checked={selectedElders.includes(member.address)}
                          onChange={() => {}}
                          disabled={!selectedElders.includes(member.address) && selectedElders.length >= maxElders}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
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
                    Currently selected: {selectedElders.length}
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Governance Setup</h2>
        <p className="text-gray-600 dark:text-gray-400">How will your DAO make decisions?</p>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center mb-3">
            <Label className="text-sm font-medium">Governance Model</Label>
            <InfoTooltip text="This determines how voting power is distributed among members" />
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
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Best for: {model.best_for}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Label className="text-sm font-medium">Quorum Threshold: {daoData.quorum}%</Label>
              <InfoTooltip text="Minimum percentage of members who must vote for a proposal to pass. Cannot be below 20% to ensure democratic participation" />
            </div>
            {daoData.quorum < MINIMUM_QUORUM && (
              <Badge variant="destructive" className="text-xs">Below minimum</Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Minimum participation needed for votes to pass (min: {MINIMUM_QUORUM}%)
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
            <InfoTooltip text="How long members have to vote on proposals" />
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
  const renderTreasury = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Treasury Setup</h2>
        <p className="text-gray-600 dark:text-gray-400">Configure your DAO's financial foundation</p>
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
                placeholder="0x... or +254... or email"
                value={newMember.address}
                onChange={(e) => setNewMember(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div>
              <div className="flex items-center">
                <Label className="text-sm">Role</Label>
                <InfoTooltip text="Member: basic rights | Moderator: can moderate | Treasurer: financial access | Governor: full control" />
              </div>
              <Select value={newMember.role} onValueChange={(value) => setNewMember(prev => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleTypes.map(role => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        {/* Treasury Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Treasury Configuration
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(5)}>
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">TREASURY TYPE</Label>
                <p className="font-medium">
                  {getTreasuryOptionsForType(daoData.daoType).find(t => t.value === daoData.treasuryType)?.label || 'Not selected'}
                </p>
              </div>
              {daoData.daoType === 'shortTerm' && (
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">DURATION</Label>
                  <p className="font-medium">{daoData.duration} days</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">INITIAL FUNDING</Label>
                <p className="font-medium">
                  {daoData.initialFunding && parseFloat(daoData.initialFunding) > 0
                    ? `${daoData.initialFunding} ${daoData.treasuryType === 'cusd' ? 'cUSD' : daoData.treasuryType === 'dual' ? 'CELO' : 'USD'}`
                    : 'None'}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">MEMBER DEPOSITS</Label>
                <p className="font-medium">{daoData.depositRequired ? 'Required' : 'Optional'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Governance Section - only for non-shortTerm DAOs */}
        {daoData.daoType !== 'shortTerm' && daoData.daoType !== 'free' && ( // Exclude 'free' and 'shortTerm'
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Governance
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep(4)}>
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">MODEL</Label>
                  <p className="font-medium">
                    {governanceModels.find(g => g.value === daoData.governanceModel)?.label}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">QUORUM</Label>
                  <p className="font-medium">{daoData.quorum}%</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">VOTING PERIOD</Label>
                  <p className="font-medium">{daoData.votingPeriod}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Members ({daoData.members.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(6)}>
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

      <div className="bg-gradient-to-r from-teal-50 to-orange-50 dark:from-teal-950/30 dark:to-orange-950/30 p-6 rounded-lg border border-teal-200 dark:border-teal-800">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ready to Launch!</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Your DAO will be deployed to the blockchain. This action cannot be undone.
        </p>
        <Button
          onClick={deployDAO}
          disabled={isDeploying}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white py-3"
          size="lg"
        >
          {isDeploying ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Deploying DAO...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4 mr-2" />
              Deploy DAO
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
      case 3: return renderElderSelection();
      case 4: return renderGovernance();
      case 5: return renderTreasury();
      case 6: return renderMembers();
      case 7: return renderPreview();
      case 8: return renderSuccess();
      default: return renderDaoTypeSelection();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {currentStep < 6 && (
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
            {renderStepContent()}
          </CardContent>
        </Card>

        {currentStep < 8 && (
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            {currentStep < 7 ? (
              <Button
                onClick={nextStep}
                disabled={
                  (currentStep === 1 && !daoData.daoType) ||
                  (currentStep === 2 && !daoData.name.trim()) ||
                  (currentStep === 3 && selectedElders.length < (daoData.daoType === 'shortTerm' || daoData.daoType === 'free' ? 1 : 2)) || // Adjusted validation based on minElders
                  (currentStep === 4 && daoData.daoType !== 'shortTerm' && daoData.daoType !== 'free' && daoData.quorum < MINIMUM_QUORUM) || // Governance validation for relevant types
                  (currentStep === 5 && !daoData.treasuryType) ||
                  (currentStep === 6 && daoData.members.length < 2)
                }
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        )}

        <div className="text-center mt-12 text-sm text-gray-500 dark:text-gray-400">
          <p>Powered by Celo • Secured by blockchain • Built for communities</p>
        </div>
      </div>
    </div>
  );
};

export default CreateDAOFlow;