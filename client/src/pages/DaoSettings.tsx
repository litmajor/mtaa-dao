import React, { useState, useEffect } from "react";
import { useFormPersistence } from './hooks/useFormPersistence';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import MultisigManager from '@/components/multisig/MultisigManager';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { Settings, Shield, Zap, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShortTermDaoExtension } from '@/components/ShortTermDaoExtension';
import { FreeTierLimitWarning } from '@/components/FreeTierLimitWarning';
import { authClient } from '@/utils/authClient';

export default function DaoSettings({ daoName = "Your DAO" }) {
  // Platform-set constants
  const disbursementFee = 2;
  const withdrawalFee = 2;
  const [offrampWhoPays, setOfframpWhoPays] = useState("DAO");
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dummy DAO data for demonstration - replace with actual data fetching
  const daoId = "dummy-dao-id";
  const dao = {
    daoType: "short_term",
    plan: "initial",
    extensionCount: 1,
    planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    originalDuration: 30,
  };

  // Persisted draft/settings loaded from onboarding draft storage so values survive migration
  const initialDraft = {
    governanceModel: '1-person-1-vote',
    quorum: 50,
    votingPeriod: '7d',
    enableMultisig: false,
    multisigSigners: [] as string[],
    multisigRequiredSignatures: 2,
  };
  const { data: draft, setData: setDraft } = useFormPersistence(initialDraft as any);
  const [canEdit, setCanEdit] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [newSigner, setNewSigner] = useState('');

  const InfoTooltip = ({ text }: { text: string }) => (
    <Tooltip>
      <TooltipTrigger>
        <HelpCircle className="w-4 h-4 text-gray-300 hover:text-white ml-2" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setSaveSuccess(false);
    (async () => {
      try {
            // derive daoId from selected context if available
            const daoId = (localStorage.getItem('selectedDaoId') || 'dummy-dao-id');

            // Check local role guard before attempting server save
            if (!canEdit) {
              throw new Error('You do not have permission to update these settings');
            }

        // map votingPeriod ('24h','3d','7d') to hours expected by server
        const toHours = (period: string | undefined) => {
          if (!period) return 24;
          if (period.endsWith('h')) return Number(period.replace('h', ''));
          if (period.endsWith('d')) return Number(period.replace('d', '')) * 24;
          return Number(period) || 24;
        };

        const governanceUpdates: any = {
          quorumPercentage: Number(draft.quorum || 50),
          votingPeriod: toHours(draft.votingPeriod),
        };

        // Send governance update to server
        await authClient.patch(`/api/dao/${daoId}/settings`, {
          category: 'governance',
          updates: governanceUpdates,
        });

        // If multisig is enabled, call v1 treasury multisig config endpoint
        if (draft.enableMultisig) {
          await authClient.post(`/v1/daos/${daoId}/treasury/multisig/config`, {
            requiredApprovals: Number(draft.multisigRequiredSignatures || 2),
            totalSigners: (draft.multisigSigners || []).length || 0,
            withdrawalThreshold: null,
          });
        }

        // Save offrampWhoPays locally for now (platform fees are constants)
        console.log('Saved settings to server', { governanceUpdates, multisig: draft.enableMultisig });
        setSaveSuccess(true);
      } catch (err: any) {
        console.error('Failed to save DAO settings', err);
        setSaveSuccess(false);
        // show minimal feedback - real app may use toast
        alert(err?.message || 'Failed to save settings');
      } finally {
        setIsLoading(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    })();
  }

  // Fetch user's role for selected DAO and load server settings if permitted
  useEffect(() => {
    (async () => {
      try {
        const daoId = (localStorage.getItem('selectedDaoId') || '');
        if (!daoId) return;

        // Get user's DAOs to determine role
        const myDaos = await authClient.get('/api/users/my-daos');
        const found = Array.isArray(myDaos) ? myDaos.find((d: any) => d.id === daoId) : null;
        const role = found?.role || null;
        setUserRole(role);
        setCanEdit(role === 'admin' || role === 'elder');

        if (role === 'admin' || role === 'elder') {
          // Load server-side settings to pre-fill the form
          try {
            const res = await authClient.get(`/api/dao/${daoId}/settings`);
            if (res?.settings?.governance) {
              setDraft((prev: any) => ({
                ...prev,
                governanceModel: prev.governanceModel || '1-person-1-vote',
                quorum: res.settings.governance.quorumPercentage ?? prev.quorum,
                votingPeriod: (res.settings.governance.votingPeriod ? `${res.settings.governance.votingPeriod}h` : prev.votingPeriod)
              }));
            }
          } catch (err) {
            // Ignore load errors here; server enforces same role
            console.warn('Could not load DAO settings from server', err);
          }
        }
      } catch (err) {
        console.warn('Failed to determine DAO role', err);
      }
    })();
  }, [setDraft]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 flex items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
      </div>

      {/* Main Container */}
      <div className="relative max-w-2xl w-full mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-4 shadow-lg">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {daoName}
          </h1>
          <p className="text-lg text-gray-300">Configure your DAO's fee structure</p>
        </div>

        {/* Role banner for non-admins */}
        {!canEdit && (
          <div className="mb-6 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Read-only:</strong> You are signed in as <strong>{userRole || 'member'}</strong> and cannot modify advanced settings. Only DAO admins or elders can save changes.
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          <div className="space-y-6">
            {/* Free Tier Warning Widget */}
            {dao?.daoType === 'free' && (
              <FreeTierLimitWarning
                daoId={daoId}
                onUpgrade={() => window.location.href = `/pricing?upgrade=${daoId}`}
              />
            )}
            
            {/* Short-Term DAO Extension Widget */}
            {dao?.daoType === 'short_term' && (
              <ShortTermDaoExtension
                daoId={daoId}
                currentPlan={dao.plan}
                daoType={dao.daoType}
                extensionCount={dao.extensionCount || 0}
                planExpiresAt={dao.planExpiresAt}
                originalDuration={dao.originalDuration || 30}
              />
            )}

              {/* Governance Settings Card (moved from onboarding) */}
              <Card className="bg-white/5 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Governance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center mb-3">
                        <Label className="text-sm font-medium">Voting Method</Label>
                        <InfoTooltip text="This decides who has more say in group decisions" />
                      </div>
                      <RadioGroup
                        value={draft.governanceModel}
                        onValueChange={(value) => setDraft((prev: any) => ({ ...prev, governanceModel: value }))}
                        className="space-y-3"
                        disabled={!canEdit}
                      >
                        <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                          <RadioGroupItem value={'1-person-1-vote'} id={'1-person-1-vote'} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={'1-person-1-vote'} className="font-medium cursor-pointer text-white">Equal Voice (1 Person = 1 Vote)</Label>
                            <p className="text-sm text-gray-300 mt-1">Every member has equal say, regardless of contribution.</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                          <RadioGroupItem value={'weighted-stake'} id={'weighted-stake'} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={'weighted-stake'} className="font-medium cursor-pointer text-white">Contribution-Based Voting</Label>
                            <p className="text-sm text-gray-300 mt-1">Those who contribute more have more voting power.</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                          <RadioGroupItem value={'delegated'} id={'delegated'} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={'delegated'} className="font-medium cursor-pointer text-white">Choose a Representative</Label>
                            <p className="text-sm text-gray-300 mt-1">Let someone you trust vote on your behalf.</p>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Label className="text-sm font-medium text-white">Minimum Voters Required: {draft.quorum}%</Label>
                          <InfoTooltip text="How many members must vote for a decision to count?" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 mb-2">Example: If you have 10 members and set this to 50%, at least 5 people must vote.</p>
                      <Slider
                        value={[draft.quorum || 50]}
                        onValueChange={([value]) => setDraft((prev: any) => ({ ...prev, quorum: Math.max(20, value) }))}
                        min={20}
                        max={100}
                        step={5}
                        className="mt-2"
                        disabled={!canEdit}
                      />
                    </div>

                    <div>
                      <div className="flex items-center">
                        <Label className="text-sm font-medium text-white">Voting Period</Label>
                        <InfoTooltip text={`How long members have to vote on decisions`} />
                      </div>
                      <Select value={draft.votingPeriod || '7d'} onValueChange={(value) => setDraft((prev: any) => ({ ...prev, votingPeriod: value }))} disabled={!canEdit}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24h">24 hours</SelectItem>
                          <SelectItem value="3d">3 days</SelectItem>
                          <SelectItem value="7d">7 days (Recommended)</SelectItem>
                          <SelectItem value="14d">14 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Multisig Settings Card (moved from onboarding) */}
              <Card className="bg-white/5 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Multisig & Treasury Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-white">Enable Multisig for Treasury</p>
                        <p className="text-xs text-gray-300">Require multiple approvals for withdrawals</p>
                      </div>
                      <Switch
                        checked={!!draft.enableMultisig}
                        onCheckedChange={(checked) => setDraft((prev: any) => ({ ...prev, enableMultisig: checked }))}
                        disabled={!canEdit}
                      />
                    </div>

                    {(draft.enableMultisig) && (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-white">Multisig Signers</Label>
                          <p className="text-xs text-gray-300">Who will be signers for multisig withdrawals? Founder is pre-added.</p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {(draft.multisigSigners || []).map((s: string, i: number) => (
                              <div key={s + i} className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded">
                                <span className="font-mono text-sm break-all">{s}</span>
                                <Button size="icon" variant="ghost" onClick={() => setDraft((prev: any) => ({ ...prev, multisigSigners: (prev.multisigSigners || []).filter((_: any, idx: number) => idx !== i) }))} disabled={!canEdit}>
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2 mt-2">
                            <Input placeholder="0x... or user-id" value={newSigner} onChange={(e) => setNewSigner(e.target.value)} disabled={!canEdit} />
                            <Button onClick={() => {
                              const val = newSigner.trim();
                              if (!val) return;
                              setDraft((prev: any) => ({ ...prev, multisigSigners: [...(prev.multisigSigners || []), val] }));
                              setNewSigner('');
                            }} disabled={!canEdit}>
                              Add
                            </Button>
                          </div>

                            <div>
                              <Button variant="ghost" size="sm" onClick={() => setDraft((prev: any) => ({ ...prev, showMultisigManager: !(prev.showMultisigManager || false) }))} disabled={!canEdit}>
                                {draft.showMultisigManager ? 'Hide Advanced Multisig Manager' : 'Open Advanced Multisig Manager'}
                              </Button>
                              {draft.showMultisigManager && (
                                <div className="mt-4">
                                  <MultisigManager daoId={daoId} elders={[]} />
                                </div>
                              )}
                            </div>

                          <div className="flex items-center gap-4 mt-2">
                            <div>
                              <Label className="text-sm text-white">Required Signatures</Label>
                              <p className="text-xs text-gray-300">Minimum number of signers required to approve a withdrawal</p>
                            </div>
                            <input aria-label="Required signatures" id="multisig-required" type="number" min={2} max={(draft.multisigSigners || []).length || 2} value={draft.multisigRequiredSignatures || 2} onChange={(e) => setDraft((prev: any) => ({ ...prev, multisigRequiredSignatures: Number(e.target.value) }))} className="w-20 px-2 py-1 border rounded" disabled={!canEdit} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* General Settings Card */}
            <Card className="bg-white/5 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white">General Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Vault Disbursement Fee */}
                  <div className="group">
                    <div className="flex items-center mb-4">
                      <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl mr-4 shadow-lg group-hover:shadow-xl transition-shadow">
                        <span className="text-white text-xl">💰</span>
                      </div>
                      <div>
                        <label className="block text-xl font-semibold text-white mb-1">
                          Vault Disbursement Fee <span className="text-xs text-gray-400">(Platform-set)</span>
                        </label>
                        <p className="text-gray-300 text-sm">Fee charged when funds are disbursed from vault. This is set by the platform and cannot be changed.</p>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-white/5 border border-white/20 rounded-xl px-6 py-4 text-white text-lg placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all backdrop-blur-sm flex items-center justify-between">
                        <span>{disbursementFee}%</span>
                        <span className="text-gray-400 font-semibold">Platform</span>
                      </div>
                    </div>
                  </div>

                  {/* Offramp Withdrawal Fee */}
                  <div className="group">
                    <div className="flex items-center mb-4">
                      <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl mr-4 shadow-lg group-hover:shadow-xl transition-shadow">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <label className="block text-xl font-semibold text-white mb-1">
                          Offramp Withdrawal Fee <span className="text-xs text-gray-400">(Platform-set)</span>
                        </label>
                        <p className="text-gray-300 text-sm">Fee charged when users withdraw via offramp. This is set by the platform and cannot be changed.</p>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-white/5 border border-white/20 rounded-xl px-6 py-4 text-white text-lg placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all backdrop-blur-sm flex items-center justify-between">
                        <span>{withdrawalFee}%</span>
                        <span className="text-gray-400 font-semibold">Platform</span>
                      </div>
                    </div>
                  </div>

                  {/* Who Pays Offramp Fee */}
                  <div className="group">
                    <div className="flex items-center mb-4">
                      <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl mr-4 shadow-lg group-hover:shadow-xl transition-shadow">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <label className="block text-xl font-semibold text-white mb-1">
                          Offramp Fee Responsibility
                        </label>
                        <p className="text-gray-300 text-sm">Who bears the cost of offramp fees</p>
                      </div>
                    </div>
                    <label id="offrampWhoPaysLabel" className="sr-only">
                      Offramp Fee Responsibility
                    </label>
                    <select
                      aria-labelledby="offrampWhoPaysLabel"
                      value={offrampWhoPays}
                      onChange={e => setOfframpWhoPays(e.target.value)}
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-6 py-4 text-white text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all backdrop-blur-sm appearance-none cursor-pointer"
                    >
                      <option value="DAO" className="bg-gray-800 text-white">DAO Treasury</option>
                      <option value="User" className="bg-gray-800 text-white">End User</option>
                    </select>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4">
                    <button
                      onClick={handleSave}
                      disabled={isLoading || !canEdit}
                      className={`w-full py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg ${
                        isLoading || !canEdit
                          ? 'bg-gray-600 cursor-not-allowed'
                          : saveSuccess
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:shadow-xl hover:scale-105'
                      } text-white`}
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Saving Settings...</span>
                        </>
                      ) : saveSuccess ? (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          <span>Settings Saved!</span>
                        </>
                      ) : !canEdit ? (
                        <>
                          <span>Read-only (admins only)</span>
                        </>
                      ) : (
                        <>
                          <Settings className="w-5 h-5" />
                          <span>Save Configuration</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Card */}
          <div className="mt-8 p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20">
            <h3 className="text-lg font-semibold text-white mb-4">Current Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{disbursementFee}%</div>
                <div className="text-gray-300">Disbursement Fee</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{withdrawalFee}%</div>
                <div className="text-gray-300">Withdrawal Fee</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{offrampWhoPays}</div>
                <div className="text-gray-300">Fee Payer</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}