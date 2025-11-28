
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  MessageSquare,
  Wallet,
  TrendingUp,
  BarChart3,
  Users,
  CheckSquare,
  Trophy,
  ChevronRight,
  X,
  DollarSign,
  Shield,
  FileText,
  Clock,
  Zap
} from 'lucide-react';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  route?: string;
  highlight?: string; // CSS selector to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  role: 'creator' | 'member' | 'both';
}

const TOUR_STEPS: TourStep[] = [
  // Creator Perspective
  {
    id: 'welcome-creator',
    title: '🎉 Welcome to Your DAO!',
    description: "You've created a DAO! Let's explore what you can do as a founder/admin.",
    icon: Users,
    position: 'center',
    role: 'creator'
  },
  {
    id: 'dao-settings',
    title: 'DAO Settings',
    description: 'Configure your DAO: name, governance rules, member roles, and treasury limits. This is your control center.',
    icon: Settings,
    route: '/dao/:id/settings',
    position: 'left',
    role: 'creator'
  },
  {
    id: 'billing-settings',
    title: 'Billing & Subscription',
    description: 'Manage your DAO subscription tier (Free, Collective, MetaDAO). Auto-deducted from treasury monthly.',
    icon: DollarSign,
    route: '/dao/:id/subscription',
    position: 'left',
    role: 'creator'
  },
  {
    id: 'dao-treasury',
    title: 'DAO Treasury',
    description: 'Your DAO\'s shared funds. All members contribute here. Multi-sig protected. Requires proposals for withdrawals.',
    icon: Wallet,
    route: '/dao/treasury',
    position: 'top',
    role: 'creator'
  },
  {
    id: 'vaults-vs-treasury',
    title: 'Vaults: Investment Pools',
    description: 'Vaults are SEPARATE from treasury. Think of them as investment accounts with yield strategies (8-15% APY). Treasury = operating funds, Vaults = growth investments.',
    icon: TrendingUp,
    route: '/vault',
    position: 'top',
    role: 'creator'
  },
  {
    id: 'members-management',
    title: 'Member Management',
    description: 'Invite members, assign roles (Admin, Elder, Proposer, Member), track contributions, and manage permissions.',
    icon: Users,
    route: '/dao/:id/members',
    position: 'right',
    role: 'creator'
  },
  {
    id: 'dao-chat',
    title: 'DAO Chat',
    description: 'Internal messaging for your DAO. Discuss proposals, coordinate tasks, and build community.',
    icon: MessageSquare,
    route: '/dao-chat',
    position: 'bottom',
    role: 'both'
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    description: 'Track treasury growth, member engagement, voting participation, and DAO health metrics powered by AI.',
    icon: BarChart3,
    route: '/analytics-dashboard',
    position: 'top',
    role: 'creator'
  },
  {
    id: 'task-management',
    title: 'Task Management',
    description: 'Create bounties, assign tasks, verify submissions, and reward contributors. Build your DAO economy.',
    icon: CheckSquare,
    route: '/tasks',
    position: 'right',
    role: 'creator'
  },
  {
    id: 'leaderboard',
    title: 'Leaderboard & Reputation',
    description: 'See top contributors, track reputation scores, and reward active members. Gamify participation!',
    icon: Trophy,
    route: '/reputation',
    position: 'bottom',
    role: 'both'
  },
  {
    id: 'proposals',
    title: 'Governance & Proposals',
    description: 'Create proposals for spending, policy changes, or member votes. Your DAO runs on-chain democracy.',
    icon: FileText,
    route: '/proposals',
    position: 'left',
    role: 'creator'
  },
  
  // Member Perspective
  {
    id: 'welcome-member',
    title: '👋 Welcome to the DAO!',
    description: "You've joined a DAO! Let's explore what you can do as a member.",
    icon: Users,
    position: 'center',
    role: 'member'
  },
  {
    id: 'member-dashboard',
    title: 'Your Dashboard',
    description: 'See your DAO membership, contributions, voting power, tasks, and rewards. Your personal hub.',
    icon: BarChart3,
    route: '/dashboard',
    position: 'center',
    role: 'member'
  },
  {
    id: 'member-treasury-view',
    title: 'View DAO Treasury',
    description: 'See how the DAO spends funds. You can contribute but withdrawals require proposals and votes.',
    icon: Wallet,
    route: '/dao/treasury',
    position: 'top',
    role: 'member'
  },
  {
    id: 'member-vaults',
    title: 'Join Investment Vaults',
    description: 'Vaults are optional investment pools. Deposit funds to earn yield (8-15% APY). Separate from treasury contributions.',
    icon: TrendingUp,
    route: '/vault',
    position: 'top',
    role: 'member'
  },
  {
    id: 'member-proposals',
    title: 'Vote on Proposals',
    description: 'Your voice matters! Vote on how the DAO spends funds, changes policies, or admits new members.',
    icon: FileText,
    route: '/proposals',
    position: 'left',
    role: 'member'
  },
  {
    id: 'member-tasks',
    title: 'Claim Tasks & Earn',
    description: 'Complete bounties, earn MTAA tokens, build reputation. Contribute skills to the DAO.',
    icon: CheckSquare,
    route: '/tasks',
    position: 'right',
    role: 'member'
  },
  {
    id: 'member-chat',
    title: 'Join the Conversation',
    description: 'Chat with other members, discuss ideas, coordinate activities. Build relationships.',
    icon: MessageSquare,
    route: '/dao-chat',
    position: 'bottom',
    role: 'member'
  }
];

