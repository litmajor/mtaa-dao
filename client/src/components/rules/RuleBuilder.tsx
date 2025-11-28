import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface RuleBuilderProps {
  daoId: string;
  onCreated: () => void;
  onCancel: () => void;
  templateId?: string;
}

interface Condition {
  field: string;
  operator: 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
}

interface Action {
  type: 'approve' | 'reject' | 'notify' | 'apply_penalty' | 'trigger_vote';
  payload: Record<string, any>;
}

export default function RuleBuilder({ daoId, onCreated, onCancel, templateId }: RuleBuilderProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([
    { field: '', operator: 'equals', value: '' }
  ]);
  const [actions, setActions] = useState<Action[]>([
    { type: 'approve', payload: {} }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [operator, setOperator] = useState<'AND' | 'OR'>('AND');

  const handleAddCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: string, value: any) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  const handleAddAction = () => {
    setActions([...actions, { type: 'approve', payload: {} }]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, field: string, value: any) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };
    setActions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!name.trim()) {
        setError('Rule name is required');
        return;
      }

      if (conditions.some(c => !c.field || c.value === '')) {
        setError('All conditions must be complete');
        return;
      }

      const config = {
        conditions,
        actions,
        operator
      };

      const response = await fetch(`/api/daos/${daoId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          config,
          templateId
        })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to create rule');
        return;
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-blue-600">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create Custom Rule</h2>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-100 rounded transition-colors text-xl font-bold"
          title="Close rule builder"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rule Name and Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rule Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Minimum Contribution"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of this rule"
            />
          </div>
        </div>

        {/* Conditions */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Conditions</h3>
            <div className="flex gap-2">
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as 'AND' | 'OR')}
                className="px-3 py-1 border border-gray-300 rounded text-sm bg-white"
                title="Select condition operator"
              >
                <option value="AND">ALL conditions</option>
                <option value="OR">ANY condition</option>
              </select>
              <button
                type="button"
                onClick={handleAddCondition}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-1"
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {conditions.map((cond, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={cond.field}
                  onChange={(e) => updateCondition(idx, 'field', e.target.value)}
                  placeholder="Field (e.g., amount)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                  title="Select operator"
                >
                  <option value="equals">equals</option>
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                  <option value="gte">&gt;=</option>
                  <option value="lte">&lt;=</option>
                  <option value="in">in</option>
                  <option value="contains">contains</option>
                </select>
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                />
                {conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(idx)}
                    className="p-2 hover:bg-red-100 rounded transition-colors"
                    title="Remove condition"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
            <button
              type="button"
              onClick={handleAddAction}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
            >
              <Plus size={16} /> Add
            </button>
          </div>

          <div className="space-y-3">
            {actions.map((action, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  value={action.type}
                  onChange={(e) => updateAction(idx, 'type', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                  title="Action type"
                >
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="notify">Notify</option>
                  <option value="apply_penalty">Apply Penalty</option>
                  <option value="trigger_vote">Trigger Vote</option>
                </select>
                <input
                  type="text"
                  value={JSON.stringify(action.payload)}
                  onChange={(e) => {
                    try {
                      updateAction(idx, 'payload', JSON.parse(e.target.value));
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder='{"reason": "value"}'
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                />
                {actions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAction(idx)}
                    className="p-2 hover:bg-red-100 rounded transition-colors"
                    title="Remove action"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Rule'}
          </button>
        </div>
      </form>
    </div>
  );
}
