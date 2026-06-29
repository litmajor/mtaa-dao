import React, { useState, useEffect } from "react";
import { RefreshCw, ChevronDown, Wallet, Gamepad2, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { DashboardPersona, PersonaData, useDashboardPersona } from "@/hooks/useDashboardPersona";
import { usePersona, useActiveSubprofile } from "@/contexts/persona-context";
import OkediDashboard from "./OkediDashboard";
import YukiDashboard from "../trading/YukiDashboard";
import { AmaraDashboard } from "./AmaraDashboard";

/**
 * PersonalizedDashboard Router Component
 * 
 * Switches between persona-specific dashboards:
 * - OKEDI: Personal wallet + DAO governance (beginner)
 * - YUKI: Community builder + trading (intermediate)
 * - AMARA: Investor + advanced opportunities (advanced)
 */

export function PersonalizedDashboard() {
  const activeSubprofile = useActiveSubprofile(); // Get active subprofile from PersonaContext
  const { persona, personaData, loading: personaLoading } = useDashboardPersona();
  const { switchSubprofile } = usePersona();
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);

  // Use activeSubprofile from context if available, otherwise fall back to persona hook
  const currentPersona = activeSubprofile || persona;

  // Listen for subprofile changes
  useEffect(() => {
    const handleSubprofileChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ subprofile: string }>;
      // Trigger dashboard reload when subprofile changes
      loadDashboardData();
    };
    
    window.addEventListener('subprofile-changed', handleSubprofileChange);
    return () => window.removeEventListener('subprofile-changed', handleSubprofileChange);
  }, []);

  // Load dashboard data
  useEffect(() => {
    if (personaLoading || !currentPersona) return;
    loadDashboardData();
  }, [currentPersona, personaLoading]);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const response = await apiRequest("GET", `/api/dashboard/${currentPersona}`);
      setDashboardData(response);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }

  const handlePersonaSwitch = async (newPersona: 'okedi' | 'yuki' | 'amara') => {
    setShowPersonaDropdown(false);
    await switchSubprofile(newPersona);
  };

  if (personaLoading || loading) {
    // Show persona-specific skeletons if available
    if (currentPersona === 'amara') {
      const { AmaraDashboardSkeleton } = require('./AmaraDashboardSkeleton');
      return <AmaraDashboardSkeleton />;
    }

    if (currentPersona === 'yuki') {
      const { YukiDashboardSkeleton } = require('../trading/YukiDashboardSkeleton');
      return <YukiDashboardSkeleton />;
    }

    // Default fallback skeleton
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-slate-400">Loading your personalized dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-16 z-40 border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                {currentPersona === "okedi" && "🎤 Community Dashboard"}
                {currentPersona === "yuki" && "📈 Trading Dashboard"}
                {currentPersona === "amara" && "💰 Investing Dashboard"}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {currentPersona === "okedi" && "Govern DAOs and lead communities"}
                {currentPersona === "yuki" && "DeFi trading, liquidity, and analytics"}
                {currentPersona === "amara" && "Long-term investments and yield opportunities"}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Persona Switcher Dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
                  onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
                >
                  {currentPersona === 'okedi' && <>💳 Okedi (Foundation)</>}
                  {currentPersona === 'yuki' && <>📈 Yuki (Trading)</>}
                  {currentPersona === 'amara' && <>💰 Amara (Long-term / Investing)</>}
                  <ChevronDown className="h-4 w-4" />
                </Button>
                
                {showPersonaDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPersonaDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="p-2">
                        <p className="text-xs text-slate-400 font-semibold px-3 py-2 uppercase tracking-wider">Switch Persona</p>
                        <button
                          onClick={() => handlePersonaSwitch('okedi')}
                          className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded-md flex items-center gap-3 transition-colors ${
                            currentPersona === 'okedi' ? 'bg-slate-700/50 text-blue-400' : ''
                          }`}
                        >
                          <Wallet className="h-4 w-4 text-blue-400" />
                          <div>
                            <div className="font-medium">Okedi</div>
                            <div className="text-[10px] text-slate-400">Foundation & Governance</div>
                          </div>
                        </button>
                        <button
                          onClick={() => handlePersonaSwitch('yuki')}
                          className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded-md flex items-center gap-3 transition-colors ${
                            currentPersona === 'yuki' ? 'bg-slate-700/50 text-green-400' : ''
                          }`}
                        >
                          <TrendingUp className="h-4 w-4 text-green-400" />
                          <div>
                            <div className="font-medium">Yuki</div>
                            <div className="text-[10px] text-slate-400">DeFi Trading & Liquidity</div>
                          </div>
                        </button>
                        <button
                          onClick={() => handlePersonaSwitch('amara')}
                          className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded-md flex items-center gap-3 transition-colors ${
                            currentPersona === 'amara' ? 'bg-slate-700/50 text-pink-400' : ''
                          }`}
                        >
                          <Sparkles className="h-4 w-4 text-pink-400" />
                          <div>
                            <div className="font-medium">Amara</div>
                            <div className="text-[10px] text-slate-400">Long-term & Investing</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-2 border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div 
        key={currentPersona} 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out"
      >
        {currentPersona === "okedi" && (
          <OkediDashboard data={dashboardData} />
        )}
        {currentPersona === "yuki" && (
          <YukiDashboard data={dashboardData} />
        )}
        {currentPersona === "amara" && (
          <AmaraDashboard data={dashboardData} />
        )}
      </div>
    </div>
  );
}
