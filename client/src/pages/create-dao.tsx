
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

  const steps = [
    { id: 1, title: 'Basic Info', icon: Settings },
    { id: 2, title: 'Governance', icon: Shield },
    { id: 3, title: 'Treasury', icon: Wallet },
    { id: 4, title: 'Members', icon: Users },
    { id: 5, title: 'Preview', icon: Eye },
    { id: 6, title: 'Success', icon: CheckCircle }
  ];

  const logoOptions = ['🏛️', '🌍', '🤝', '💎', '🚀', '⚡', '🌱', '🔥', '💰'];
  
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

      const response = await fetch('/api/dao-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...daoData, founderWallet: walletAddress, members: daoData.members })
      });
      
      const result = await response.json();
      if (response.ok && result.daoAddress) {
        setDaoData(prev => ({ ...prev, deployedAddress: result.daoAddress }));
        setCurrentStep(6);
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
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

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

  // Step 1 - Basic Info
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
              {categories.map(cat => (
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

  // Step 2 - Governance
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

  // Step 3 - Treasury
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
            {treasuryTypes.map(treasury => (
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

  // Step 4 - Members (with Peer Invite System)
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

  // Step 5 - Preview
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
                <Badge variant="outline">
                  {categories.find(c => c.value === daoData.category)?.label || 'No category'}
                </Badge>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">{daoData.description || 'No description provided'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Governance
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)}>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Members ({daoData.members.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(4)}>
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

  // Step 6 - Success
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
      case 1: return renderBasicInfo();
      case 2: return renderGovernance();
      case 3: return renderTreasury();
      case 4: return renderMembers();
      case 5: return renderPreview();
      case 6: return renderSuccess();
      default: return renderBasicInfo();
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

        {currentStep < 6 && (
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

            {currentStep < 5 ? (
              <Button
                onClick={nextStep}
                disabled={
                  (currentStep === 1 && !daoData.name.trim()) ||
                  (currentStep === 2 && daoData.quorum < MINIMUM_QUORUM) ||
                  (currentStep === 3 && !daoData.treasuryType)
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
