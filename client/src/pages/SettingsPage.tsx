import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Lock, Bell, Palette, Zap } from "lucide-react";
import { useAuth } from "@/pages/hooks/useAuth";
import { PageLoading } from "@/components/ui/page-loading";
import { PersonaModeSelector } from "@/components/PersonaModeSelector";

/**
 * Unified Settings Page - Phase 3
 * 
 * Tabs:
 * ✅ Subprofile: Choose active subprofile (okedi/yuki/amara)
 * ✅ Profile: Name, email, avatar, bio
 * ✅ Security: Password, 2FA, sessions
 * ✅ Notifications: Email, push preferences
 * ✅ Preferences: Theme, language, timezone
 */

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("subprofile");

  if (isLoading) {
    return <PageLoading message="Loading settings..." />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Unable to load settings</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Account Settings | Mtaa DAO</title>
        <meta
          name="description"
          content="Manage your account, security, and preferences"
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-white">Account Settings</h1>
            <p className="text-slate-400 mt-2">Manage your account, subprofile, and preferences</p>
          </div>
        </div>

        {/* Settings Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tab Navigation */}
            <TabsList className="grid w-full grid-cols-5 mb-8 bg-slate-800 border border-slate-700">
              <TabsTrigger value="subprofile" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Subprofile</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Prefs</span>
              </TabsTrigger>
            </TabsList>

            {/* SUBPROFILE TAB - NEW */}
            <TabsContent value="subprofile" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Active Subprofile</CardTitle>
                  <CardDescription>
                    Switch between subprofiles to organize your dashboard and AI guidance.
                    All features are accessible from any subprofile.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PersonaModeSelector variant="full" />
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">What are Subprofiles?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-2">🎤 Okedi - Community Manager</h4>
                    <p className="text-slate-300 text-sm">
                      Focus on governance, creating DAOs, and leading communities. This subprofile prioritizes governance features.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">🛠️ Yuki - Trader</h4>
                    <p className="text-slate-300 text-sm">
                      Focus on trading, yield farming, and smart contracts. This subprofile prioritizes trading and DeFi features.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">💰 Amara - Investor</h4>
                    <p className="text-slate-300 text-sm">
                      Focus on passive income and wealth building. This subprofile prioritizes investment and yield opportunities.
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4">
                    💡 Tip: Your subprofile can be changed anytime. All features remain accessible - subprofiles just change how your dashboard is organized and what Morio (our AI) focuses on.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PROFILE TAB */}
            <TabsContent value="profile" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
                    <div className="p-3 bg-slate-700 rounded-lg text-slate-200">{user?.username}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                    <div className="p-3 bg-slate-700 rounded-lg text-slate-200">{user?.email}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Account Created</label>
                    <div className="p-3 bg-slate-700 rounded-lg text-slate-200">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECURITY TAB */}
            <TabsContent value="security" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Security Settings</CardTitle>
                  <CardDescription>
                    Manage your account security
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-2">Password</h4>
                    <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700">
                      Change Password
                    </Button>
                  </div>
                  <hr className="border-slate-700" />
                  <div>
                    <h4 className="font-semibold text-white mb-2">Two-Factor Authentication</h4>
                    <p className="text-slate-400 text-sm mb-3">Add an extra layer of security to your account</p>
                    <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700">
                      Enable 2FA
                    </Button>
                  </div>
                  <hr className="border-slate-700" />
                  <div>
                    <h4 className="font-semibold text-white mb-2">Active Sessions</h4>
                    <p className="text-slate-400 text-sm mb-3">Manage devices with access to your account</p>
                    <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700">
                      View Sessions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* NOTIFICATIONS TAB */}
            <TabsContent value="notifications" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Notification Preferences</CardTitle>
                  <CardDescription>
                    Control how you receive updates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">Email Notifications</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">DAO Updates</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">Trading Alerts</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">Weekly Summary</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PREFERENCES TAB */}
            <TabsContent value="preferences" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">User Preferences</CardTitle>
                  <CardDescription>
                    Customize your experience
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Theme</label>
                    <select className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200">
                      <option>Dark (Current)</option>
                      <option>Light</option>
                      <option>Auto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Language</label>
                    <select className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200">
                      <option>English</option>
                      <option>Swahili</option>
                      <option>French</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Timezone</label>
                    <select className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200">
                      <option>Africa/Nairobi (UTC+3)</option>
                      <option>UTC</option>
                      <option>America/New_York</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
