import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ConfigEditor from '@/components/admin/ConfigEditor';
import AdminLayout from '@/components/admin/AdminLayout';
import styles from './config.module.css';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  configuration: Record<string, any>;
  lastHeartbeat: string;
  successRate?: number;
}

interface SelectOption {
  label: string;
  value: string;
}

export default function ConfigAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/admin/agents-elders/agents');
        if (!response.ok) throw new Error('Failed to fetch agents');
        const data = await response.json();
        setAgents(data.agents || []);
        
        // Auto-select first agent
        if (data.agents?.length > 0) {
          setSelectedAgentId(data.agents[0].id);
          setSelectedAgent(data.agents[0]);
        }
      } catch (err) {
        console.error('Error fetching agents:', err);
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  // Handle agent selection
  const handleAgentSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const agentId = event.target.value;
    setSelectedAgentId(agentId);
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setSelectedAgent(agent);
    }
  };

  // Handle configuration save
  const handleConfigSave = async (updatedConfig: Record<string, any>) => {
    if (!selectedAgentId) return;

    try {
      const response = await fetch(`/api/admin/agents-elders/config/agents/${selectedAgentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configuration: updatedConfig }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update configuration');
      }

      const data = await response.json();
      
      // Update local state
      setSelectedAgent(data.data);
      setAgents(agents.map(a => 
        a.id === selectedAgentId ? data.data : a
      ));

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration';
      console.error('Error saving configuration:', err);
      return { success: false, error: message };
    }
  };

  const agentOptions: SelectOption[] = agents.map(a => ({
    label: `${a.name} (${a.type})`,
    value: a.id,
  }));

  if (loading) {
    return (
      <AdminLayout title="Agent Configuration">
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading agents...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Agent Configuration">
        <div className={styles.container}>
          <div className={styles.errorBox}>
            <h3>Error Loading Agents</h3>
            <p>{error}</p>
            <button 
              className={styles.retryButton}
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (agents.length === 0) {
    return (
      <AdminLayout title="Agent Configuration">
        <div className={styles.container}>
          <div className={styles.emptyState}>
            <p>No agents found</p>
            <Link href="/admin/agents-elders">
              <button className={styles.backButton}>Back to Agents & Elders</button>
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Agent Configuration">
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Agent Configuration</h1>
            <p className={styles.subtitle}>
              Manage settings and parameters for each agent
            </p>
          </div>
          <Link href="/admin/agents-elders">
            <button className={styles.backButton}>Back</button>
          </Link>
        </div>

        <div className={styles.contentLayout}>
          {/* Agent Selection Sidebar */}
          <aside className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>Select Agent</h3>
            <select
              value={selectedAgentId}
              onChange={handleAgentSelect}
              className={styles.agentSelect}
            >
              <option value="">-- Choose Agent --</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.type})
                </option>
              ))}
            </select>

            {selectedAgent && (
              <div className={styles.agentInfo}>
                <div className={styles.infoField}>
                  <label>Name</label>
                  <p>{selectedAgent.name}</p>
                </div>
                <div className={styles.infoField}>
                  <label>Type</label>
                  <p>{selectedAgent.type}</p>
                </div>
                <div className={styles.infoField}>
                  <label>Status</label>
                  <p>
                    <span className={`${styles.badge} ${styles[selectedAgent.status.toLowerCase()]}`}>
                      {selectedAgent.status}
                    </span>
                  </p>
                </div>
                {selectedAgent.successRate !== undefined && (
                  <div className={styles.infoField}>
                    <label>Success Rate</label>
                    <p>{(selectedAgent.successRate * 100).toFixed(2)}%</p>
                  </div>
                )}
                <div className={styles.infoField}>
                  <label>Last Heartbeat</label>
                  <p className={styles.timestamp}>
                    {new Date(selectedAgent.lastHeartbeat).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </aside>

          {/* Configuration Editor */}
          <main className={styles.main}>
            {selectedAgent ? (
              <ConfigEditor
                title={`Configure ${selectedAgent.name}`}
                description={`Edit configuration for ${selectedAgent.type} agent`}
                config={selectedAgent.configuration}
                fields={getAgentConfigFields(selectedAgent.type)}
                onSave={handleConfigSave}
              />
            ) : (
              <div className={styles.noSelection}>
                <p>Select an agent to edit its configuration</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}

/**
 * Get configuration fields based on agent type
 */
function getAgentConfigFields(agentType: string) {
  const baseFields = [
    {
      name: 'enabled',
      label: 'Enabled',
      type: 'boolean' as const,
      required: true,
      help: 'Enable or disable this agent',
    },
    {
      name: 'updateInterval',
      label: 'Update Interval (ms)',
      type: 'number' as const,
      required: true,
      help: 'How often to execute (milliseconds)',
    },
    {
      name: 'logLevel',
      label: 'Log Level',
      type: 'select' as const,
      required: true,
      help: 'Verbosity of logging',
      options: [
        { label: 'Error', value: 'error' },
        { label: 'Warn', value: 'warn' },
        { label: 'Info', value: 'info' },
        { label: 'Debug', value: 'debug' },
      ],
    },
  ];

  // Type-specific fields
  const typeSpecificFields: Record<string, any> = {
    Analyzer: [
      {
        name: 'analysisDepth',
        label: 'Analysis Depth',
        type: 'select' as const,
        required: true,
        help: 'How deep to analyze',
        options: [
          { label: 'Shallow', value: 'shallow' },
          { label: 'Standard', value: 'standard' },
          { label: 'Deep', value: 'deep' },
        ],
      },
      {
        name: 'timeWindow',
        label: 'Analysis Time Window (hours)',
        type: 'number' as const,
        required: true,
        help: 'How far back to look',
      },
      {
        name: 'metricsToTrack',
        label: 'Metrics to Track',
        type: 'textarea' as const,
        required: false,
        help: 'JSON array of metric names',
      },
    ],
    Defender: [
      {
        name: 'threatLevel',
        label: 'Threat Level',
        type: 'select' as const,
        required: true,
        help: 'Security threat detection level',
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
          { label: 'Critical', value: 'critical' },
        ],
      },
      {
        name: 'autoResponseEnabled',
        label: 'Auto Response',
        type: 'boolean' as const,
        required: true,
        help: 'Automatically respond to threats',
      },
      {
        name: 'responseThreshold',
        label: 'Response Threshold (%)',
        type: 'number' as const,
        required: true,
        help: 'Confidence threshold for auto-response',
      },
    ],
    Scout: [
      {
        name: 'scanRadius',
        label: 'Scan Radius',
        type: 'select' as const,
        required: true,
        help: 'How wide to scan',
        options: [
          { label: 'Local', value: 'local' },
          { label: 'Network', value: 'network' },
          { label: 'Global', value: 'global' },
        ],
      },
      {
        name: 'discoveryMode',
        label: 'Discovery Mode',
        type: 'select' as const,
        required: true,
        help: 'Active or passive discovery',
        options: [
          { label: 'Passive', value: 'passive' },
          { label: 'Active', value: 'active' },
          { label: 'Hybrid', value: 'hybrid' },
        ],
      },
      {
        name: 'maxTargets',
        label: 'Max Targets',
        type: 'number' as const,
        required: true,
        help: 'Maximum targets to discover',
      },
    ],
    Coordinator: [
      {
        name: 'coordinationMode',
        label: 'Coordination Mode',
        type: 'select' as const,
        required: true,
        help: 'How to coordinate with other agents',
        options: [
          { label: 'Sequential', value: 'sequential' },
          { label: 'Parallel', value: 'parallel' },
          { label: 'Adaptive', value: 'adaptive' },
        ],
      },
      {
        name: 'syncInterval',
        label: 'Sync Interval (seconds)',
        type: 'number' as const,
        required: true,
        help: 'How often to synchronize with agents',
      },
      {
        name: 'maxConcurrent',
        label: 'Max Concurrent Operations',
        type: 'number' as const,
        required: true,
        help: 'Maximum concurrent tasks',
      },
    ],
    Kwetu: [
      {
        name: 'focusArea',
        label: 'Focus Area',
        type: 'select' as const,
        required: true,
        help: 'Primary focus area',
        options: [
          { label: 'Community', value: 'community' },
          { label: 'Growth', value: 'growth' },
          { label: 'Support', value: 'support' },
          { label: 'Innovation', value: 'innovation' },
        ],
      },
      {
        name: 'engagementLevel',
        label: 'Engagement Level',
        type: 'number' as const,
        required: true,
        help: 'Engagement intensity (0-100)',
      },
      {
        name: 'responseTime',
        label: 'Response Time (minutes)',
        type: 'number' as const,
        required: true,
        help: 'Target response time',
      },
    ],
  };

  const specificFields = typeSpecificFields[agentType] || [];
  return [...baseFields, ...specificFields];
}
