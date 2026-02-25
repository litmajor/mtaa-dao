/**
 * MorioHeaderButton Component
 *
 * Quick access button to open Morio chat from any header
 * Shows context-aware help based on current page
 */

import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from './ui/button';

interface MorioHeaderButtonProps {
  context?: 'account' | 'finance' | 'daos' | 'dashboard' | 'settings';
}

export default function MorioHeaderButton({ context = 'dashboard' }: MorioHeaderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getContextMessage = (ctx: string): string => {
    const messages: Record<string, string> = {
      account: "Questions about your profile, security, or preferences? I'm here to help! 🔐",
      finance: "Need help with vault yields, trading, or investment pools? Ask me anything! 💰",
      daos: "Want to learn about proposals, voting, or creating a DAO? I can guide you! 🎯",
      dashboard: "Welcome! Ask me about any feature or how to get the most out of MTAA! 🚀",
      settings: "Looking for help with your account settings? I've got you covered! ⚙️"
    };

    return messages[ctx] || messages.dashboard;
  };

  return (
    <>
      {/* Header Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
        title="Ask Morio for help"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="hidden sm:inline">Ask Morio</span>
      </Button>

      {/* Quick Help Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🤖</div>
                <div>
                  <h3 className="font-semibold">Morio</h3>
                  <p className="text-xs text-gray-500">Your AI Guide</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Context Message */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  {getContextMessage(context)}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Quick Questions:
                </p>
                <div className="space-y-2">
                  {context === 'account' && (
                    <>
                      <button
                        onClick={() => {
                          // Would trigger Morio chat with context
                          window.location.href = '/morio-hub?q=How do I enable 2FA?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • How do I enable 2FA?
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = '/morio-hub?q=How do I change my password?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • How do I change my password?
                      </button>
                    </>
                  )}

                  {context === 'finance' && (
                    <>
                      <button
                        onClick={() => {
                          window.location.href = '/morio-hub?q=How do I start yield farming?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • How do I start yield farming?
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = '/morio-hub?q=What is the best investment for me?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • What is the best investment for me?
                      </button>
                    </>
                  )}

                  {context === 'daos' && (
                    <>
                      <button
                        onClick={() => {
                          window.location.href = '/morio-hub?q=How do I create a proposal?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • How do I create a proposal?
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = '/morio-hub?q=How do I vote on a proposal?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • How do I vote on a proposal?
                      </button>
                    </>
                  )}

                  {context === 'dashboard' && (
                    <>
                      <button
                        onClick={() => {
                          window.location.href = '/morio-hub?q=What features are locked for me?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • What features are locked for me?
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = '/morio-hub?q=What should I do next?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • What should I do next?
                      </button>
                    </>
                  )}

                  {context === 'settings' && (
                    <>
                      <button
                        onClick={() => {
                          window.location.href = '/morio-hub?q=What is my persona?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • What is my persona?
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = '/morio-hub?q=How do I change my persona?';
                        }}
                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                      >
                        • How do I change my persona?
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Open Chat Button */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = '/morio-hub';
                }}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm transition-colors"
              >
                Open Full Chat →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
