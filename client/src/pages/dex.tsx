/**
 * DEX Management Page
 * Advanced Swap and Cross-Chain Bridge functionality
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdvancedSwap from '@/components/dex/AdvancedSwap';
import AdvancedBridge from '@/components/dex/AdvancedBridge';

export default function DEXPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('swap');

  // Handle URL query parameter for tab selection
  useEffect(() => {
    if (router.query.tab) {
      setActiveTab(router.query.tab as string);
    }
  }, [router.query.tab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.push(`/dex?tab=${tab}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💱</span>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              DEX Tools
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Advanced token swaps and cross-chain bridging with optimal routing
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="swap">💱 Advanced Swap</TabsTrigger>
            <TabsTrigger value="bridge">🌉 Cross-Chain Bridge</TabsTrigger>
          </TabsList>

          {/* Advanced Swap Tab */}
          <TabsContent value="swap" className="space-y-4">
            <AdvancedSwap />
          </TabsContent>

          {/* Advanced Bridge Tab */}
          <TabsContent value="bridge" className="space-y-4">
            <AdvancedBridge />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
