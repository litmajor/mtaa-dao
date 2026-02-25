import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
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
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (personaLoading || loading) {
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
                {currentPersona === "yuki" && "🛠️ Trader Dashboard"}
                {currentPersona === "amara" && "💰 Investor Dashboard"}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {currentPersona === "okedi" && "Govern DAOs and lead communities"}
                {currentPersona === "yuki" && "Trade, yield farm, and execute smart contracts"}
                {currentPersona === "amara" && "Build wealth through passive income"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
