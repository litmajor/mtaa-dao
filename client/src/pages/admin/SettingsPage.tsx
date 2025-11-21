import React, { useEffect, useState } from 'react';
import { useAdminSettings } from '../../hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, CheckCircle, Save, RotateCcw } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';

export function SettingsPage() {
  const { settings, loading, error, fetchSettings, updateSettings } = useAdminSettings();
  const [formData, setFormData] = useState<any>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings && !formData) {
      setFormData(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings, formData]);

  const handleChange = (section: string, key: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
    setIsDirty(true);
    setSaveSuccess(false);
  };

  const handleReset = () => {
    setFormData(JSON.parse(JSON.stringify(settings)));
    setIsDirty(false);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(formData);
      setSaveSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage platform configuration and feature flags
          </p>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage platform configuration and feature flags
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!isDirty}
            className="px-4 py-2 border border-input rounded-lg hover:bg-muted disabled:opacity-50 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 bg-green-500/10 border border-green-500 rounded-lg text-green-700 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {formData && (
        <>
          {/* Platform Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
              <CardDescription>General platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Platform Name</label>
                  <input
                    type="text"
                    aria-label="Platform Name"
                    value={formData.platformSettings?.platform || ''}
                    onChange={(e) =>
                      handleChange('platformSettings', 'platform', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Version</label>
                  <input
                    type="text"
                    aria-label="Platform Version"
                    value={formData.platformSettings?.version || ''}
                    onChange={(e) =>
                      handleChange('platformSettings', 'version', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Environment</label>
                  <select
                    aria-label="Platform Environment"
                    value={formData.platformSettings?.environment || ''}
                    onChange={(e) =>
                      handleChange('platformSettings', 'environment', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.platformSettings?.maintenanceMode || false}
                      onChange={(e) =>
                        handleChange('platformSettings', 'maintenanceMode', e.target.checked)
                      }
                      className="rounded"
                    />
                    Maintenance Mode
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Blockchain Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Blockchain Settings</CardTitle>
              <CardDescription>RPC and chain configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">RPC URL</label>
                <input
                  type="text"
                  aria-label="Blockchain RPC URL"
                  value={formData.blockchainSettings?.rpcUrl || ''}
                  onChange={(e) =>
                    handleChange('blockchainSettings', 'rpcUrl', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Chain ID</label>
                  <input
                    type="number"
                    aria-label="Blockchain Chain ID"
                    value={formData.blockchainSettings?.chainId || ''}
                    onChange={(e) =>
                      handleChange('blockchainSettings', 'chainId', parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Confirmation Blocks</label>
                  <input
                    type="number"
                    aria-label="Blockchain Confirmation Blocks"
                    value={formData.blockchainSettings?.confirmationBlocks || ''}
                    onChange={(e) =>
                      handleChange('blockchainSettings', 'confirmationBlocks', parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
              <CardDescription>Configure API and transaction limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Requests Per Minute</label>
                  <input
                    type="number"
                    aria-label="Rate Limit Requests Per Minute"
                    value={formData.rateLimits?.requestsPerMinute || ''}
                    onChange={(e) =>
                      handleChange('rateLimits', 'requestsPerMinute', parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Max Transaction Size (bytes)</label>
                  <input
                    type="number"
                    aria-label="Rate Limit Max Transaction Size"
                    value={formData.rateLimits?.maxTransactionSize || ''}
                    onChange={(e) =>
                      handleChange('rateLimits', 'maxTransactionSize', parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Daily Withdrawal Limit ($)</label>
                  <input
                    type="number"
                    aria-label="Rate Limit Daily Withdrawal"
                    value={formData.rateLimits?.dailyWithdrawalLimit || ''}
                    onChange={(e) =>
                      handleChange('rateLimits', 'dailyWithdrawalLimit', parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg mt-1 bg-background"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Flags */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>Enable or disable features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featureFlags?.betaFeatures || false}
                    onChange={(e) =>
                      handleChange('featureFlags', 'betaFeatures', e.target.checked)
                    }
                    className="rounded"
                  />
                  <div>
                    <p className="font-medium">Beta Features</p>
                    <p className="text-sm text-muted-foreground">
                      Allow beta testers to access experimental features
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featureFlags?.newUI || false}
                    onChange={(e) =>
                      handleChange('featureFlags', 'newUI', e.target.checked)
                    }
                    className="rounded"
                  />
                  <div>
                    <p className="font-medium">New UI</p>
                    <p className="text-sm text-muted-foreground">
                      Enable the new user interface
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featureFlags?.advancedAnalytics || false}
                    onChange={(e) =>
                      handleChange('featureFlags', 'advancedAnalytics', e.target.checked)
                    }
                    className="rounded"
                  />
                  <div>
                    <p className="font-medium">Advanced Analytics</p>
                    <p className="text-sm text-muted-foreground">
                      Enable advanced analytics dashboard
                    </p>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default SettingsPage;
