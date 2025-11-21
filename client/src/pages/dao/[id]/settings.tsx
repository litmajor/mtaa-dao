import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Zap, Users, Shield, CreditCard, BarChart3, Bell } from 'lucide-react';
import styles from './settings.module.css';

interface DAOSettings {
  // Basic settings
  name: string;
  description: string;
  daoType: string;

  // Rotation settings
  rotationEnabled: boolean;
  rotationMethod: 'sequential' | 'lottery' | 'proportional';
  rotationCycleDays: number;
  rotationMaxCycles: number;

  // Invitation & Referral settings
  referralRewardsEnabled: boolean;
  referralRewardAmount: number;
  invitationExpiryDays: number;
  autoAcceptPeerInvites: boolean;

  // Rules & Governance
  minMembersForGovernance: number;
  votingQuorumPercentage: number;
  proposalCooldownHours: number;
  maxPendingProposals: number;

  // Treasury & Financial
  treasuryMinimumBalance: number;
  transactionAuditThreshold: number;
  autoAuditEnabled: boolean;
  emergencyPauseEnabled: boolean;

  // Subscription & Limits
  maxMembers: number;
  maxDailyTransactions: number;
  maxMonthlyVolume: number;
  subscriptionTier: 'free' | 'pro' | 'enterprise';

  // Notifications
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  rotationNotifications: boolean;
  invitationReminders: boolean;
}

interface DaoSettingsResponse {
  settings: DAOSettings;
  usage: {
    currentMembers: number;
    monthlyVolume: number;
    dailyTransactions: number;
  };
  subscription: {
    tier: string;
    renewalDate: string;
    autoRenew: boolean;
  };
}

