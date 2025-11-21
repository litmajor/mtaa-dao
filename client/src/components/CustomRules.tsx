import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  ruleType: string;
  enabled: boolean;
  priority: number;
  conditions: any[];
  actions: any[];
  createdAt: string;
}

interface CustomRulesProps {
  daoId: string;
  isAdmin: boolean;
}

const RULE_TEMPLATES = [
  {
    id: 'entry-max-members',
    name: 'Limit DAO Members',
    type: 'entry',
    description: 'Restrict DAO to maximum number of members'
  },
  {
    id: 'entry-kyc',
    name: 'KYC Required',
    type: 'entry',
    description: 'Require KYC verification for new members'
  },
  {
    id: 'withdrawal-frequency',
    name: 'Withdrawal Frequency Limit',
    type: 'withdrawal',
    description: 'Limit member withdrawals to N times per period'
  },
  {
    id: 'withdrawal-max-amount',
    name: 'Maximum Withdrawal Amount',
    type: 'withdrawal',
    description: 'Set maximum withdrawal amount per transaction'
  },
  {
    id: 'rotation-equal-distribution',
    name: 'Equal Distribution',
    type: 'rotation',
    description: 'Ensure equal amount distribution in rotation'
  },
  {
    id: 'rotation-priority-members',
    name: 'Priority Member Order',
    type: 'rotation',
    description: 'Define priority order for rotation recipients'
  },
  {
    id: 'financial-audit-threshold',
    name: 'Transaction Audit',
    type: 'financial',
    description: 'Audit transactions over specified amount'
  },
  {
    id: 'governance-voting-quorum',
    name: 'Voting Quorum',
    type: 'governance',
    description: 'Require minimum quorum for proposals'
  }
];

export function CustomRules({ daoId, isAdmin }: CustomRulesProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState('entry');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchRules();
    }
  }, [daoId, isAdmin]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dao/${daoId}/rules`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch rules');

      const data = await response.json();
      setRules(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (template?: any) => {
    try {
      const response = await fetch(`/api/dao/${daoId}/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newRuleName || template?.name,
          ruleType: newRuleType || template?.type,
          conditions: template?.conditions || [],
          actions: template?.actions || []
        })
      });

      if (!response.ok) throw new Error('Failed to create rule');

      const newRule = await response.json();
      setRules([...rules, newRule]);
      setNewRuleName('');
      setShowBuilder(false);
      setSelectedTemplate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/dao/${daoId}/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to delete rule');

      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/dao/${daoId}/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ enabled: !enabled })
      });

      if (!response.ok) throw new Error('Failed to update rule');

      setRules(
        rules.map(r =>
          r.id === ruleId ? { ...r, enabled: !enabled } : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    }
  };

  const getRuleTypeBadgeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      entry: 'bg-blue-600',
      withdrawal: 'bg-orange-600',
      rotation: 'bg-green-600',
      financial: 'bg-purple-600',
      governance: 'bg-teal-600'
    };
    return colors[type] || 'bg-gray-600';
  };

  if (!isAdmin) {
    return (
      <div className="text-center p-8 text-gray-500">
        Only DAO admins can manage rules
      </div>
    );
  }

  const enabledRules = rules.filter(r => r.enabled);
  const disabledRules = rules.filter(r => !r.enabled);

  return (
    <div className="space-y-6">
      {/* Create Rule Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Custom Rules
            </CardTitle>
            <Button
              onClick={() => setShowBuilder(!showBuilder)}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Rule
            </Button>
          </div>
        </CardHeader>

        {showBuilder && (
          <CardContent className="space-y-4 border-t pt-4">
            {/* Quick Templates */}
            <div>
              <p className="text-sm font-semibold mb-3">Or Use a Template:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {RULE_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setNewRuleName(template.name);
                      setNewRuleType(template.type);
                    }}
                    className={`p-3 text-left rounded-lg border-2 transition ${
                      selectedTemplate === template.id
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/20'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold text-sm">{template.name}</p>
                    <p className="text-xs text-gray-500">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Rule Form */}
            <div>
              <p className="text-sm font-semibold mb-3">Or Create Custom:</p>
              <div className="space-y-3">
                <Input
                  placeholder="Rule name"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                />
                <select
                  title="Rule Type"
                  aria-label="Rule Type"
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="entry">Entry Rule</option>
                  <option value="withdrawal">Withdrawal Rule</option>
                  <option value="rotation">Rotation Rule</option>
                  <option value="financial">Financial Rule</option>
                  <option value="governance">Governance Rule</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleCreateRule()}
                className="flex-1"
                disabled={!newRuleName}
              >
                Create Rule
              </Button>
              <Button
                onClick={() => {
                  setShowBuilder(false);
                  setNewRuleName('');
                  setSelectedTemplate(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Rules List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full"></div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">
              Active ({enabledRules.length})
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inactive ({disabledRules.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-2">
            {enabledRules.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  No active rules
                </CardContent>
              </Card>
            ) : (
              enabledRules.map(rule => (
                <Card key={rule.id} className="hover:shadow-md transition">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Shield className="w-5 h-5 text-teal-600" />
                        <div>
                          <p className="font-semibold">{rule.name}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge className={`${getRuleTypeBadgeColor(rule.ruleType)} text-white text-xs`}>
                              {rule.ruleType}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Priority: {rule.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleRule(rule.id, rule.enabled)}
                          className="text-green-600"
                        >
                          <ToggleRight className="w-5 h-5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="inactive" className="space-y-2">
            {disabledRules.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  No inactive rules
                </CardContent>
              </Card>
            ) : (
              disabledRules.map(rule => (
                <Card key={rule.id} className="opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Shield className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-semibold text-gray-600">{rule.name}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {rule.ruleType}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleRule(rule.id, rule.enabled)}
                          className="text-gray-400"
                        >
                          <ToggleLeft className="w-5 h-5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-red-600 text-sm p-3 bg-red-50 dark:bg-red-950/20 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

export default CustomRules;
