import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Loader } from 'lucide-react';
import RuleCard from '@/components/rules/RuleCard';
import RuleBuilder from '@/components/rules/RuleBuilder';
import TemplatesGallery from '@/components/rules/TemplatesGallery';

export default function RulesDashboard() {
  const { id: daoId } = useParams<{ id: string }>();
  const [rules, setRules] = useState<any[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (daoId) {
      loadRules();
    }
  }, [daoId]);

  const loadRules = async () => {
    if (!daoId) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/daos/${daoId}/rules`);
      if (!response.ok) {
        throw new Error('Failed to load rules');
      }
      const data = await response.json();
      setRules(data.data || data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
      console.error('Error loading rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRuleCreated = () => {
    loadRules();
    setShowBuilder(false);
    setShowTemplates(true);
  };

  if (!daoId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            DAO ID not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Custom Rules Engine</h1>
          <p className="text-gray-600 mt-2">
            Customize how your DAO operates with powerful custom rules
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-8 flex gap-4 flex-wrap">
          <button
            onClick={() => {
              setShowBuilder(true);
              setShowTemplates(false);
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <Plus size={20} /> Create Custom Rule
          </button>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            {showTemplates ? 'Hide' : 'Show'} Templates
          </button>
        </div>

        {/* Templates Gallery */}
        {showTemplates && (
          <div className="mb-12">
            <TemplatesGallery 
              daoId={daoId}
              onSelect={() => {
                setShowBuilder(true);
                setShowTemplates(false);
              }}
            />
          </div>
        )}

        {/* Rule Builder */}
        {showBuilder && (
          <div className="mb-12">
            <RuleBuilder 
              daoId={daoId}
              onCreated={handleRuleCreated}
              onCancel={() => {
                setShowBuilder(false);
                setShowTemplates(true);
              }}
            />
          </div>
        )}

        {/* Existing Rules */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Rules</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <Loader size={32} className="inline animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Loading rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-600 mb-4">No rules created yet</p>
              <button
                onClick={() => {
                  setShowBuilder(true);
                  setShowTemplates(false);
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Create your first rule →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rules.map((rule: any) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  daoId={daoId}
                  onRefresh={loadRules}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {rules.length > 0 && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-gray-600 text-sm font-medium">Total Rules</div>
              <div className="text-4xl font-bold text-gray-900 mt-2">{rules.length}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-gray-600 text-sm font-medium">Enabled Rules</div>
              <div className="text-4xl font-bold text-green-600 mt-2">
                {rules.filter((r: any) => r.enabled).length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-gray-600 text-sm font-medium">Disabled Rules</div>
              <div className="text-4xl font-bold text-gray-400 mt-2">
                {rules.filter((r: any) => !r.enabled).length}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
