import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle, CheckCircle, Clock, Send, Shield } from 'lucide-react';

interface ReviewRequest {
  decisionType: string;
  description: string;
  affectedMembers: string[];
  treasuryAmount?: string;
  riskLevel: 'low' | 'medium' | 'high';
  context: string;
}

interface ReviewResult {
  decisionId: string;
  concernLevel: 'green' | 'yellow' | 'orange' | 'red';
  outcome: 'approved' | 'rejected' | 'conditional';
  principlesAffected: string[];
  confidenceScore: number;
  reasoning: string;
  recommendations?: string[];
}

const DECISION_TYPES = [
  'Treasury Movement',
  'Governance Change',
  'Member Removal',
  'Policy Change',
  'System Modification',
  'Data Access',
  'Emergency Action',
  'Resource Allocation'
];

/**
 * Ethical Review Request Component
 * Allows DAO members to submit decisions for ethical review by ELD-LUMEN
 * 
 * Features:
 * - Submit decisions for ethical evaluation
 * - View review results with concern levels
 * - Understand ethical reasoning and recommendations
 * - Track review history
 */
export default function EthicalReviewRequest() {
  const { user, token } = useAuth();
  const [formData, setFormData] = useState<ReviewRequest>({
    decisionType: '',
    description: '',
    affectedMembers: [],
    riskLevel: 'medium',
    context: ''
  });
  const [memberInput, setMemberInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!user || !token) {
    return (
      <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-6">
        <div className="flex gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-red-100">Authentication Required</h3>
            <p className="text-red-200 text-sm mt-1">
              You must be logged in as a DAO member to request ethical reviews.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleAddMember = () => {
    if (memberInput.trim() && !formData.affectedMembers.includes(memberInput.trim())) {
      setFormData({
        ...formData,
        affectedMembers: [...formData.affectedMembers, memberInput.trim()]
      });
      setMemberInput('');
    }
  };

  const handleRemoveMember = (member: string) => {
    setFormData({
      ...formData,
      affectedMembers: formData.affectedMembers.filter(m => m !== member)
    });
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.decisionType || !formData.description || !formData.context) {
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
          requesterId: user.id,
          requesterRole: user.role,
          daoId: user.daoId,
          ...formData
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to request ethical review');
      }

      const reviewData = await response.json();
      setResult(reviewData.reviewResult);
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Show results view after submission
  if (submitted && result) {
    return (
      <div className="space-y-6">
        {/* Success Message */}
        <div className={`border rounded-lg p-6 ${
          result.outcome === 'approved'
            ? 'bg-green-900/20 border-green-700/30'
            : result.outcome === 'rejected'
            ? 'bg-red-900/20 border-red-700/30'
            : 'bg-yellow-900/20 border-yellow-700/30'
        }`}>
          <div className="flex gap-4">
            {result.outcome === 'approved' ? (
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
            ) : result.outcome === 'rejected' ? (
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            ) : (
              <Clock className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            )}
            <div>
              <h3 className={`font-bold ${
                result.outcome === 'approved' ? 'text-green-100' :
                result.outcome === 'rejected' ? 'text-red-100' :
                'text-yellow-100'
              }`}>
                Ethical Review: {result.outcome.toUpperCase()}
              </h3>
              <p className={`text-sm mt-1 ${
                result.outcome === 'approved' ? 'text-green-200' :
                result.outcome === 'rejected' ? 'text-red-200' :
                'text-yellow-200'
              }`}>
                Review ID: {result.decisionId}
              </p>
            </div>
          </div>
        </div>

        {/* Concern Level */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="font-bold text-white mb-4">Concern Level Assessment</h3>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
              result.concernLevel === 'green' ? 'bg-green-900/30 border-2 border-green-500 text-green-400' :
              result.concernLevel === 'yellow' ? 'bg-yellow-900/30 border-2 border-yellow-500 text-yellow-400' :
              result.concernLevel === 'orange' ? 'bg-orange-900/30 border-2 border-orange-500 text-orange-400' :
              'bg-red-900/30 border-2 border-red-500 text-red-400'
            }`}>
              {result.concernLevel.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-gray-400 text-sm">Concern Level</p>
              <p className="text-2xl font-bold text-white capitalize">{result.concernLevel}</p>
              <p className="text-gray-500 text-xs mt-1">
                Confidence: {(result.confidenceScore * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Affected Principles */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="font-bold text-white mb-4">Ethical Principles Evaluated</h3>
          <div className="grid grid-cols-2 gap-3">
            {result.principlesAffected.map((principle, idx) => (
              <div
                key={idx}
                className="bg-blue-900/20 border border-blue-700/30 rounded p-3 text-sm text-blue-200"
              >
                ✓ {principle}
              </div>
            ))}
          </div>
        </div>

        {/* Reasoning */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="font-bold text-white mb-3">ELD-LUMEN's Reasoning</h3>
          <p className="text-gray-300 text-sm leading-relaxed">{result.reasoning}</p>
        </div>

        {/* Recommendations */}
        {result.recommendations && result.recommendations.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="font-bold text-white mb-4">Recommendations</h3>
            <ul className="space-y-2">
              {result.recommendations.map((rec, idx) => (
                <li key={idx} className="flex gap-3 text-gray-300 text-sm">
                  <span className="text-blue-400 font-bold">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSubmitted(false);
              setResult(null);
              setFormData({
                decisionType: '',
                description: '',
                affectedMembers: [],
                riskLevel: 'medium',
                context: ''
              });
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded transition-colors"
          >
            Submit Another Review
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-4 rounded transition-colors"
          >
            Print Review
          </button>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-blue-400" />
        <div>
          <h2 className="text-2xl font-bold text-white">Request Ethical Review</h2>
          <p className="text-gray-400 text-sm mt-1">
            Submit a decision for ELD-LUMEN's ethical evaluation
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmitReview} className="space-y-6 bg-slate-800 border border-slate-700 rounded-lg p-6">
        {/* Decision Type */}
        <div>
          <label htmlFor="decision-type" className="block text-sm font-semibold text-white mb-2">
            Decision Type *
          </label>
          <select
            id="decision-type"
            value={formData.decisionType}
            onChange={(e) => setFormData({ ...formData, decisionType: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            required
          >
            <option value="">Select a decision type...</option>
            {DECISION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-white mb-2">
            Decision Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Provide a clear, concise description of the decision..."
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 min-h-20 resize-none"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.description.length}/500 characters
          </p>
        </div>

        {/* Context & Reasoning */}
        <div>
          <label className="block text-sm font-semibold text-white mb-2">
            Context & Reasoning *
          </label>
          <textarea
            value={formData.context}
            onChange={(e) => setFormData({ ...formData, context: e.target.value })}
            placeholder="Explain the context, background, and reasoning behind this decision..."
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 min-h-24 resize-none"
            required
          />
        </div>

        {/* Treasury Amount (Optional) */}
        <div>
          <label className="block text-sm font-semibold text-white mb-2">
            Treasury Amount (Optional)
          </label>
          <input
            type="number"
            value={formData.treasuryAmount || ''}
            onChange={(e) => setFormData({ ...formData, treasuryAmount: e.target.value })}
            placeholder="Amount in MTAA tokens (if applicable)"
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Risk Level */}
        <div>
          <label className="block text-sm font-semibold text-white mb-2">
            Perceived Risk Level *
          </label>
          <div className="flex gap-3">
            {(['low', 'medium', 'high'] as const).map((level) => (
              <label key={level} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="riskLevel"
                  value={level}
                  checked={formData.riskLevel === level}
                  onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value as any })}
                  className="w-4 h-4"
                />
                <span className={`capitalize font-semibold px-3 py-1 rounded text-sm ${
                  formData.riskLevel === level
                    ? level === 'low' ? 'bg-green-900/30 text-green-200' :
                      level === 'medium' ? 'bg-yellow-900/30 text-yellow-200' :
                      'bg-red-900/30 text-red-200'
                    : 'bg-slate-700 text-gray-300'
                }`}>
                  {level}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Affected Members */}
        <div>
          <label className="block text-sm font-semibold text-white mb-2">
            Affected Members (Optional)
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMember())}
              placeholder="Member address or ID..."
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleAddMember}
              className="bg-slate-600 hover:bg-slate-500 text-white font-semibold px-4 py-2 rounded transition-colors"
            >
              Add
            </button>
          </div>
          {formData.affectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.affectedMembers.map((member) => (
                <div
                  key={member}
                  className="bg-blue-900/30 border border-blue-700/30 rounded-full px-3 py-1 text-sm text-blue-200 flex items-center gap-2"
                >
                  {member}
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member)}
                    className="text-blue-400 hover:text-blue-200 font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-700/30 rounded p-4">
          <p className="text-sm text-blue-200">
            <strong>ℹ️ Note:</strong> Your review request will be evaluated by ELD-LUMEN against 8 ethical principles. The assessment will consider harm minimization, autonomy, justice, beneficence, transparency, proportionality, fairness, and accountability.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full font-semibold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 ${
            loading
              ? 'bg-slate-600 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? (
            <>
              <Clock className="w-5 h-5 animate-spin" />
              Processing Review...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit for Ethical Review
            </>
          )}
        </button>
      </form>

      {/* Help Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h3 className="font-bold text-white mb-3">How It Works</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">1.</span>
            <span>Describe your decision and provide context</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">2.</span>
            <span>ELD-LUMEN evaluates the decision against 8 ethical principles</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">3.</span>
            <span>Receive a concern level assessment (Green/Yellow/Orange/Red)</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">4.</span>
            <span>Get detailed reasoning and recommendations</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold">5.</span>
            <span>All reviews are logged in ELD-LUMEN's audit trail</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
