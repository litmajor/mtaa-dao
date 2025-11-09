import React, { useState } from "react";
import { Settings, Shield, Zap, Coins, Save, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShortTermDaoExtension } from '@/components/ShortTermDaoExtension';

export default function DaoSettings({ daoName = "Your DAO" }) {
  // Platform-set constants
  const disbursementFee = 2;
  const withdrawalFee = 3;
  const [offrampWhoPays, setOfframpWhoPays] = useState("DAO");
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dummy DAO data for demonstration - replace with actual data fetching
  const daoId = "dummy-dao-id";
  const dao = {
    daoType: "short_term", // or "collective"
    plan: "initial", // or "extended_1", "extended_2"
    extensionCount: 1,
    planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Expires in 30 days
    originalDuration: 30, // Original duration in days
  };

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setSaveSuccess(false);
    // Only save offrampWhoPays, fees are platform constants
    setTimeout(() => {
      console.log("Saving settings:", {
        offrampWhoPays
      });
      setIsLoading(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 1500);
  }

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

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          <div className="space-y-6">
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
                        <Coins className="w-6 h-6 text-white" />
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
                      disabled={isLoading}
                      className={`w-full py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg ${
                        isLoading
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
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
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