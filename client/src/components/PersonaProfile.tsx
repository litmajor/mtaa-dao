/**
 * PersonaProfile Component
 *
 * Shows user's persona and feature unlock progress in Settings
 * Part of Settings → Persona & Progress tab
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from './ui/dialog';
import { 
  CheckCircle, 
  Lock, 
  Clock, 
  TrendingUp, 
  Zap,
  AlertCircle 
} from 'lucide-react';

interface PersonaProgressItem {
  feature: string;
  name: string;
  isAvailable: boolean;
  reason?: string;
  daysUntilAvailable?: number;
  amountNeeded?: number;
  currency?: string;
  priority: number;
}

interface PersonaProgressResponse {
  persona: string;
  personaName: string;
  totalFeatures: number;
  unlockedFeatures: number;
  progressPercentage: number;
  nextMilestone?: PersonaProgressItem;
  progress: PersonaProgressItem[];
}

interface PersonaDetailsResponse {
  persona: string;
  details: {
    id: string;
    name: string;
    role: string;
    description: string;
    icon: string;
    color: string;
    focusAreas: string[];
  };
}

const PERSONA_INFO: Record<string, { name: string; role: string; icon: string; color: string }> = {
  okedi: {
    name: 'Okedi',
    role: 'Community Manager',
    icon: '🎤',
    color: '#8B5CF6'
  },
  yuki: {
    name: 'Yuki',
    role: 'DeFi Trading',
    icon: '📈',
    color: '#06B6D4'
  },
  amara: {
    name: 'Amara',
    role: 'Long-term / Investing',
    icon: '💰',
    color: '#EC4899'
  }
};

export default function PersonaProfile() {
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current persona
  const { data: currentPersona, isLoading: isLoadingCurrent } = useQuery<PersonaDetailsResponse>({
    queryKey: ['personas', 'current'],
    queryFn: async () => {
      const response = await fetch('/api/personas/current');
      if (!response.ok) throw new Error('Failed to fetch persona');
      return response.json();
    }
  });

  // Fetch progress
  const { data: progress, isLoading: isLoadingProgress } = useQuery<PersonaProgressResponse>({
    queryKey: ['personas', 'progress'],
    queryFn: async () => {
      const response = await fetch('/api/personas/progress');
      if (!response.ok) throw new Error('Failed to fetch progress');
      return response.json();
    }
  });

  const changePersonaMutation = useMutation({
    mutationFn: async (newPersona: string) => {
      const response = await fetch('/api/personas/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: newPersona })
      });

      if (!response.ok) throw new Error('Failed to change persona');
      return response.json();
    },
    onSuccess: () => {
      setShowChangeDialog(false);
      queryClient.invalidateQueries({ queryKey: ['personas'] });
    }
  });

  if (isLoadingCurrent || isLoadingProgress) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500 dark:text-gray-400">Loading your persona...</div>
      </div>
    );
  }

  if (!currentPersona?.persona) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
        <CardHeader>
          <CardTitle className="text-yellow-900 dark:text-yellow-200">No Persona Selected</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-yellow-800 dark:text-yellow-300 mb-4">
            You haven't selected a persona yet. Choose one to get personalized feature guidance from Morio!
          </p>
          <Button onClick={() => window.location.href = '/settings?tab=persona'}>
            Select Persona
          </Button>
        </CardContent>
      </Card>
    );
  }

  const persona = PERSONA_INFO[currentPersona.persona] || { name: currentPersona.persona };

  return (
    <div className="space-y-6">
      {/* Current Persona Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl">{persona.icon}</div>
              <div>
                <CardTitle className="text-2xl">{persona.name}</CardTitle>
                <CardDescription className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                  {persona.role}
                </CardDescription>
              </div>
            </div>

            {/* Change Persona Button */}
            <AlertDialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Change Persona</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Change Your Persona?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Changing your persona will update your feature recommendations and unlock paths. You can change it anytime.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Persona Options */}
                <div className="grid grid-cols-3 gap-3 my-4">
                  {Object.entries(PERSONA_INFO).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => changePersonaMutation.mutate(key)}
                      disabled={key === currentPersona.persona || changePersonaMutation.isPending}
                      className={`p-3 rounded-lg text-center transition-all ${
                        key === currentPersona.persona
                          ? 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="text-3xl mb-1">{info.icon}</div>
                      <div className="text-xs font-semibold">{info.name}</div>
                    </button>
                  ))}
                </div>

                <AlertDialogCancel>Cancel</AlertDialogCancel>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Overview */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Your Progress
            </CardTitle>
            <CardDescription>
              {progress.unlockedFeatures} of {progress.totalFeatures} features unlocked
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold">{progress.progressPercentage}%</span>
              </div>
              <Progress value={progress.progressPercentage} className="h-3" />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {progress.unlockedFeatures}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  Unlocked Features
                </div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {progress.totalFeatures - progress.unlockedFeatures}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Coming Soon
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Milestone */}
      {progress?.nextMilestone && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              Next Milestone
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold text-lg">{progress.nextMilestone.name}</p>
            </div>

            {progress.nextMilestone.daysUntilAvailable ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-semibold">
                    {progress.nextMilestone.daysUntilAvailable} days remaining
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {progress.nextMilestone.reason}
                  </p>
                </div>
              </div>
            ) : null}

            {progress.nextMilestone.amountNeeded ? (
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">
                    Need {progress.nextMilestone.amountNeeded.toLocaleString()} {progress.nextMilestone.currency}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {progress.nextMilestone.reason}
                  </p>
                </div>
              </div>
            ) : null}

            <p className="text-sm text-gray-600 dark:text-gray-400 pt-2">
              Ask Morio how to reach this milestone! 💬
            </p>
          </CardContent>
        </Card>
      )}

      {/* Feature Timeline */}
      {progress?.progress && progress.progress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Feature Timeline</CardTitle>
            <CardDescription>
              Your personalized unlock path for {progress.personaName}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {progress.progress.map((item, index) => (
                <div key={item.feature} className="flex gap-4">
                  {/* Timeline Connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        item.isAvailable
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {item.isAvailable ? '✓' : item.priority}
                    </div>
                    {index < progress.progress.length - 1 && (
                      <div
                        className={`w-0.5 h-12 ${
                          item.isAvailable
                            ? 'bg-green-200 dark:bg-green-800'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{item.name}</p>
                      {item.isAvailable ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Unlocked
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Lock className="w-3 h-3 mr-1" />
                          Locked
                        </Badge>
                      )}
                    </div>

                    {!item.isAvailable && item.reason && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.reason}
                      </p>
                    )}

                    {item.daysUntilAvailable ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                        ⏰ {item.daysUntilAvailable} days
                      </p>
                    ) : null}

                    {item.amountNeeded ? (
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                        💰 {item.amountNeeded.toLocaleString()} {item.currency}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Morio Tip */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="text-3xl flex-shrink-0">🤖</div>
            <div>
              <p className="font-semibold text-purple-900 dark:text-purple-200 mb-2">
                Ask Morio about your progress!
              </p>
              <p className="text-sm text-purple-800 dark:text-purple-300">
                Want to know how to unlock your next feature? Ask Morio in the chat. They'll give you
                {progress?.personaName ? ` ${progress.personaName}-specific ` : ' '}
                advice on the fastest way to get there. 🚀
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
