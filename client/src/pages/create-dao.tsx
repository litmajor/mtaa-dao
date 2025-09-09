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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  ExternalLink
} from 'lucide-react';

const CreateDAOFlow = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const { address: walletAddress, connect, isConnected } = useWallet();
  const [daoData, setDaoData] = useState<DaoData>({
    // Step 1 - Basic Info
    name: '',
    description: '',
    logo: '🏛️',
    category: '',
    // Step 2 - Governance
    governanceModel: '1-person-1-vote',
    quorum: 50,
    votingPeriod: '7d',
    founderWallet: '',
    // Step 3 - Treasury
    treasuryType: 'cusd',
    initialFunding: '',
    depositRequired: false,
    // Step 4 - Members
    members: [],
    inviteMessage: ''
  });

  // Sync wallet address to founderWallet and initial member
  useEffect(() => {
    if (walletAddress) {
      setDaoData(prev => ({
        ...prev,
        founderWallet: walletAddress,
        members: prev.members.length === 0
          ? [{ address: walletAddress, role: 'governor', name: 'You (Founder)' }]
          : prev.members.map((m, i) =>
              i === 0
                ? { ...(m as Member), address: walletAddress }
                : m as Member
            )
      }));
    }
  }, [walletAddress]);

  const [newMember, setNewMember] = useState({ address: '', role: 'Member', name: '' });

  const steps = [
    { id: 1, title: 'Basic Info', icon: Settings },
    { id: 2, title: 'Governance', icon: Shield },
    { id: 3, title: 'Treasury', icon: Wallet },
    { id: 4, title: 'Members', icon: Users },
    { id: 5, title: 'Preview', icon: Eye },
    { id: 6, title: 'Success', icon: CheckCircle }
  ];

  const logoOptions = ['🏛️', '🌍', '🤝', '💎', '🚀', '⚡', '🌱', '🔥'];
  const categories = [
    { value: 'savings', label: 'Savings Group' },
    { value: 'investment', label: 'Investment Club' },
    { value: 'social', label: 'Social Impact' },
    { value: 'governance', label: 'Governance' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'fundraiser', label: 'Fundraiser' },
    { value: 'other', label: 'Other' },
    { value: 'custom', label: 'Custom' }
  ];

  const governanceModels = [
    { value: '1-person-1-vote', label: '1 Person = 1 Vote', desc: 'Democratic voting where each member has equal say' },
    { value: 'weighted-stake', label: 'Weighted by Stake', desc: 'Voting power based on treasury contribution' },
    { value: 'delegated', label: 'Delegated Voting', desc: 'Members can delegate their votes to others' }
  ];

  const treasuryTypes = [
    { value: 'cusd', label: 'cUSD Vault', desc: 'Simple stable treasury in Celo Dollars' },
    { value: 'dual', label: 'CELO + cUSD Dual', desc: 'Mixed treasury with growth potential' },
    { value: 'custom', label: 'Custom Stablecoin', desc: 'USDT, DAI or other tokens (coming soon)' }
  ];

  // Map roles to what is actually in the codebase
  const roleTypes = ['member', 'moderator', 'treasurer', 'governor'];

  interface Member {
    address: string;
    role: string;
    name: string;
    id?: number;
  }

  interface DaoData {
    name: string;
    description: string;
    logo: string;
    category: string;
    governanceModel: string;
    quorum: number;
    votingPeriod: string;
    founderWallet: string;
    treasuryType: string;
    initialFunding: string;
    depositRequired: boolean;
    members: Member[];
    inviteMessage: string;
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
        members: [...prev.members, { ...newMember, id: Date.now() }]
      }));
      setNewMember({ address: '', role: 'Member', name: '' });
    }
  };

  const removeMember = (index: number) => {
    setDaoData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index)
    }));
  };

  // Real DAO deployment logic
  const deployDAO = async () => {
    setIsDeploying(true);
    try {
      if (!walletAddress) {
        await connect();
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
      // Handle error (show toast, etc.)
    }
    setIsDeploying(false);
  };

  const nextStep = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Step 1 - Basic Info
  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Let's create your DAO</h2>
        <p className="text-gray-600">Start with the basics - what's your community about?</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="dao-name" className="text-sm font-medium">DAO Name *</Label>
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
          <div className="flex gap-2 mt-2">
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
            <Button variant="outline" size="sm" className="w-12 h-12">
              <Upload className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">Category</Label>
          <Select value={daoData.category} onValueChange={(value) => updateDaoData('category', value)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="What type of DAO is this?" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  // Step 2 - Governance
  const renderGovernance = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Governance Setup</h2>
        <p className="text-gray-600">How will your DAO make decisions?</p>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-sm font-medium mb-3 block">Governance Model</Label>
          <RadioGroup
            value={daoData.governanceModel}
            onValueChange={(value) => updateDaoData('governanceModel', value)}
            className="space-y-3"
          >
            {governanceModels.map(model => (
              <div key={model.value} className="flex items-start space-x-3">
                <RadioGroupItem value={model.value} id={model.value} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={model.value} className="font-medium cursor-pointer">
                    {model.label}
                  </Label>
                  <p className="text-sm text-gray-500 mt-1">{model.desc}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <Label className="text-sm font-medium">Quorum Threshold: {daoData.quorum}%</Label>
          <p className="text-xs text-gray-500 mb-2">Minimum participation needed for votes to pass</p>
          <Slider
            value={[daoData.quorum]}
            onValueChange={([value]) => updateDaoData('quorum', value)}
            min={10}
            max={100}
            step={5}
            className="mt-2"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Voting Period</Label>
          <Select value={daoData.votingPeriod} onValueChange={(value) => updateDaoData('votingPeriod', value)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 hours</SelectItem>
              <SelectItem value="3d">3 days</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">Founder Wallet</Label>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="font-mono text-sm">
              {daoData.founderWallet}
            </Badge>
            <Badge variant="outline" className="text-green-600 border-green-200">Connected</Badge>
          </div>
        </div>
      </div>
    </div>
  );

  // Step 3 - Treasury
  const renderTreasury = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Treasury Setup</h2>
        <p className="text-gray-600">Configure your DAO's financial foundation</p>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-sm font-medium mb-3 block">Treasury Type</Label>
          <div className="space-y-3">
            {treasuryTypes.map(treasury => (
              <Card
                key={treasury.value}
                className={`cursor-pointer transition-all ${
                  daoData.treasuryType === treasury.value 
                    ? 'border-teal-500 bg-teal-50' 
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
                      <p className="text-sm text-gray-500">{treasury.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="initial-funding" className="text-sm font-medium">Initial Funding (Optional)</Label>
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

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Require Member Deposits</Label>
            <p className="text-xs text-gray-500">Members must deposit to join</p>
          </div>
          <Switch
            checked={daoData.depositRequired}
            onCheckedChange={(checked) => updateDaoData('depositRequired', checked)}
          />
        </div>
      </div>
    </div>
  );

  // Step 4 - Members
  const renderMembers = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Members</h2>
        <p className="text-gray-600">Invite your community to join the DAO</p>
      </div>

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
              <Label className="text-sm">Wallet / Phone / Email</Label>
              <Input
                placeholder="0x... or +254... or email"
                value={newMember.address}
                onChange={(e) => setNewMember(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm">Role</Label>
              <Select value={newMember.role} onValueChange={(value) => setNewMember(prev => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleTypes.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={addMember} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Member
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
                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium">{member.name || 'Anonymous'}</p>
                      <p className="text-sm text-gray-500 font-mono">{member.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === 'Governor' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                    {index > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMember(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
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

      <div>
        <Label htmlFor="invite-message" className="text-sm font-medium">Invitation Message (Optional)</Label>
        <Textarea
          id="invite-message"
          placeholder="Hey! You're invited to join our DAO..."
          value={daoData.inviteMessage}
          onChange={(e) => updateDaoData('inviteMessage', e.target.value)}
          className="mt-1"
        />
      </div>
    </div>
  );

  // Step 5 - Preview
  const renderPreview = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your DAO</h2>
        <p className="text-gray-600">Everything looks good? Time to deploy!</p>
      </div>

      <div className="grid gap-6">
        {/* Basic Info */}
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
                <Badge variant="outline">{categories.find(c => c.value === daoData.category)?.label || 'No category'}</Badge>
              </div>
            </div>
            <p className="text-gray-600">{daoData.description || 'No description provided'}</p>
          </CardContent>
        </Card>

        {/* Governance */}
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
                <Label className="text-xs text-gray-500">MODEL</Label>
                <p className="font-medium">
                  {governanceModels.find(g => g.value === daoData.governanceModel)?.label}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">QUORUM</Label>
                <p className="font-medium">{daoData.quorum}%</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">VOTING PERIOD</Label>
                <p className="font-medium">{daoData.votingPeriod}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Treasury */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Treasury
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(3)}>
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {treasuryTypes.find(t => t.value === daoData.treasuryType)?.label}
                </p>
                <p className="text-sm text-gray-500">
                  Initial: {daoData.initialFunding || '0'} {daoData.treasuryType === 'cusd' ? 'cUSD' : 'CELO'}
                </p>
              </div>
              {daoData.depositRequired && (
                <Badge variant="secondary">Deposits Required</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Members */}
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
                  <span className="font-mono">{member.address}</span>
                  <Badge variant={member.role === 'Governor' ? 'default' : 'secondary'} className="text-xs">
                    {member.role}
                  </Badge>
                </div>
              ))}
              {daoData.members.length > 3 && (
                <p className="text-sm text-gray-500">+ {daoData.members.length - 3} more members</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-gradient-to-r from-teal-50 to-orange-50 p-6 rounded-lg border border-teal-200">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="w-6 h-6 text-teal-600" />
          <h3 className="text-lg font-semibold text-gray-900">Ready to Launch!</h3>
        </div>
        <p className="text-gray-600 mb-4">
          Your DAO will be deployed to the Celo blockchain. This action cannot be undone.
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
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">🎉 DAO Created Successfully!</h2>
          <p className="text-xl text-gray-600">Welcome to the future of community governance</p>
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
            <Label className="text-xs text-gray-500">DAO ADDRESS</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                0x8f2e...A4D9
              </code>
              <Button size="sm" variant="ghost">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div>
            <Label className="text-xs text-gray-500">INVITE LINK</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                https://mtaa.dao/invite/8f2e...A4D9
              </code>
              <Button size="sm" variant="ghost">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button className="bg-primary-600 hover:bg-primary-700 text-white" onClick={() => window.location.href = '/dashboard'}>
          <Settings className="w-4 h-4 mr-2" />
          Go to Dashboard
        </Button>
        <Button variant="outline" onClick={() => window.location.href = `/dao/${daoData.deployedAddress}/invite`}>
          <Users className="w-4 h-4 mr-2" />
          Invite Members
        </Button>
        <Button variant="outline" onClick={() => window.location.href = `/dao/${daoData.deployedAddress}/fund`}>
          <Wallet className="w-4 h-4 mr-2" />
          Fund Treasury
        </Button>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <h3 className="font-medium text-primary-900 mb-2">Next Steps:</h3>
        <ul className="text-sm text-primary-700 space-y-1">
          <li>• Share the invite link with your community</li>
          <li>• Fund your treasury to begin operations</li>
          <li>• Create your first proposal to get started</li>
        </ul>
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
  <div className="min-h-screen bg-primary-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Steps */}
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
                          ? 'border-teal-500 bg-teal-100 text-teal-600'
                          : 'border-gray-300 bg-white text-gray-400'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="ml-2 hidden sm:block">
                      <p className={`text-sm font-medium whitespace-nowrap ${
                        isActive || isCompleted ? 'text-teal-600' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </p>
                    </div>
                    {index < steps.length - 2 && (
                      <div className={`w-12 sm:w-20 h-1 mx-4 transition-all ${
                        currentStep > step.id ? 'bg-teal-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content */}
        <Card className="mb-8">
          <CardContent className="p-8">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
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
                  (currentStep === 3 && !daoData.treasuryType)
                }
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <div /> // Empty div for spacing in preview step
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>Powered by Celo • Secured by blockchain • Built for communities</p>
        </div>
      </div>
    </div>
  );
};

export default CreateDAOFlow;