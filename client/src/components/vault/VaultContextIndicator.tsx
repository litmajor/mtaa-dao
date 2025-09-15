
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  Shield, 
  Users, 
  Lock, 
  TrendingUp, 
  ArrowLeft,
  Info 
} from 'lucide-react';

interface VaultContextIndicatorProps {
  currentVault: 'personal' | 'maono' | 'community' | 'locked' | 'factory';
  onNavigateBack?: () => void;
  showSwitcher?: boolean;
}

const vaultConfigs = {
  personal: {
    name: 'Personal Wallet',
    icon: Wallet,
    color: 'bg-blue-100 text-blue-800',
    description: 'Managing your individual CELO/cUSD wallet'
  },
  maono: {
    name: 'MaonoVault',
    icon: TrendingUp,
    color: 'bg-purple-100 text-purple-800',
    description: 'Professional DeFi vault with yield strategies'
  },
  community: {
    name: 'Community Vault',
    icon: Users,
    color: 'bg-green-100 text-green-800',
    description: 'DAO treasury with governance voting'
  },
  locked: {
    name: 'Locked Savings',
    icon: Lock,
    color: 'bg-orange-100 text-orange-800',
    description: 'Time-locked savings with goals'
  },
  factory: {
    name: 'Vault Factory',
    icon: Shield,
    color: 'bg-indigo-100 text-indigo-800',
    description: 'Deploy and manage vault instances'
  }
};

export function VaultContextIndicator({ 
  currentVault, 
  onNavigateBack, 
  showSwitcher = true 
}: VaultContextIndicatorProps) {
  const config = vaultConfigs[currentVault];
  const Icon = config.icon;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-4">
          {onNavigateBack && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onNavigateBack}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-gray-50">
              <Icon className="h-5 w-5 text-gray-600" />
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-semibold text-gray-900">
                  {config.name}
                </h1>
                <Badge className={config.color}>
                  Active
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                {config.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
            <Info className="h-4 w-4" />
            <span>Vault Type: {config.name}</span>
          </div>

          {showSwitcher && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/vault/selector'}
            >
              Switch Vault
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VaultContextIndicator;
