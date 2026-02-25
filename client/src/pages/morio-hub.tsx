import React from 'react';
import { useAuth } from './hooks/useAuth';
import { useLocation } from 'wouter';
import { MorioChat } from '@/components/morio/MorioChat';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Gift, Users, Target } from 'lucide-react';

export default function MorioHub() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  if (!user?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Heart className="w-12 h-12 mx-auto mb-4 text-purple-600" />
          <p>Please log in to chat with Morio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-blue-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Morio AI Assistant
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your guide to MtaaDAO</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Back
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chat Area - Main */}
          <div className="lg:col-span-2">
            <Card className="border-purple-200/50 dark:border-purple-800/50 shadow-lg overflow-hidden">
              <div className="h-[600px]">
                <MorioChat userId={user.id.toString()} variant="full" />
              </div>
            </Card>
          </div>

          {/* Sidebar - Info & Quick Links */}
          <div className="space-y-6">
            {/* About Morio */}
            <Card className="p-4 border-purple-200/50 dark:border-purple-800/50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-purple-600" />
                About Morio
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Morio is your personal AI guide to navigating MtaaDAO. Ask questions, get started with onboarding, or explore features. Morio knows your DAO context and can help with everything from wallet setup to governance.
              </p>
            </Card>

            {/* Quick Actions */}
            <Card className="p-4 border-purple-200/50 dark:border-purple-800/50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4 text-orange-600" />
                Quick Topics
              </h3>
              <div className="space-y-2">
                <QuickTopic icon={Heart} label="Getting Started" />
                <QuickTopic icon={Gift} label="DAOs Explained" />
                <QuickTopic icon={Users} label="Community Features" />
                <QuickTopic icon={Target} label="Earning & Rewards" />
              </div>
            </Card>

            {/* Tips */}
            <Card className="p-4 border-blue-200/50 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/20">
              <h3 className="font-semibold text-sm mb-2">💡 Pro Tips</h3>
              <ul className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                <li>• Type naturally - Morio understands context</li>
                <li>• Use quick action buttons for suggestions</li>
                <li>• Ask about your specific DAO</li>
                <li>• Morio remembers your conversation</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickTopic({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left text-sm">
      <Icon className="w-4 h-4 flex-shrink-0 text-purple-600" />
      <span className="text-gray-700 dark:text-gray-300">{label}</span>
    </button>
  );
}