interface DaoOnboardingTourProps {
  daoId: string;
  userRole: 'creator' | 'member';
  onComplete?: () => void;
}

export function DaoOnboardingTour({ daoId, userRole, onComplete }: DaoOnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const navigate = useNavigate();

  const relevantSteps = TOUR_STEPS.filter(
    step => step.role === userRole || step.role === 'both'
  );

  useEffect(() => {
    // Check if user has completed tour before
    const tourKey = `dao_tour_completed_${daoId}_${userRole}`;
    const completed = localStorage.getItem(tourKey);
    if (completed) {
      setHasCompletedTour(true);
      setIsVisible(false);
    }
  }, [daoId, userRole]);

  const currentStepData = relevantSteps[currentStep];

  if (!isVisible || hasCompletedTour) return null;

  const handleNext = () => {
    if (currentStep < relevantSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      
      // Navigate to route if specified
      const nextStep = relevantSteps[currentStep + 1];
      if (nextStep.route) {
        const route = nextStep.route.replace(':id', daoId);
        navigate(route);
      }
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      
      const prevStep = relevantSteps[currentStep - 1];
      if (prevStep.route) {
        const route = prevStep.route.replace(':id', daoId);
        navigate(route);
      }
    }
  };

  const handleSkip = () => {
    const tourKey = `dao_tour_completed_${daoId}_${userRole}`;
    localStorage.setItem(tourKey, 'true');
    setIsVisible(false);
    onComplete?.();
  };

  const handleComplete = () => {
    const tourKey = `dao_tour_completed_${daoId}_${userRole}`;
    localStorage.setItem(tourKey, 'true');
    setIsVisible(false);
    onComplete?.();
  };

  const getPositionClasses = () => {
    switch (currentStepData.position) {
      case 'center':
        return 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50';
      case 'top':
        return 'fixed top-20 left-1/2 transform -translate-x-1/2 z-50';
      case 'bottom':
        return 'fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50';
      case 'left':
        return 'fixed top-1/2 left-8 transform -translate-y-1/2 z-50';
      case 'right':
        return 'fixed top-1/2 right-8 transform -translate-y-1/2 z-50';
      default:
        return 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50';
    }
  };

  const Icon = currentStepData.icon;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />

      {/* Tour Card */}
      <Card className={`${getPositionClasses()} w-[90vw] max-w-md shadow-2xl border-2 border-teal-500 animate-in fade-in slide-in-from-bottom-5`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900 rounded-lg">
                <Icon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
                <Badge variant="outline" className="mt-1 text-xs">
                  Step {currentStep + 1} of {relevantSteps.length}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {currentStepData.description}
          </p>

          {/* Special vault explanation for members */}
          {currentStepData.id === 'member-vaults' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                💡 Why Vaults ≠ Treasury?
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 mt-2 space-y-1">
                <li><strong>Treasury:</strong> Operating funds for DAO expenses</li>
                <li><strong>Vaults:</strong> Investment pools to grow wealth</li>
                <li><strong>You choose:</strong> Contribute to treasury, invest in vaults, or both!</li>
              </ul>
            </div>
          )}

          {/* Special vault explanation for creators */}
          {currentStepData.id === 'vaults-vs-treasury' && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                🏦 Two Financial Systems:
              </p>
              <ul className="text-xs text-purple-600 dark:text-purple-400 mt-2 space-y-1">
                <li><strong>Treasury:</strong> DAO bank account (pay bills, salaries)</li>
                <li><strong>Vaults:</strong> Investment accounts (earn 8-15% APY)</li>
                <li>Members can use both independently!</li>
              </ul>
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{Math.round(((currentStep + 1) / relevantSteps.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-teal-600 transition-all duration-300"
                style={{ width: `${((currentStep + 1) / relevantSteps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkip}
              >
                Skip Tour
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {currentStep === relevantSteps.length - 1 ? (
                  <>
                    Finish
                    <CheckSquare className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Quick Reference Component (always accessible)
export function DaoQuickReference({ daoId, userRole }: { daoId: string; userRole: 'creator' | 'member' }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const features = userRole === 'creator' ? [
    { icon: Settings, label: 'Settings', route: `/dao/${daoId}/settings`, color: 'text-purple-600' },
    { icon: DollarSign, label: 'Billing', route: `/dao/${daoId}/subscription`, color: 'text-green-600' },
    { icon: Wallet, label: 'Treasury', route: '/dao/treasury', color: 'text-blue-600' },
    { icon: TrendingUp, label: 'Vaults', route: '/vault', color: 'text-teal-600' },
    { icon: Users, label: 'Members', route: `/dao/${daoId}/members`, color: 'text-orange-600' },
    { icon: MessageSquare, label: 'Chat', route: '/dao-chat', color: 'text-pink-600' },
    { icon: BarChart3, label: 'Analytics', route: '/analytics-dashboard', color: 'text-indigo-600' },
    { icon: CheckSquare, label: 'Tasks', route: '/tasks', color: 'text-yellow-600' },
    { icon: Trophy, label: 'Leaderboard', route: '/reputation', color: 'text-red-600' },
    { icon: FileText, label: 'Proposals', route: '/proposals', color: 'text-cyan-600' }
  ] : [
    { icon: BarChart3, label: 'Dashboard', route: '/dashboard', color: 'text-indigo-600' },
    { icon: Wallet, label: 'Treasury', route: '/dao/treasury', color: 'text-blue-600' },
    { icon: TrendingUp, label: 'Vaults', route: '/vault', color: 'text-teal-600' },
    { icon: FileText, label: 'Proposals', route: '/proposals', color: 'text-cyan-600' },
    { icon: CheckSquare, label: 'Tasks', route: '/tasks', color: 'text-yellow-600' },
    { icon: MessageSquare, label: 'Chat', route: '/dao-chat', color: 'text-pink-600' },
    { icon: Trophy, label: 'Leaderboard', route: '/reputation', color: 'text-red-600' }
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-30 bg-teal-600 hover:bg-teal-700"
        title="Quick Access Menu"
      >
        <Zap className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setIsOpen(false)} />
      <Card className="fixed bottom-24 right-6 w-72 shadow-2xl z-50 animate-in slide-in-from-bottom-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Quick Access</span>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-6 w-6 p-0">
              <X className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <button
                  key={feature.label}
                  onClick={() => {
                    navigate(feature.route);
                    setIsOpen(false);
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <Icon className={`w-5 h-5 ${feature.color}`} />
                  <span className="text-xs font-medium">{feature.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
