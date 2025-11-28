import React, { useState } from 'react';

interface RuleCardProps {
  rule: {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    rule_config: any;
    created_at: string;
  };
  daoId: string;
  onRefresh: () => void;
}

export default function RuleCard({ rule, daoId, onRefresh }: RuleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/daos/${daoId}/rules/${rule.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onRefresh();
      } else {
        alert('Failed to delete rule');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Error deleting rule');
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/daos/${daoId}/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled })
      });

      if (response.ok) {
        onRefresh();
      } else {
        alert('Failed to toggle rule');
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
      alert('Error toggling rule');
    } finally {
      setLoading(false);
    }
  };

  const config = typeof rule.rule_config === 'string' 
    ? JSON.parse(rule.rule_config) 
    : rule.rule_config;

  return (
    <div className="bg-white rounded-lg shadow-md border-l-4 border-blue-600 overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
          </div>
          <div className="flex gap-2 ml-4">
            <button
              onClick={toggleEnabled}
              disabled={loading}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                rule.enabled
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              } disabled:opacity-50 flex items-center gap-1`}
            >
              {rule.enabled ? '✓' : '○'}
              {rule.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-700 bg-gray-50 p-4 rounded mb-4">
              <h4 className="font-semibold mb-2">Rule Configuration</h4>
              <pre className="whitespace-pre-wrap text-xs font-mono overflow-auto max-h-64">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>

            {config.conditions && (
              <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Conditions ({config.conditions.length})</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  {config.conditions.map((cond: any, idx: number) => (
                    <li key={idx}>
                      {cond.field} {cond.operator} {JSON.stringify(cond.value)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {config.actions && (
              <div className="mb-4 p-3 bg-green-50 rounded border border-green-200">
                <h4 className="text-sm font-semibold text-green-900 mb-2">Actions ({config.actions.length})</h4>
                <ul className="text-xs text-green-800 space-y-1">
                  {config.actions.map((action: any, idx: number) => (
                    <li key={idx}>
                      {action.type}: {JSON.stringify(action.payload)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <button
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                ✎ Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          {expanded ? (
            <>
              ▼ Collapse
            </>
          ) : (
            <>
              ▶ Expand
            </>
          )}
        </button>
      </div>
    </div>
  );
}
