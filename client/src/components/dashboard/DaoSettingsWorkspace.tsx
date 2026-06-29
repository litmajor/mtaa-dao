/**
 * DaoSettingsWorkspace
 *
 * Merges the full DAOSettingsPage (client/src/pages/dao/[id]/settings.tsx)
 * into the OkediDashboard FocusPanel as a workspace component.
 *
 * Role behaviour:
 *   - admin:  full edit + Danger Zone
 *   - elder:  read-only view of all panels
 *   - member: read-only view (Settings tab always visible, controls disabled)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Activity, Users, Shield, DollarSign, TrendingUp, AlertCircle, Wallet, Lock, Bot, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DAOSettings {
  name: string;
  description: string;
  daoType: string;
  rotationEnabled: boolean;
  rotationMethod: 'sequential' | 'lottery' | 'proportional';
  rotationCycleDays: number;
  rotationMaxCycles: number;
  referralRewardsEnabled: boolean;
  referralRewardAmount: number;
  invitationExpiryDays: number;
  autoAcceptPeerInvites: boolean;
  minMembersForGovernance: number;
  votingQuorumPercentage: number;
  proposalCooldownHours: number;
  maxPendingProposals: number;
  treasuryMinimumBalance: number;
  transactionAuditThreshold: number;
  autoAuditEnabled: boolean;
  emergencyPauseEnabled: boolean;
  maxMembers: number;
  maxDailyTransactions: number;
  maxMonthlyVolume: number;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  rotationNotifications: boolean;
  invitationReminders: boolean;
}

interface AgentSubscription {
  agentId: string;
  agentName: string;
  tier: string;
  isSubscribed: boolean;
  expiresAt: string | null;
  feeKES: number;
  feeUSD: number;
  description: string;
  category: string;
}

interface DaoSettingsWorkspaceProps {
  daoId: string;
  userRole?: 'admin' | 'elder' | 'member';
}

const AGENT_SUBSCRIPTION_CATEGORIES = [
  { id: 'governance', label: 'Governance', agents: ['Nuru', 'Elder Kaizen', 'Gov Analytics', 'Compliance'] },
  { id: 'treasury', label: 'Treasury', agents: ['Kwetu', 'Treasury Agent', 'Financial Analyzer', 'Risk Assessor'] },
  { id: 'security', label: 'Security', agents: ['Defender', 'Scout', 'Analyzer', 'Watcher'] },
  { id: 'community', label: 'Community', agents: ['Community', 'Chama', 'Contribution Analyzer'] },
];

export default function DaoSettingsWorkspace({ daoId, userRole = 'member' }: DaoSettingsWorkspaceProps) {
  const [settings, setSettings] = useState<DAOSettings | null>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [agentSubs, setAgentSubs] = useState<AgentSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';
  const canEdit = isAdmin; // elders and members: read-only

  const fetchSettings = useCallback(async () => {
    if (!daoId) return;
    setLoading(true);
    try {
      // Try v1 endpoint first, fall back to legacy
      let data: any = null;
      const v1Res = await fetch(`/api/v1/daos/${daoId}/subscriptions/status`, { credentials: 'include' });
      const legacyRes = await fetch(`/api/dao/${daoId}/settings`, { credentials: 'include' });

      if (legacyRes.ok) {
        data = await legacyRes.json();
        setSettings(data.settings || data);
        setUsageData(data.usage || null);
      } else {
        // Provide sensible defaults if backend has no settings yet
        setSettings({
          name: '', description: '', daoType: 'collective',
          rotationEnabled: false, rotationMethod: 'sequential', rotationCycleDays: 30, rotationMaxCycles: 12,
          referralRewardsEnabled: false, referralRewardAmount: 0, invitationExpiryDays: 7, autoAcceptPeerInvites: false,
          minMembersForGovernance: 3, votingQuorumPercentage: 60, proposalCooldownHours: 24, maxPendingProposals: 5,
          treasuryMinimumBalance: 0, transactionAuditThreshold: 10000, autoAuditEnabled: true, emergencyPauseEnabled: false,
          maxMembers: 20, maxDailyTransactions: 50, maxMonthlyVolume: 500000, subscriptionTier: 'free',
          emailNotificationsEnabled: true, smsNotificationsEnabled: false, rotationNotifications: true, invitationReminders: true,
        });
      }

      // Fetch agent subscriptions
      try {
        const agentRes = await fetch(`/api/agents`, { credentials: 'include' });
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          // Map agents to subscription display format
          const subs: AgentSubscription[] = (agentData.agents || []).map((a: any) => ({
            agentId: a.id,
            agentName: a.name || a.type,
            tier: a.config?.tier || 'free',
            isSubscribed: a.status === 'active',
            expiresAt: null,
            feeKES: 0,
            feeUSD: 0,
            description: a.description || '',
            category: a.type || 'general',
          }));
          setAgentSubs(subs);
        }
      } catch { /* ignore agent subscription errors */ }

      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [daoId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = (key: keyof DAOSettings, value: any) => {
    if (!canEdit) return;
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  const handleSave = async () => {
    if (!settings || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dao/${daoId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const ReadOnlyBanner = () => (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-slate-400 mb-4">
      <Lock className="h-4 w-4" />
      <span>Settings are read-only. Only DAO admins can make changes.</span>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>Failed to load DAO settings.</p>
        <button onClick={fetchSettings} className="mt-2 text-purple-400 underline text-sm">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-400" />
            DAO Settings
          </h2>
          <p className="text-slate-400 text-sm mt-1">Manage DAO configuration and customizations</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Badge className="bg-green-600/20 text-green-300 border-green-600/30">Admin</Badge>
          )}
          {!canEdit && (
            <Badge className="bg-slate-600/40 text-slate-300">
              {userRole === 'elder' ? 'Elder (read-only)' : 'Member (read-only)'}
            </Badge>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-green-300 text-sm">{success}</div>
      )}

      {/* Usage Stats */}
      {usageData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Members', value: `${usageData.currentMembers}/${settings.maxMembers}` },
            { label: 'Monthly Volume', value: `$${(usageData.monthlyVolume || 0).toLocaleString()}` },
            { label: 'Daily Txns', value: usageData.dailyTransactions || 0 },
            { label: 'Tier', value: settings.subscriptionTier, badge: true },
          ].map((s) => (
            <div key={s.label} className="bg-slate-800/60 rounded-xl p-3">
              <div className="text-xs text-slate-400">{s.label}</div>
              {s.badge ? (
                <Badge className="mt-1 capitalize">{s.value}</Badge>
              ) : (
                <div className="text-base font-bold text-white mt-1">{s.value}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Not editable banner */}
      {!canEdit && <ReadOnlyBanner />}

      {/* Settings Tabs */}
      <Tabs defaultValue="rotation" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-8 h-auto">
          {[
            { value: 'rotation', icon: <Activity className="w-4 h-4" />, label: 'Rotation' },
            { value: 'referral', icon: <Users className="w-4 h-4" />, label: 'Referral' },
            { value: 'governance', icon: <Shield className="w-4 h-4" />, label: 'Governance' },
            { value: 'financial', icon: <DollarSign className="w-4 h-4" />, label: 'Financial' },
            { value: 'treasury', icon: <Wallet className="w-4 h-4" />, label: 'Treasury' },
            { value: 'limits', icon: <TrendingUp className="w-4 h-4" />, label: 'Limits' },
            { value: 'agents', icon: <Bot className="w-4 h-4" />, label: 'Agents' },
            { value: 'notifications', icon: <AlertCircle className="w-4 h-4" />, label: 'Alerts' },
          ].map((t) => (
            <TabsTrigger key={t.value} value={t.value} title={t.label} className="flex-col gap-1 py-2 h-auto text-xs">
              {t.icon}
              <span className="hidden md:block">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Rotation */}
        <TabsContent value="rotation" className="space-y-4 mt-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader><CardTitle className="text-white text-base">Rotation Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox" checked={settings.rotationEnabled}
                  onChange={(e) => updateSetting('rotationEnabled', e.target.checked)}
                  className="w-4 h-4 accent-purple-500" disabled={!canEdit}
                />
                <span className="font-medium text-white">Enable Rotation</span>
              </label>
              {settings.rotationEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Selection Method</label>
                    <select
                      value={settings.rotationMethod}
                      onChange={(e) => updateSetting('rotationMethod', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                      disabled={!canEdit}
                    >
                      <option value="sequential">Sequential (Fair Round-Robin)</option>
                      <option value="lottery">Lottery (Random)</option>
                      <option value="proportional">Proportional (By Contribution)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Cycle Duration (days)</label>
                      <Input type="number" min="1" max="365" value={settings.rotationCycleDays}
                        onChange={(e) => updateSetting('rotationCycleDays', parseInt(e.target.value))}
                        disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Maximum Cycles</label>
                      <Input type="number" min="1" value={settings.rotationMaxCycles}
                        onChange={(e) => updateSetting('rotationMaxCycles', parseInt(e.target.value))}
                        disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referral */}
        <TabsContent value="referral" className="space-y-4 mt-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader><CardTitle className="text-white text-base">Referral & Invitation Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={settings.referralRewardsEnabled}
                  onChange={(e) => updateSetting('referralRewardsEnabled', e.target.checked)}
                  className="w-4 h-4 accent-purple-500" disabled={!canEdit} />
                <span className="font-medium text-white">Enable Referral Rewards</span>
              </label>
              {settings.referralRewardsEnabled && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Reward per Successful Signup</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">$</span>
                    <Input type="number" min="0" step="0.01" value={settings.referralRewardAmount}
                      onChange={(e) => updateSetting('referralRewardAmount', parseFloat(e.target.value))}
                      disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Invitation Expiry (days)</label>
                  <Input type="number" min="1" max="365" value={settings.invitationExpiryDays}
                    onChange={(e) => updateSetting('invitationExpiryDays', parseInt(e.target.value))}
                    disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={settings.autoAcceptPeerInvites}
                      onChange={(e) => updateSetting('autoAcceptPeerInvites', e.target.checked)}
                      className="w-4 h-4 accent-purple-500" disabled={!canEdit} />
                    <span className="text-sm text-white">Auto-accept Peer Invites</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Governance */}
        <TabsContent value="governance" className="space-y-4 mt-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader><CardTitle className="text-white text-base">Governance & Voting</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Min Members for Governance</label>
                <Input type="number" min="1" value={settings.minMembersForGovernance}
                  onChange={(e) => updateSetting('minMembersForGovernance', parseInt(e.target.value))}
                  disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Voting Quorum (%)</label>
                <Input type="number" min="1" max="100" value={settings.votingQuorumPercentage}
                  onChange={(e) => updateSetting('votingQuorumPercentage', parseInt(e.target.value))}
                  disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Proposal Cool-down (hours)</label>
                  <Input type="number" min="0" value={settings.proposalCooldownHours}
                    onChange={(e) => updateSetting('proposalCooldownHours', parseInt(e.target.value))}
                    disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Max Pending Proposals</label>
                  <Input type="number" min="1" value={settings.maxPendingProposals}
                    onChange={(e) => updateSetting('maxPendingProposals', parseInt(e.target.value))}
                    disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial */}
        <TabsContent value="financial" className="space-y-4 mt-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader><CardTitle className="text-white text-base">Financial Controls</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Treasury Minimum Balance</label>
                <Input type="number" min="0" step="0.01" value={settings.treasuryMinimumBalance}
                  onChange={(e) => updateSetting('treasuryMinimumBalance', parseFloat(e.target.value))}
                  disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Transaction Audit Threshold</label>
                <Input type="number" min="0" step="0.01" value={settings.transactionAuditThreshold}
                  onChange={(e) => updateSetting('transactionAuditThreshold', parseFloat(e.target.value))}
                  disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
                <p className="text-xs text-slate-500 mt-1">Transactions above this amount trigger audit review</p>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'autoAuditEnabled', label: 'Auto-audit Large Transactions' },
                  { key: 'emergencyPauseEnabled', label: 'Emergency Pause on Anomalies' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3">
                    <input type="checkbox" checked={(settings as any)[key]}
                      onChange={(e) => updateSetting(key as keyof DAOSettings, e.target.checked)}
                      className="w-4 h-4 accent-purple-500" disabled={!canEdit} />
                    <span className="text-sm text-white">{label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Treasury (embedded TreasuryManagement) */}
        <TabsContent value="treasury" className="space-y-4 mt-4">
          <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-300 text-sm">
            <p className="font-medium text-white mb-2">Treasury Management</p>
            <p>Full treasury management controls are available in the <strong>Treasury</strong> domain tab. This tab shows treasury-linked settings only.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Treasury Minimum Balance</label>
                <Input type="number" value={settings.treasuryMinimumBalance}
                  onChange={(e) => updateSetting('treasuryMinimumBalance', parseFloat(e.target.value))}
                  disabled={!canEdit} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={settings.autoAuditEnabled}
                  onChange={(e) => updateSetting('autoAuditEnabled', e.target.checked)}
                  className="w-4 h-4 accent-purple-500" disabled={!canEdit} />
                <span className="text-sm text-white">Auto-audit Enabled</span>
              </label>
            </div>
          </div>
        </TabsContent>

        {/* Limits */}
        <TabsContent value="limits" className="space-y-4 mt-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader><CardTitle className="text-white text-base">Capacity Limits</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'maxMembers', label: 'Maximum Members', note: 'Upgrade subscription to increase' },
                { key: 'maxDailyTransactions', label: 'Max Daily Transactions', note: '' },
                { key: 'maxMonthlyVolume', label: 'Max Monthly Volume ($)', note: '' },
              ].map(({ key, label, note }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
                  <Input type="number" value={(settings as any)[key]}
                    onChange={(e) => updateSetting(key as keyof DAOSettings, parseFloat(e.target.value))}
                    disabled className="bg-slate-700 border-slate-600 text-white opacity-60" />
                  {note && <p className="text-xs text-slate-500 mt-1">{note}</p>}
                </div>
              ))}
              <div>
                <p className="text-sm text-slate-300">Current tier: <Badge className="capitalize ml-2">{settings.subscriptionTier}</Badge></p>
              </div>
              <Button variant="outline" className="w-full border-purple-500/40 text-purple-300 hover:bg-purple-500/10">
                View Subscription Plans
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent Subscriptions */}
        <TabsContent value="agents" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Agent Subscriptions</p>
                <p className="text-xs text-slate-400 mt-1">
                  Agents are paid services via the AgentPaymentGateway contract. Active agents provide intelligence, analytics, and automation for your DAO.
                </p>
              </div>
              <button onClick={fetchSettings} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {AGENT_SUBSCRIPTION_CATEGORIES.map((cat) => (
              <Card key={cat.id} className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 font-medium">{cat.label} Agents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {cat.agents.map((agentName) => {
                      const sub = agentSubs.find(
                        (s) => s.agentName.toLowerCase().includes(agentName.toLowerCase())
                      );
                      return (
                        <div key={agentName} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${sub?.isSubscribed ? 'bg-green-400' : 'bg-slate-600'}`} />
                            <div>
                              <div className="text-sm text-white font-medium">{agentName}</div>
                              <div className="text-xs text-slate-400">
                                {sub?.isSubscribed ? `Active · ${sub.tier} tier` : 'Inactive'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {sub?.isSubscribed ? (
                              <Badge className="bg-green-600/20 text-green-300 text-xs">Subscribed</Badge>
                            ) : (
                              <Badge className="bg-slate-600/40 text-slate-400 text-xs">Not active</Badge>
                            )}
                            {isAdmin && !sub?.isSubscribed && (
                              <button className="text-xs text-purple-400 hover:text-purple-300 underline">
                                Subscribe
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

            <p className="text-xs text-slate-500 text-center">
              Agent payments processed via AgentPaymentGateway (MTAA/KES). Manage subscriptions in the DAO billing portal.
            </p>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader><CardTitle className="text-white text-base">Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'emailNotificationsEnabled', label: 'Email Notifications' },
                { key: 'smsNotificationsEnabled', label: 'SMS Notifications' },
                { key: 'rotationNotifications', label: 'Rotation Events' },
                { key: 'invitationReminders', label: 'Invitation Reminders' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3">
                  <input type="checkbox" checked={(settings as any)[key]}
                    onChange={(e) => updateSetting(key as keyof DAOSettings, e.target.checked)}
                    className="w-4 h-4 accent-purple-500" disabled={!canEdit} />
                  <span className="text-sm text-white">{label}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save footer — admin only */}
      {canEdit && (
        <div className="flex gap-3 pt-2 border-t border-slate-700">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {saving ? 'Saving...' : 'Save All Settings'}
          </Button>
          <Button onClick={fetchSettings} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