export default function DAOSettingsPage() {
  const { id: daoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<DAOSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (daoId) {
      fetchSettings();
      checkAdminStatus();
    }
  }, [daoId]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch(`/api/dao/${daoId}/admin-check`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        setIsAdmin(true);
      }
    } catch (err) {
      console.error('Admin check failed:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dao/${daoId}/settings`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch settings');

      const data: DaoSettingsResponse = await response.json();
      setSettings(data.settings);
      setUsageData(data.usage);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings || !isAdmin) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/dao/${daoId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) throw new Error('Failed to save settings');

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof DAOSettings, value: any) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center p-8 text-red-600">
          Only DAO admins can access settings
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center p-8 text-gray-600">Failed to load settings</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-8 h-8" />
            DAO Settings
          </h1>
          <p className="text-gray-600 mt-2">Manage DAO configuration and customizations</p>
        </div>
        <Button onClick={() => navigate(-1)} variant="outline">
          Back
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Usage Overview */}
      {usageData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Current Members</p>
              <p className="text-3xl font-bold mt-1">{usageData.currentMembers}/{settings.maxMembers}</p>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ ['--width' as any]: `${(usageData.currentMembers / settings.maxMembers) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Monthly Volume</p>
              <p className="text-3xl font-bold mt-1">${usageData.monthlyVolume.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-2">
                Limit: ${settings.maxMonthlyVolume.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Daily Transactions</p>
              <p className="text-3xl font-bold mt-1">{usageData.dailyTransactions}</p>
              <p className="text-xs text-gray-400 mt-2">
                Limit: {settings.maxDailyTransactions}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Subscription Tier</p>
              <Badge className="mt-2 capitalize">
                {settings.subscriptionTier}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="rotation" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="rotation" title="Rotation">
            <Zap className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="referral" title="Referral">
            <Users className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="governance" title="Governance">
            <Shield className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="financial" title="Financial">
            <CreditCard className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="limits" title="Limits">
            <BarChart3 className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="notifications" title="Alerts">
            <Bell className="w-4 h-4" />
          </TabsTrigger>
        </TabsList>

        {/* Rotation Settings */}
        <TabsContent value="rotation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rotation Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.rotationEnabled}
                    onChange={(e) => updateSetting('rotationEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">Enable Rotation</span>
                </label>
              </div>

              {settings.rotationEnabled && (
                <>
                  <div>
                    <label htmlFor="rotation-method" className="block text-sm font-medium mb-2">Selection Method</label>
                    <select
                      id="rotation-method"
                      value={settings.rotationMethod}
                      onChange={(e) => updateSetting('rotationMethod', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      aria-label="Select rotation method"
                    >
                      <option value="sequential">Sequential (Fair Round-Robin)</option>
                      <option value="lottery">Lottery (Random)</option>
                      <option value="proportional">Proportional (By Contribution)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Cycle Duration (days)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={settings.rotationCycleDays}
                        onChange={(e) => updateSetting('rotationCycleDays', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Maximum Cycles
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={settings.rotationMaxCycles}
                        onChange={(e) => updateSetting('rotationMaxCycles', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referral Settings */}
        <TabsContent value="referral" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Referral & Invitation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.referralRewardsEnabled}
                    onChange={(e) => updateSetting('referralRewardsEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">Enable Referral Rewards</span>
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  ⚠️ Rewards only given after invited users complete signup AND accept invite
                </p>
              </div>

              {settings.referralRewardsEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Reward Amount per Successful Signup
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={settings.referralRewardAmount}
                        onChange={(e) => updateSetting('referralRewardAmount', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200">
                    <p className="text-sm text-blue-700 font-medium">Reward Processing</p>
                    <ul className="text-xs text-blue-600 mt-2 space-y-1">
                      <li>✓ Invitation sent (no reward yet)</li>
                      <li>✓ User creates account (no reward yet)</li>
                      <li>✓ User accepts invitation (REWARD AWARDED)</li>
                    </ul>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Invitation Expiry (days)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={settings.invitationExpiryDays}
                    onChange={(e) => updateSetting('invitationExpiryDays', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-3 mt-6">
                    <input
                      type="checkbox"
                      checked={settings.autoAcceptPeerInvites}
                      onChange={(e) => updateSetting('autoAcceptPeerInvites', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Auto-accept Peer Invites</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Governance Settings */}
        <TabsContent value="governance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Governance & Voting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Minimum Members for Governance
                </label>
                <Input
                  type="number"
                  min="1"
                  value={settings.minMembersForGovernance}
                  onChange={(e) => updateSetting('minMembersForGovernance', parseInt(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Voting Quorum (%)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.votingQuorumPercentage}
                  onChange={(e) => updateSetting('votingQuorumPercentage', parseInt(e.target.value))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Proposal Cool-down (hours)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={settings.proposalCooldownHours}
                    onChange={(e) => updateSetting('proposalCooldownHours', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Max Pending Proposals
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.maxPendingProposals}
                    onChange={(e) => updateSetting('maxPendingProposals', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Settings */}
        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Treasury Minimum Balance
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.treasuryMinimumBalance}
                  onChange={(e) => updateSetting('treasuryMinimumBalance', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Transaction Audit Threshold
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.transactionAuditThreshold}
                  onChange={(e) => updateSetting('transactionAuditThreshold', parseFloat(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Transactions above this amount trigger audit review
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.autoAuditEnabled}
                    onChange={(e) => updateSetting('autoAuditEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Auto-audit Large Transactions</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.emergencyPauseEnabled}
                    onChange={(e) => updateSetting('emergencyPauseEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Emergency Pause on Anomalies</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Limits & Subscription */}
        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Capacity Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Maximum Members</label>
                <Input
                  type="number"
                  min="1"
                  value={settings.maxMembers}
                  onChange={(e) => updateSetting('maxMembers', parseInt(e.target.value))}
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upgrade subscription to increase member limit
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Daily Transactions
                </label>
                <Input
                  type="number"
                  min="1"
                  value={settings.maxDailyTransactions}
                  onChange={(e) => updateSetting('maxDailyTransactions', parseInt(e.target.value))}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Monthly Volume
                </label>
                <Input
                  type="number"
                  min="0"
                  value={settings.maxMonthlyVolume}
                  onChange={(e) => updateSetting('maxMonthlyVolume', parseFloat(e.target.value))}
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  Current tier: <Badge>{settings.subscriptionTier}</Badge>
                </p>
              </div>

              <Button className="w-full" variant="outline">
                View Subscription Plans
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.emailNotificationsEnabled}
                    onChange={(e) => updateSetting('emailNotificationsEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">Email Notifications</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.smsNotificationsEnabled}
                    onChange={(e) => updateSetting('smsNotificationsEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">SMS Notifications</span>
                </label>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="font-medium text-sm">Notification Types:</p>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.rotationNotifications}
                    onChange={(e) => updateSetting('rotationNotifications', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Rotation Events</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.invitationReminders}
                    onChange={(e) => updateSetting('invitationReminders', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Invitation Reminders</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex gap-3">
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
        <Button onClick={() => fetchSettings()} variant="outline">
          Reset
        </Button>
      </div>
    </div>
  );
}
