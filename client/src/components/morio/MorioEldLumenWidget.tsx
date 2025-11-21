import React, { useState, useEffect } from 'react';
import { useAuth } from '@/pages/hooks/useAuth';
import { AlertCircle, CheckCircle, Shield, TrendingUp, ArrowRight, Plus } from 'lucide-react';

interface EthicsQuickStatus {
  recentReviewCount: number;
  averageConcernLevel: string;
  lastReviewTime: string;
  pendingReviews: number;
  dashboardUrl: string;
}

/**
 * Morio ELD-LUMEN Widget
 * 
 * Easy-access ethics panel for Morio main dashboard
 * - Superusers: Quick access to ethics dashboard with stats
 * - DAO Members: One-click ethical review submission
 * - Visual concern level indicators
 * - Quick action buttons
 */
export default function MorioEldLumenWidget() {
  const { user, token } = useAuth();
  const [quickStatus, setQuickStatus] = useState<EthicsQuickStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      setLoading(false);
      return;
    }

    // Only fetch if user has access to lumen data
    if (user.role === 'superuser') {
      fetchQuickStatus();
    } else {
      setLoading(false);
    }
  }, [user, token]);

  const fetchQuickStatus = async () => {
    try {
      const res = await fetch('/api/elders/lumen/statistics?days=7', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setQuickStatus({
          recentReviewCount: data.totalReviewed || 0,
          averageConcernLevel: data.concernDistribution?.green > data.concernDistribution?.red ? 'low' : 'high',
          lastReviewTime: 'Recently',
          pendingReviews: 0,
          dashboardUrl: '/dashboard/ethics'
        });
      }
    } catch (err) {
      console.error('Failed to fetch ethics status:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !token) {
    return null; // Don't show widget if not authenticated
  }

  // Superuser View - Full Stats
  if (user.role === 'superuser') {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 hover:border-blue-600/50 transition-colors">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/30 border border-blue-700/50 rounded-lg">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">ELD-LUMEN</h3>
              <p className="text-xs text-gray-400">Ethics Guardian</p>
            </div>
          </div>
          <TrendingUp className="w-4 h-4 text-green-400" />
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-2 bg-slate-700 rounded animate-pulse w-3/4"></div>
            <div className="h-2 bg-slate-700 rounded animate-pulse w-1/2"></div>
          </div>
        ) : quickStatus ? (
          <div className="space-y-3">
            {/* Weekly Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-700/50 rounded p-2">
                <p className="text-xs text-gray-400">Reviews (7d)</p>
                <p className="text-lg font-bold text-blue-300">{quickStatus.recentReviewCount}</p>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <p className="text-xs text-gray-400">Avg Level</p>
                <p className="text-lg font-bold text-green-300 capitalize">{quickStatus.averageConcernLevel}</p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/30 rounded px-3 py-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-200">Ethics Framework Active</span>
            </div>
          </div>
        ) : null}

        {/* Quick Actions */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-700">
          <button
            onClick={() => window.location.href = '/dashboard/ethics'}
            className="flex-1 text-xs font-semibold bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/50 text-blue-200 px-2 py-1.5 rounded transition-colors flex items-center justify-center gap-1"
          >
            Full Dashboard <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // DAO Member View - Easy Review Request
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 hover:border-blue-600/50 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-900/30 border border-blue-700/50 rounded-lg">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">ELD-LUMEN</h3>
            <p className="text-xs text-gray-400">Ethical Reviews</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-4">
        Get ethical guidance on your DAO decisions from ELD-LUMEN, the Ethics Elder.
      </p>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700/30 rounded px-3 py-2 mb-4">
        <p className="text-xs text-blue-200">
          📋 Submit any decision for ethical review and get instant feedback on harm, consent, fairness, and more.
        </p>
      </div>

      {/* Quick Start Button */}
      <button
        onClick={() => setShowReviewModal(true)}
        className="w-full font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors text-sm flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Request Ethical Review
      </button>

      {/* Modal Trigger (opens ethics review form) */}
      {showReviewModal && (
        <MorioEthicsReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </div>
  );
}

/**
 * Quick Ethics Review Modal for Morio
 * Minimal, focused form for DAO members to request reviews
 */
function MorioEthicsReviewModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user, token } = useAuth();
  const [formData, setFormData] = useState({
    decisionType: '',
    description: '',
    riskLevel: 'medium' as 'low' | 'medium' | 'high'
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const QUICK_DECISION_TYPES = [
    'Treasury Movement',
    'Policy Change',
    'Member Action',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.decisionType || !formData.description) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/elders/lumen/review', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requesterId: user?.id,
          daoId: user?.daoId,
          ...formData,
          context: formData.description
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit review request');
      }

      const data = await response.json();
      setResult(data.reviewResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Result View
  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            {result.outcome === 'approved' ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-400" />
            )}
            <div>
              <h2 className="font-bold text-white">Review Complete</h2>
              <p className="text-xs text-gray-400">{result.decisionId}</p>
            </div>
          </div>

          {/* Concern Level */}
          <div className="bg-slate-700/50 rounded p-4 mb-4">
            <p className="text-xs text-gray-400 mb-2">Concern Level</p>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded flex items-center justify-center font-bold ${
                result.concernLevel === 'green' ? 'bg-green-900/30 text-green-400' :
                result.concernLevel === 'yellow' ? 'bg-yellow-900/30 text-yellow-400' :
                'bg-red-900/30 text-red-400'
              }`}>
                {result.concernLevel.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-white capitalize">{result.concernLevel}</p>
                <p className="text-xs text-gray-400">{result.outcome.toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Quick Reasoning */}
          <div className="bg-slate-700/30 rounded p-3 mb-4">
            <p className="text-sm text-gray-300 line-clamp-3">{result.reasoning}</p>
          </div>

          {/* Principles Affected */}
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Principles Evaluated</p>
            <div className="flex flex-wrap gap-1">
              {result.principlesAffected?.slice(0, 3).map((p: string, i: number) => (
                <span key={i} className="text-xs bg-blue-900/30 text-blue-200 px-2 py-0.5 rounded">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Confidence */}
          <div className="bg-slate-700/30 rounded px-3 py-2 mb-4 text-center">
            <p className="text-xs text-gray-400">Confidence Score</p>
            <p className="text-lg font-bold text-blue-300">{(result.confidenceScore * 100).toFixed(0)}%</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
            >
              Close
            </button>
            <button
              onClick={() => {
                window.location.href = `/ethics/review/${result.decisionId}`;
              }}
              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
            >
              Full Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form View
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-white">Ethical Review</h2>
            <p className="text-xs text-gray-400">Get guidance from ELD-LUMEN</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700/30 rounded p-3 mb-4 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Decision Type */}
          <div>
            <label htmlFor="decision-type-quick" className="block text-xs font-semibold text-white mb-2">
              What are you deciding? *
            </label>
            <select
              id="decision-type-quick"
              value={formData.decisionType}
              onChange={(e) => setFormData({ ...formData, decisionType: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Select type...</option>
              {QUICK_DECISION_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Quick Description */}
          <div>
            <label className="block text-xs font-semibold text-white mb-2">
              Describe your decision *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What exactly are you planning to do?"
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
              required
            />
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-xs font-semibold text-white mb-2">
              Risk Level
            </label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({ ...formData, riskLevel: level })}
                  className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded transition-colors capitalize ${
                    formData.riskLevel === level
                      ? level === 'low' ? 'bg-green-600 text-white' :
                        level === 'medium' ? 'bg-yellow-600 text-white' :
                        'bg-red-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded p-2">
            <p className="text-xs text-blue-200">
              🤖 ELD-LUMEN will evaluate your decision instantly and provide ethical guidance.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full font-semibold py-2 px-3 rounded transition-colors text-sm ${
              loading
                ? 'bg-slate-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? 'Analyzing...' : 'Get Ethical Review'}
          </button>
        </form>
      </div>
    </div>
  );
}
