import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ConfigEditor from '@/components/admin/ConfigEditor';
import AdminLayout from '@/components/admin/AdminLayout';
import styles from './config.module.css';

interface SystemConfig {
  id: string;
  settings: Record<string, any>;
  lastUpdated: string;
  updatedBy: string;
}

export default function ConfigSystemPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch system configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/admin/agents-elders/config/system');
        if (!response.ok) throw new Error('Failed to fetch system configuration');
        const data = await response.json();
        setConfig(data.configuration);
      } catch (err) {
        console.error('Error fetching system configuration:', err);
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Handle configuration save
  const handleConfigSave = async (updatedConfig: Record<string, any>) => {
    try {
      const response = await fetch('/api/admin/agents-elders/config/system', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: updatedConfig }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update system configuration');
      }

      const data = await response.json();
      setConfig(data.configuration);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration';
      console.error('Error saving system configuration:', err);
      return { success: false, error: message };
    }
  };

  if (loading) {
    return (
      <AdminLayout title="System Configuration">
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading system configuration...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="System Configuration">
        <div className={styles.container}>
          <div className={styles.errorBox}>
            <h3>Error Loading Configuration</h3>
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

  if (!config) {
    return (
      <AdminLayout title="System Configuration">
        <div className={styles.container}>
          <div className={styles.emptyState}>
            <p>System configuration not initialized</p>
            <Link href="/admin/agents-elders">
              <button className={styles.backButton}>Back to Agents & Elders</button>
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="System Configuration">
      <div className={styles.systemContainer}>
        <div className={styles.pageHeader}>
          <div>
            <h1>System Configuration</h1>
            <p className={styles.subtitle}>
              Configure global settings for agents and elders
            </p>
          </div>
          <Link href="/admin/agents-elders">
            <button className={styles.backButton}>Back</button>
          </Link>
        </div>

        <div className={styles.systemContent}>
          <aside className={styles.systemSidebar}>
            <div className={styles.infoBox}>
              <h3>Configuration Details</h3>
              <div className={styles.infoField}>
                <label>ID</label>
                <p className={styles.monospace}>{config.id}</p>
              </div>
              <div className={styles.infoField}>
                <label>Last Updated</label>
                <p className={styles.timestamp}>
                  {new Date(config.lastUpdated).toLocaleString()}
                </p>
              </div>
              <div className={styles.infoField}>
                <label>Updated By</label>
                <p>{config.updatedBy}</p>
              </div>
            </div>

            <div className={styles.warningBox}>
              <h4>⚠️ Important</h4>
              <p>
                System configuration changes affect all agents and elders. 
                Only super administrators should modify these settings.
              </p>
            </div>
          </aside>

          <main className={styles.systemMain}>
            <ConfigEditor
              title="Global System Settings"
              description="Manage system-wide configuration"
              config={config.settings}
              fields={getSystemConfigFields()}
              onSave={handleConfigSave}
            />
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}

/**
 * Get system configuration fields
 */
function getSystemConfigFields() {
  return [
    // General Settings
    {
      name: 'systemName',
      label: 'System Name',
      type: 'text' as const,
      required: true,
      help: 'Name of this system deployment',
    },
    {
      name: 'environment',
      label: 'Environment',
      type: 'select' as const,
      required: true,
      help: 'Deployment environment',
      options: [
        { label: 'Development', value: 'development' },
        { label: 'Staging', value: 'staging' },
        { label: 'Production', value: 'production' },
      ],
    },

    // Elder Settings
    {
      name: 'elderDefaults.updateInterval',
      label: 'Elder Default Update Interval (ms)',
      type: 'number' as const,
      required: true,
      help: 'Default update interval for all elders',
    },
    {
      name: 'elderDefaults.logLevel',
      label: 'Elder Default Log Level',
      type: 'select' as const,
      required: true,
      help: 'Default log level for elders',
      options: [
        { label: 'Error', value: 'error' },
        { label: 'Warn', value: 'warn' },
        { label: 'Info', value: 'info' },
        { label: 'Debug', value: 'debug' },
      ],
    },
    {
      name: 'elderDefaults.heartbeatTimeout',
      label: 'Elder Heartbeat Timeout (seconds)',
      type: 'number' as const,
      required: true,
      help: 'Time before marking elder as inactive',
    },

    // Agent Settings
    {
      name: 'agentDefaults.updateInterval',
      label: 'Agent Default Update Interval (ms)',
      type: 'number' as const,
      required: true,
      help: 'Default update interval for all agents',
    },
    {
      name: 'agentDefaults.logLevel',
      label: 'Agent Default Log Level',
      type: 'select' as const,
      required: true,
      help: 'Default log level for agents',
      options: [
        { label: 'Error', value: 'error' },
        { label: 'Warn', value: 'warn' },
        { label: 'Info', value: 'info' },
        { label: 'Debug', value: 'debug' },
      ],
    },
    {
      name: 'agentDefaults.heartbeatTimeout',
      label: 'Agent Heartbeat Timeout (seconds)',
      type: 'number' as const,
      required: true,
      help: 'Time before marking agent as inactive',
    },
    {
      name: 'agentDefaults.maxRetries',
      label: 'Agent Max Retries',
      type: 'number' as const,
      required: true,
      help: 'Maximum retry attempts for agent operations',
    },

    // Performance Settings
    {
      name: 'performance.enableMetrics',
      label: 'Enable Metrics Collection',
      type: 'boolean' as const,
      required: true,
      help: 'Enable performance metrics collection',
    },
    {
      name: 'performance.metricsRetention',
      label: 'Metrics Retention (days)',
      type: 'number' as const,
      required: true,
      help: 'How long to keep performance metrics',
    },
    {
      name: 'performance.alertThreshold',
      label: 'Performance Alert Threshold (%)',
      type: 'number' as const,
      required: true,
      help: 'Threshold for performance degradation alerts',
    },

    // Security Settings
    {
      name: 'security.enableAuditLogging',
      label: 'Enable Audit Logging',
      type: 'boolean' as const,
      required: true,
      help: 'Enable comprehensive audit logging',
    },
    {
      name: 'security.auditRetention',
      label: 'Audit Log Retention (days)',
      type: 'number' as const,
      required: true,
      help: 'How long to keep audit logs',
    },
    {
      name: 'security.requireMFA',
      label: 'Require Multi-Factor Authentication',
      type: 'boolean' as const,
      required: true,
      help: 'Require MFA for admin operations',
    },

    // Notification Settings
    {
      name: 'notifications.enabled',
      label: 'Enable Notifications',
      type: 'boolean' as const,
      required: true,
      help: 'Enable system notifications',
    },
    {
      name: 'notifications.channels',
      label: 'Notification Channels',
      type: 'textarea' as const,
      required: false,
      help: 'JSON array of notification channels',
    },

    // Feature Flags
    {
      name: 'features.advancedAnalytics',
      label: 'Advanced Analytics',
      type: 'boolean' as const,
      required: false,
      help: 'Enable advanced analytics features',
    },
    {
      name: 'features.realTimeSync',
      label: 'Real-Time Synchronization',
      type: 'boolean' as const,
      required: false,
      help: 'Enable real-time agent synchronization',
    },
    {
      name: 'features.autoOptimization',
      label: 'Auto Optimization',
      type: 'boolean' as const,
      required: false,
      help: 'Enable automatic system optimization',
    },

    // Integration Settings
    {
      name: 'integrations.webhookEnabled',
      label: 'Webhook Integrations',
      type: 'boolean' as const,
      required: false,
      help: 'Enable webhook integrations',
    },
    {
      name: 'integrations.externalServices',
      label: 'External Services',
      type: 'textarea' as const,
      required: false,
      help: 'JSON object of external service configurations',
    },
  ];
}
