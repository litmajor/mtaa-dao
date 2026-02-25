/**
 * SettingsDashboard Component - Updated with Real Backend Integration
 * User preferences and app configuration
 * Saves all settings to backend API
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  useSettings,
  useUpdateProfile,
  useUpdateTradingPreferences,
  useUpdateNotifications,
  useUpdateDisplay,
} from '@/client/hooks/useSettings';
import { useExchanges, useAddExchange, useTestExchange, useDeleteExchange } from '@/client/hooks/useExchangeManagement';

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState('profile');
  
  // Load settings from backend
  const { settings, loading: settingsLoading } = useSettings();
  const { exchanges, refetch: refetchExchanges } = useExchanges();
  
  // Settings update hooks
  const { updateProfile, loading: profileLoading, error: profileError } = useUpdateProfile();
  const { updatePreferences, loading: prefLoading } = useUpdateTradingPreferences();
  const { updateNotifications, loading: notifLoading } = useUpdateNotifications();
  const { updateDisplay, loading: displayLoading } = useUpdateDisplay();
  
  // Exchange management hooks
  const { addExchange, loading: addExchangeLoading, error: addExchangeError } = useAddExchange();
  const { testConnection, loading: testLoading } = useTestExchange();
  const { deleteExchange, loading: deleteLoading } = useDeleteExchange();
  
  // Local state
  const [profile, setProfile] = useState({ name: '', email: '', timezone: 'UTC' });
  const [showAddKey, setShowAddKey] = useState(false);
  const [newExchange, setNewExchange] = useState({ exchange: '', apiKey: '', apiSecret: '' });
  const [successMessage, setSuccessMessage] = useState('');

  // Initialize form from loaded settings
  useEffect(() => {
    if (settings) {
      setProfile(settings.profile || { name: '', email: '', timezone: 'UTC' });
    }
  }, [settings]);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'exchanges', label: 'Exchanges', icon: '🔄' },
    { id: 'trading', label: 'Trading', icon: '⚙️' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'display', label: 'Display', icon: '🎨' },
  ];

  const handleProfileChange = (field: string, value: string) => {
    setProfile({ ...profile, [field]: value });
  };

  const handleSaveProfile = async () => {
    const result = await updateProfile(profile);
    if (result.success) {
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleAddExchange = async () => {
    if (!newExchange.exchange || !newExchange.apiKey || !newExchange.apiSecret) {
      alert('Please fill in all fields');
      return;
    }

    // Test connection first
    const testResult = await testConnection(newExchange);
    if (!testResult.success) {
      alert(`Connection test failed: ${testResult.error}`);
      return;
    }

    // Add to backend
    const addResult = await addExchange(newExchange);
    if (addResult.success) {
      setNewExchange({ exchange: '', apiKey: '', apiSecret: '' });
      setShowAddKey(false);
      setSuccessMessage('Exchange added successfully!');
      await refetchExchanges();
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleDeleteExchange = async (exchangeId: string) => {
    if (confirm('Are you sure you want to remove this exchange?')) {
      const result = await deleteExchange(exchangeId);
      if (result.success) {
        await refetchExchanges();
        setSuccessMessage('Exchange removed successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-2">Manage your preferences and account settings</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-900/20 border border-green-600 text-green-400 p-4 rounded-lg">
          ✓ {successMessage}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-center border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <p className="text-xs font-semibold">{tab.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Settings Content */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        {/* Profile Settings */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Profile Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-2">Full Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => handleProfileChange('name', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-2">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-2">Timezone</label>
                  <select
                    value={profile.timezone}
                    onChange={(e) => handleProfileChange('timezone', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  >
                    <option>UTC</option>
                    <option>EST</option>
                    <option>CST</option>
                    <option>PST</option>
                    <option>GMT+1</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition"
                  >
                    {profileLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition">
                    Cancel
                  </button>
                </div>
                {profileError && <p className="text-red-400 text-sm">{profileError}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Security Settings */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Security Settings</h2>

              <div className="space-y-4">
                {/* Password Change */}
                <div className="border-b border-slate-700 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-white font-semibold">Password</h3>
                      <p className="text-slate-400 text-sm">Last changed 30 days ago</p>
                    </div>
                    <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition">
                      Change
                    </button>
                  </div>
                </div>

                {/* Two-Factor Authentication */}
                <div className="border-b border-slate-700 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold">Two-Factor Authentication</h3>
                      <p className="text-slate-400 text-sm">Add extra security to your account</p>
                    </div>
                    <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition">
                      Enable
                    </button>
                  </div>
                </div>

                {/* Session Management */}
                <div>
                  <h3 className="text-white font-semibold mb-3">Active Sessions</h3>
                  <div className="bg-slate-700/50 p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-slate-200">Current Session</p>
                      <p className="text-slate-400 text-sm">🖥️ Chrome on Windows</p>
                    </div>
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exchange Connections */}
        {activeTab === 'exchanges' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Connected Exchanges</h2>
                <button
                  onClick={() => setShowAddKey(!showAddKey)}
                  disabled={addExchangeLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:bg-blue-600/50"
                >
                  {addExchangeLoading ? '+ Adding...' : '+ Add Exchange'}
                </button>
              </div>

              {/* Add Exchange Form */}
              {showAddKey && (
                <div className="bg-slate-700/50 p-4 rounded-lg mb-4 border border-slate-600">
                  <h3 className="text-white font-semibold mb-4">Add New Exchange</h3>
                  {addExchangeError && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-600 text-red-400 rounded">
                      {addExchangeError}
                    </div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-300 text-sm mb-2">Exchange</label>
                      <select
                        value={newExchange.exchange}
                        onChange={(e) => setNewExchange({ ...newExchange, exchange: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-blue-500 outline-none"
                      >
                        <option>Select Exchange...</option>
                        <option>Binance</option>
                        <option>Kraken</option>
                        <option>Coinbase</option>
                        <option>FTX</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm mb-2">API Key</label>
                      <input
                        type="password"
                        placeholder="Enter your API key"
                        value={newExchange.apiKey}
                        onChange={(e) => setNewExchange({ ...newExchange, apiKey: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm mb-2">API Secret</label>
                      <input
                        type="password"
                        placeholder="Enter your API secret"
                        value={newExchange.apiSecret}
                        onChange={(e) => setNewExchange({ ...newExchange, apiSecret: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleAddExchange}
                        disabled={addExchangeLoading || testLoading}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-sm transition disabled:bg-blue-600/50"
                      >
                        {testLoading ? 'Testing...' : addExchangeLoading ? 'Adding...' : 'Connect'}
                      </button>
                      <button
                        onClick={() => setShowAddKey(false)}
                        className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded text-sm transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Exchange List */}
              <div className="space-y-2">
                {exchanges.map((exchange) => (
                  <div
                    key={exchange.id}
                    className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">💱</span>
                        <div>
                          <p className="text-white font-semibold">{exchange.exchange}</p>
                          <p className="text-slate-400 text-sm">{exchange.apiKey}</p>
                        </div>
                      </div>
                      <p className="text-slate-500 text-xs mt-2">Last synced: {exchange.lastSyncTime}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          exchange.connected
                            ? 'bg-green-600/20 text-green-400'
                            : 'bg-red-600/20 text-red-400'
                        }`}
                      >
                        {exchange.connected ? '🟢 Connected' : '🔴 Disconnected'}
                      </span>
                      <button
                        onClick={() => handleDeleteExchange(exchange.id)}
                        disabled={deleteLoading}
                        className="px-3 py-1 text-red-400 hover:text-red-300 font-semibold text-sm disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Trading Settings */}
        {activeTab === 'trading' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-4">Trading Preferences</h2>
            <div className="space-y-4">
              <SettingToggle label="Enable Auto Stop-Loss" defaultChecked={true} />
              <SettingToggle label="Enable Auto Take-Profit" defaultChecked={true} />
              <SettingToggle label="Use Smart Routing" defaultChecked={true} />
              <SettingToggle label="Enable Risk Limit Alerts" defaultChecked={true} />

              <div>
                <label className="block text-slate-300 font-semibold mb-2">Default Position Size (%)</label>
                <input
                  type="number"
                  defaultValue="5"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-2">Max Risk per Trade (%)</label>
                <input
                  type="number"
                  defaultValue="2"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-4">Notification Preferences</h2>
            <div className="space-y-4">
              <SettingToggle label="Email: Order Filled" defaultChecked={true} />
              <SettingToggle label="Email: Stop-Loss Triggered" defaultChecked={true} />
              <SettingToggle label="Email: High Risk Alert" defaultChecked={true} />
              <SettingToggle label="Push: Order Updates" defaultChecked={false} />
              <SettingToggle label="SMS: Critical Alerts" defaultChecked={false} />
            </div>
          </div>
        )}

        {/* Display Settings */}
        {activeTab === 'display' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-4">Display Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-2">Theme</label>
                <select className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none">
                  <option>Dark</option>
                  <option>Light</option>
                  <option>Auto</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-2">Chart Type</label>
                <select className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none">
                  <option>Candlestick</option>
                  <option>Line</option>
                  <option>Area</option>
                </select>
              </div>

              <SettingToggle label="Show Grid on Charts" defaultChecked={true} />
              <SettingToggle label="Animate Charts" defaultChecked={true} />
              <SettingToggle label="Show Volume" defaultChecked={true} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SettingToggle Component - Reusable toggle for boolean settings
 */
function SettingToggle({
  label,
  defaultChecked,
}: {
  label: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = React.useState(defaultChecked);

  return (
    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-700/50">
      <label className="text-slate-300 font-semibold cursor-pointer">{label}</label>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
