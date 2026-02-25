/**
 * Feature Management Dashboard
 * Admin interface for feature tracking, A/B testing, and beta access management
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Settings, TrendingUp, Users, Calendar } from 'lucide-react';

interface Feature {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  usageCount: number;
  lastUsed?: string;
}

interface FeatureAnalytics {
  featureKey: string;
  totalUsage: number;
  uniqueUsers: number;
  usageByDay?: Record<string, number>;
  averageUsagePerUser: number;
  lastAccessed?: string;
}

interface BetaUser {
  userId: string;
  featureKey: string;
  grantedAt: string;
  expiresAt?: string;
  status: 'active' | 'expired';
}

export const FeatureManagementDashboard: React.FC = () => {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, FeatureAnalytics>>({});
  const [betaUsers, setBetaUsers] = useState<BetaUser[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [showBetaForm, setShowBetaForm] = useState(false);
  const [rolloutPercentage, setRolloutPercentage] = useState(0);
  const [betaUserId, setBetaUserId] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch all features
  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const response = await fetch('/api/features/user/accessible', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setFeatures(data.features || []);
        }
      } catch (error) {
        console.error('Failed to load features:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFeatures();
  }, []);

  // Load feature analytics
  const loadFeatureAnalytics = async (featureKey: string) => {
    try {
      const response = await fetch(`/api/features/analytics/${featureKey}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics((prev) => ({
          ...prev,
          [featureKey]: data.analytics,
        }));
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  // Set feature rollout percentage
  const handleSetRollout = async (featureKey: string, percentage: number) => {
    try {
      const response = await fetch('/api/features/rollout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          featureKey,
          percentage,
        }),
      });

      if (response.ok) {
        setRolloutPercentage(percentage);
        alert(`Rollout set to ${percentage}%`);
      } else {
        alert('Failed to set rollout percentage');
      }
    } catch (error) {
      console.error('Failed to set rollout:', error);
      alert('Error setting rollout');
    }
  };

  // Grant beta access
  const handleGrantBeta = async () => {
    if (!selectedFeature || !betaUserId) {
      alert('Please select feature and enter user ID');
      return;
    }

    try {
      const response = await fetch('/api/features/beta/grant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: betaUserId,
          featureKey: selectedFeature,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        }),
      });

      if (response.ok) {
        alert('Beta access granted');
        setBetaUserId('');
        setShowBetaForm(false);
      } else {
        alert('Failed to grant beta access');
      }
    } catch (error) {
      console.error('Failed to grant beta:', error);
      alert('Error granting beta access');
    }
  };

  // Revoke beta access
  const handleRevokeBeta = async (userId: string, featureKey: string) => {
    if (!window.confirm('Revoke beta access?')) return;

    try {
      const response = await fetch('/api/features/beta/revoke', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId,
          featureKey,
        }),
      });

      if (response.ok) {
        alert('Beta access revoked');
        setBetaUsers((prev) => prev.filter((b) => !(b.userId === userId && b.featureKey === featureKey)));
      } else {
        alert('Failed to revoke beta access');
      }
    } catch (error) {
      console.error('Failed to revoke beta:', error);
      alert('Error revoking beta access');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading features...</div>
      </div>
    );
  }

  const selectedFeatureData = features.find((f) => f.key === selectedFeature);
  const selectedAnalytics = selectedFeature ? analytics[selectedFeature] : null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Feature Management</h1>
          <p className="text-gray-600">Track, analyze, and control feature rollouts</p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Features List */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Settings className="mr-2" size={20} />
                Features
              </h2>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {features.map((feature) => (
                  <button
                    key={feature.key}
                    onClick={() => {
                      setSelectedFeature(feature.key);
                      loadFeatureAnalytics(feature.key);
                    }}
                    className={`w-full text-left p-3 rounded transition ${
                      selectedFeature === feature.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-medium">{feature.name}</div>
                    <div className="text-sm opacity-75">
                      {feature.enabled ? 'Enabled' : 'Disabled'} • {feature.usageCount} uses
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feature Details */}
          <div className="col-span-2">
            {selectedFeatureData ? (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-2xl font-semibold mb-2">{selectedFeatureData.name}</h3>
                  <p className="text-gray-600 mb-6">{selectedFeatureData.description}</p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded">
                      <div className="text-sm text-gray-600">Status</div>
                      <div className="text-lg font-semibold">
                        {selectedFeatureData.enabled ? '✓ Enabled' : '✗ Disabled'}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded">
                      <div className="text-sm text-gray-600">Total Usage</div>
                      <div className="text-lg font-semibold">{selectedFeatureData.usageCount}</div>
                    </div>
                  </div>
                </div>

                {/* A/B Testing */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <TrendingUp className="mr-2" size={20} />
                    A/B Testing
                  </h3>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                      Rollout Percentage: {rolloutPercentage}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={rolloutPercentage}
                      onChange={(e) => setRolloutPercentage(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <button
                    onClick={() => handleSetRollout(selectedFeature!, rolloutPercentage)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition"
                  >
                    Apply Rollout
                  </button>
                </div>

                {/* Analytics */}
                {selectedAnalytics && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <TrendingUp className="mr-2" size={20} />
                      Analytics
                    </h3>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded">
                        <div className="text-sm text-gray-600">Total Usage</div>
                        <div className="text-2xl font-bold">{selectedAnalytics.totalUsage}</div>
                      </div>

                      <div className="bg-green-50 p-4 rounded">
                        <div className="text-sm text-gray-600">Unique Users</div>
                        <div className="text-2xl font-bold">{selectedAnalytics.uniqueUsers}</div>
                      </div>

                      <div className="bg-purple-50 p-4 rounded">
                        <div className="text-sm text-gray-600">Avg per User</div>
                        <div className="text-2xl font-bold">{selectedAnalytics.averageUsagePerUser.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Beta Access */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Users className="mr-2" size={20} />
                    Beta Access
                  </h3>

                  {!showBetaForm ? (
                    <button
                      onClick={() => setShowBetaForm(true)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition flex items-center"
                    >
                      <Plus size={18} className="mr-2" />
                      Grant Beta Access
                    </button>
                  ) : (
                    <div className="space-y-4 mb-4">
                      <input
                        type="text"
                        placeholder="User ID"
                        value={betaUserId}
                        onChange={(e) => setBetaUserId(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={handleGrantBeta}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition"
                        >
                          Grant Access
                        </button>

                        <button
                          onClick={() => setShowBetaForm(false)}
                          className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active Beta Users */}
                  {betaUsers.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium mb-3">Active Beta Users</h4>
                      <div className="space-y-2">
                        {betaUsers
                          .filter((b) => b.featureKey === selectedFeature)
                          .map((beta) => (
                            <div key={`${beta.userId}-${beta.featureKey}`} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{beta.userId}</div>
                                {beta.expiresAt && (
                                  <div className="text-xs text-gray-600 flex items-center mt-1">
                                    <Calendar size={12} className="mr-1" />
                                    Expires: {new Date(beta.expiresAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => handleRevokeBeta(beta.userId, beta.featureKey)}
                                className="ml-2 p-2 text-red-500 hover:bg-red-50 rounded transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">Select a feature to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureManagementDashboard;
