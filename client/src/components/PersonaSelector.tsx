/**
 * PersonaSelector Component
 *
 * Allows users to select their persona (Okedi, Yuki, Amara) at signup
 * Appears as a simple 3-choice interface with persona details
 */

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  focusAreas: string[];
}

interface PersonaSelectorProps {
  onPersonaSelected?: (persona: string) => void;
  onSuccess?: () => void;
  isSignupFlow?: boolean;
}

export default function PersonaSelector({
  onPersonaSelected,
  onSuccess,
  isSignupFlow = false
}: PersonaSelectorProps) {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectPersonaMutation = useMutation({
    mutationFn: async (persona: string) => {
      const response = await fetch('/api/personas/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to select persona');
      }

      return response.json();
    },
    onSuccess: (data) => {
      onPersonaSelected?.(data.persona);
      onSuccess?.();
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Failed to select persona');
    }
  });

  const personas: Persona[] = [
    {
      id: 'okedi',
      name: 'Okedi',
      role: 'Community Manager',
      description: 'Build governance, lead DAOs, create proposals and coordinate communities',
      icon: '🎤',
      color: '#8B5CF6',
      focusAreas: ['dao.create', 'proposal.create', 'governance.vote', 'dao.join']
    },
    {
      id: 'yuki',
      name: 'Yuki',
      role: 'Developer',
      description: 'Trade, optimize yield, execute smart contracts and analyze protocols',
      icon: '🛠️',
      color: '#06B6D4',
      focusAreas: ['trading.dex', 'vault.yield', 'ai.assistant', 'investment.pools']
    },
    {
      id: 'amara',
      name: 'Amara',
      role: 'Investor',
      description: 'Grow wealth, explore yield opportunities and maximize returns',
      icon: '💰',
      color: '#EC4899',
      focusAreas: ['vault.yield', 'investment.pools', 'governance.vote', 'ai.assistant']
    }
  ];

  const handleSelect = (persona: string) => {
    setSelectedPersona(persona);
    setError(null);
  };

  const handleConfirm = () => {
    if (!selectedPersona) {
      setError('Please select a persona');
      return;
    }
    selectPersonaMutation.mutate(selectedPersona);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold mb-3">What's Your Role?</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Choose your persona to get personalized guidance and feature recommendations
        </p>
      </div>

      {/* Morio Introduction */}
      {isSignupFlow && (
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="text-4xl">🤖</div>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-300">
                  Meet Morio, your AI Guide
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                  Once you pick your role, Morio will help explain features, unlock paths, and celebrate your progress. You're never stuck! 🚀
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 flex gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Persona Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className="cursor-pointer transform transition-all duration-200"
            onClick={() => handleSelect(persona.id)}
          >
            <Card
              className={`h-full transition-all duration-200 ${
                selectedPersona === persona.id
                  ? `border-2 ring-2 ring-offset-2 ${
                      persona.color === '#8B5CF6'
                        ? 'border-purple-500 ring-purple-500'
                        : persona.color === '#06B6D4'
                        ? 'border-cyan-500 ring-cyan-500'
                        : 'border-pink-500 ring-pink-500'
                    }`
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-3">
                  <div className="text-5xl">{persona.icon}</div>
                  {selectedPersona === persona.id && (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  )}
                </div>
                <CardTitle className="text-xl">{persona.name}</CardTitle>
                <CardDescription className="font-semibold text-gray-600 dark:text-gray-400">
                  {persona.role}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {persona.description}
                </p>

                {/* Focus Areas */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Your Features:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {persona.focusAreas.map((area) => (
                      <Badge
                        key={area}
                        variant="secondary"
                        className="text-xs"
                      >
                        {formatFeatureName(area)}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Selection State */}
                <div className="pt-2">
                  {selectedPersona === persona.id ? (
                    <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                      ✓ Selected
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Click to select</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Confirmation Button */}
      <div className="flex justify-center gap-3">
        {isSignupFlow && selectedPersona && (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center w-full">
            Morio will use your persona to personalize feature guides and unlock recommendations
          </p>
        )}
      </div>

      <div className="flex justify-center gap-3 mt-4">
        <Button
          onClick={handleConfirm}
          disabled={!selectedPersona || selectPersonaMutation.isPending}
          size="lg"
          className="px-8"
        >
          {selectPersonaMutation.isPending ? (
            <>
              <span className="inline-block animate-spin mr-2">⏳</span>
              Setting up...
            </>
          ) : (
            `Continue as ${selectedPersona ? personas.find(p => p.id === selectedPersona)?.name : 'Unknown'}`
          )}
        </Button>
      </div>

      {/* Information Footer */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center text-sm text-gray-600 dark:text-gray-400">
        <p>
          <strong>💡 Tip:</strong> You can change your persona anytime in Settings. This just helps Morio give you better guidance!
        </p>
      </div>
    </div>
  );
}

/**
 * Format feature name for display
 */
function formatFeatureName(featureKey: string): string {
  const names: Record<string, string> = {
    'trading.dex': 'Trading',
    'vault.yield': 'Vault Yield',
    'proposal.create': 'Proposals',
    'governance.vote': 'Voting',
    'investment.pools': 'Investment',
    'ai.assistant': 'Morio AI',
    'dao.create': 'Create DAO',
    'dao.join': 'Join DAO'
  };

  return names[featureKey] || featureKey;
}
