
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  Shield, 
  Users, 
  Lock, 
  TrendingUp, 
  Globe,
  ArrowRight 
} from 'lucide-react';

interface VaultType {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  features: string[];
  status: 'active' | 'planned' | 'beta';
  path: string;
  color: string;
}

const vaultTypes: VaultType[] = [
  {
    id: 'personal',
    name: 'Personal Wallet',
    description: 'Your individual CELO/cUSD wallet for daily transactions',
    icon: Wallet,
    features: ['Send/Receive', 'Balance Tracking', 'Transaction History'],
    status: 'active',
    path: '/wallet',
    color: 'blue'
  },
  {
    id: 'maono',
    name: 'MaonoVault',
    description: 'Professional managed DeFi vault with yield strategies',
    icon: TrendingUp,
    features: ['ERC4626 Shares', 'Yield Strategies', 'Professional Management', 'Risk Assessment'],
    status: 'active',
    path: '/vault',
    color: 'purple'
  },
  {
    id: 'community',
    name: 'Community Vaults',
    description: 'DAO treasury management with governance voting',
    icon: Users,
    features: ['Governance Voting', 'Proposal System', 'Multi-sig Security', 'Transparent Treasury'],
    status: 'active',
    path: '/dao/treasury',
    color: 'green'
  },
  {
    id: 'locked',
    name: 'Locked Savings',
    description: 'Time-locked personal savings with goals',
    icon: Lock,
    features: ['Savings Goals', 'Time Locks', 'Interest Earning', 'Goal Tracking'],
    status: 'beta',
    path: '/wallet#locked-savings',
    color: 'orange'
  },
  {
    id: 'factory',
    name: 'Vault Factory',
    description: 'Deploy and manage custom vault instances',
    icon: Shield,
    features: ['Custom Deployment', 'Multi-Asset Support', 'Factory Management'],
    status: 'active',
    path: '/vault/factory',
    color: 'indigo'
  },
  {
    id: 'crosschain',
    name: 'Cross-Chain Vaults',
    description: 'Multi-blockchain asset management (Coming Soon)',
    icon: Globe,
    features: ['Multi-Chain Support', 'Bridged Assets', 'Universal Access'],
    status: 'planned',
    path: '/maonovault-web3',
    color: 'cyan'
  }
];

interface VaultTypeSelectorProps {
  onSelect?: (vaultType: VaultType) => void;
  showPlanned?: boolean;
}

export function VaultTypeSelector({ onSelect, showPlanned = true }: VaultTypeSelectorProps) {
  const filteredVaults = showPlanned 
    ? vaultTypes 
    : vaultTypes.filter(v => v.status !== 'planned');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'beta': return 'bg-yellow-100 text-yellow-800';
      case 'planned': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCardColor = (color: string) => {
    switch (color) {
      case 'blue': return 'border-blue-200 hover:border-blue-300';
      case 'purple': return 'border-purple-200 hover:border-purple-300';
      case 'green': return 'border-green-200 hover:border-green-300';
      case 'orange': return 'border-orange-200 hover:border-orange-300';
      case 'indigo': return 'border-indigo-200 hover:border-indigo-300';
      case 'cyan': return 'border-cyan-200 hover:border-cyan-300';
      default: return 'border-gray-200 hover:border-gray-300';
    }
  };

  const getIconColor = (color: string) => {
    switch (color) {
      case 'blue': return 'text-blue-600';
      case 'purple': return 'text-purple-600';
      case 'green': return 'text-green-600';
      case 'orange': return 'text-orange-600';
      case 'indigo': return 'text-indigo-600';
      case 'cyan': return 'text-cyan-600';
      default: return 'text-gray-600';
    }
  };

  const handleCardClick = (vault: VaultType) => {
    if (vault.status === 'planned') return;
    
    if (onSelect) {
      onSelect(vault);
    } else {
      // Navigate to the vault path
      window.location.href = vault.path;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose Your Vault Type</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          MtaaDAO offers different vault types for various use cases. Select the one that best fits your needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVaults.map((vault) => {
          const Icon = vault.icon;
          return (
            <Card 
              key={vault.id}
              className={`p-6 cursor-pointer transition-all duration-200 ${getCardColor(vault.color)} ${
                vault.status === 'planned' 
                  ? 'opacity-60 cursor-not-allowed' 
                  : 'hover:shadow-lg hover:scale-105'
              }`}
              onClick={() => handleCardClick(vault)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg bg-gray-50`}>
                  <Icon className={`h-6 w-6 ${getIconColor(vault.color)}`} />
                </div>
                <Badge className={getStatusColor(vault.status)}>
                  {vault.status}
                </Badge>
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {vault.name}
              </h3>
              
              <p className="text-gray-600 mb-4 text-sm">
                {vault.description}
              </p>

              <div className="space-y-2 mb-4">
                {vault.features.map((feature, index) => (
                  <div key={index} className="flex items-center text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2" />
                    {feature}
                  </div>
                ))}
              </div>

              {vault.status !== 'planned' && (
                <Button 
                  className="w-full mt-4 group"
                  variant={vault.status === 'beta' ? 'outline' : 'default'}
                >
                  {vault.status === 'beta' ? 'Try Beta' : 'Open Vault'}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              )}

              {vault.status === 'planned' && (
                <div className="w-full mt-4 p-2 text-center text-sm text-gray-500 bg-gray-50 rounded">
                  Coming Soon
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Need Help Choosing?</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>Personal Wallet:</strong> For daily transactions and basic crypto management</p>
          <p><strong>MaonoVault:</strong> For earning yield on your crypto with professional management</p>
          <p><strong>Community Vaults:</strong> For participating in DAO governance and shared treasury</p>
        </div>
      </div>
    </div>
  );
}

export default VaultTypeSelector;
