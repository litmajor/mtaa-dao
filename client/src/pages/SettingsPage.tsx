import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/pages/hooks/useAuth";
import { PageLoading } from "@/components/ui/page-loading";
import { useLocation } from "wouter";

// Tab Components
import { ProfileTab } from "@/components/settings/ProfileTab";
import { PersonaTab } from "@/components/settings/PersonaTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { PreferencesTab } from "@/components/settings/PreferencesTab";
import { ApiKeysTab } from "@/components/settings/ApiKeysTab";
import { AdminTab } from "@/components/settings/AdminTab";

import { User, Lock, Bell, Palette, Zap, KeyRound, ShieldAlert } from "lucide-react";

/**
 * Comprehensive Settings Page
 * Replaces the legacy SettingsPage with a wired, 7-tab configuration panel.
 */
export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");

  // Read hash from URL to jump to specific tab (e.g. /settings#security)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (['profile', 'persona', 'security', 'notifications', 'preferences', 'api-keys', 'admin'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.location.hash = value;
  };

  if (isLoading) {
    return <PageLoading message="Loading settings..." />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <p className="text-gray-400 mb-4">Please log in to view settings.</p>
        <button 
          onClick={() => setLocation("/login")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Go to Login
        </button>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <>
      <Helmet>
        <title>Account Settings | MtaaDAO</title>
        <meta name="description" content="Manage your account, security, and preferences" />
      </Helmet>

      <div className="min-h-screen bg-[#050505] text-white">
        {/* Header */}
        <div className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-gray-400 mt-2">Manage your account, personas, and global preferences.</p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col md:flex-row gap-8">
            
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 shrink-0">
              <TabsList className="flex flex-col h-auto bg-transparent space-y-1 p-0">
                <TabsTrigger 
                  value="profile" 
                  className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 hover:text-white rounded-xl"
                >
                  <User className="h-5 w-5" /> Profile & Wallet
                </TabsTrigger>
                
                <TabsTrigger 
                  value="persona" 
                  className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 hover:text-white rounded-xl"
                >
                  <Zap className="h-5 w-5" /> Personas
                </TabsTrigger>

                <TabsTrigger 
                  value="security" 
                  className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 hover:text-white rounded-xl"
                >
                  <Lock className="h-5 w-5" /> Security
                </TabsTrigger>

                <TabsTrigger 
                  value="notifications" 
                  className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 hover:text-white rounded-xl"
                >
                  <Bell className="h-5 w-5" /> Notifications
                </TabsTrigger>

                <TabsTrigger 
                  value="preferences" 
                  className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 hover:text-white rounded-xl"
                >
                  <Palette className="h-5 w-5" /> Preferences
                </TabsTrigger>

                <TabsTrigger 
                  value="api-keys" 
                  className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 hover:text-white rounded-xl"
                >
                  <KeyRound className="h-5 w-5" /> API Keys
                </TabsTrigger>

                {isAdmin && (
                  <TabsTrigger 
                    value="admin" 
                    className="w-full justify-start gap-3 px-4 py-3 h-auto data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400 text-gray-400 hover:text-white rounded-xl mt-4 border border-transparent data-[state=active]:border-red-500/30"
                  >
                    <ShieldAlert className="h-5 w-5" /> Admin Panel
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 min-w-0">
              <TabsContent value="profile" className="m-0 border-none outline-none">
                <ProfileTab />
              </TabsContent>
              
              <TabsContent value="persona" className="m-0 border-none outline-none">
                <PersonaTab />
              </TabsContent>
              
              <TabsContent value="security" className="m-0 border-none outline-none">
                <SecurityTab />
              </TabsContent>
              
              <TabsContent value="notifications" className="m-0 border-none outline-none">
                <NotificationsTab />
              </TabsContent>
              
              <TabsContent value="preferences" className="m-0 border-none outline-none">
                <PreferencesTab />
              </TabsContent>
              
              <TabsContent value="api-keys" className="m-0 border-none outline-none">
                <ApiKeysTab />
              </TabsContent>

              {isAdmin && (
                <TabsContent value="admin" className="m-0 border-none outline-none">
                  <AdminTab />
                </TabsContent>
              )}
            </div>
            
          </Tabs>
        </div>
      </div>
    </>
  );
}
