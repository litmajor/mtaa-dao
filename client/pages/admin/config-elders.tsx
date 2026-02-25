import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ConfigEditor from '@/components/admin/ConfigEditor';
import AdminLayout from '@/components/admin/AdminLayout';
import styles from './config.module.css';

interface Elder {
  id: string;
  name: string;
  type: string;
  status: string;
  configuration: Record<string, any>;
  lastHeartbeat: string;
}

interface SelectOption {
  label: string;
  value: string;
}

export default function ConfigEldersPage() {
  const router = useRouter();
  const [elders, setElders] = useState<Elder[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string>('');
  const [selectedElder, setSelectedElder] = useState<Elder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all elders
  useEffect(() => {
    const fetchElders = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/admin/agents-elders/elders');
        if (!response.ok) throw new Error('Failed to fetch elders');
        const data = await response.json();
        setElders(data.elders || []);
        
        // Auto-select first elder
        if (data.elders?.length > 0) {
          setSelectedElderId(data.elders[0].id);
          setSelectedElder(data.elders[0]);
        }
      } catch (err) {
        console.error('Error fetching elders:', err);
        setError(err instanceof Error ? err.message : 'Failed to load elders');
      } finally {
        setLoading(false);
      }
    };

    fetchElders();
  }, []);

  // Handle elder selection
  const handleElderSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const elderId = event.target.value;
    setSelectedElderId(elderId);
    const elder = elders.find(e => e.id === elderId);
    if (elder) {
      setSelectedElder(elder);
    }
  };

  // Handle configuration save
  const handleConfigSave = async (updatedConfig: Record<string, any>) => {
    if (!selectedElderId) return;

    try {
      const response = await fetch(`/api/admin/agents-elders/config/elders/${selectedElderId}`, {
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
      setSelectedElder(data.data);
      setElders(elders.map(e => 
        e.id === selectedElderId ? data.data : e
      ));

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration';
      console.error('Error saving configuration:', err);
      return { success: false, error: message };
    }
  };

  const elderOptions: SelectOption[] = elders.map(e => ({
    label: `${e.name} (${e.type})`,
    value: e.id,
  }));

  if (loading) {
    return (
      <AdminLayout title="Elder Configuration">
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading elders...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Elder Configuration">
        <div className={styles.container}>
          <div className={styles.errorBox}>
            <h3>Error Loading Elders</h3>
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

  if (elders.length === 0) {
    return (
      <AdminLayout title="Elder Configuration">
        <div className={styles.container}>
          <div className={styles.emptyState}>
            <p>No elders found</p>
            <Link href="/admin/agents-elders">
              <button className={styles.backButton}>Back to Agents & Elders</button>
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Elder Configuration">
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Elder Configuration</h1>
            <p className={styles.subtitle}>
              Manage settings and parameters for each elder
            </p>
          </div>
          <Link href="/admin/agents-elders">
            <button className={styles.backButton}>Back</button>
          </Link>
        </div>

        <div className={styles.contentLayout}>
          {/* Elder Selection Sidebar */}
          <aside className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>Select Elder</h3>
            <select
              value={selectedElderId}
              onChange={handleElderSelect}
              className={styles.elderSelect}
            >
              <option value="">-- Choose Elder --</option>
              {elders.map(elder => (
                <option key={elder.id} value={elder.id}>
                  {elder.name} ({elder.type})
                </option>
              ))}
            </select>

            {selectedElder && (
              <div className={styles.elderInfo}>
                <div className={styles.infoField}>
                  <label>Name</label>
                  <p>{selectedElder.name}</p>
                </div>
                <div className={styles.infoField}>
                  <label>Type</label>
                  <p>{selectedElder.type}</p>
                </div>
                <div className={styles.infoField}>
                  <label>Status</label>
                  <p>
                    <span className={`${styles.badge} ${styles[selectedElder.status.toLowerCase()]}`}>
                      {selectedElder.status}
                    </span>
                  </p>
                </div>
                <div className={styles.infoField}>
                  <label>Last Heartbeat</label>
                  <p className={styles.timestamp}>
                    {new Date(selectedElder.lastHeartbeat).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </aside>

          {/* Configuration Editor */}
          <main className={styles.main}>
            {selectedElder ? (
              <ConfigEditor
                title={`Configure ${selectedElder.name}`}
                description={`Edit configuration for ${selectedElder.type} elder`}
                config={selectedElder.configuration}
                fields={getElderConfigFields(selectedElder.type)}
                onSave={handleConfigSave}
              />
            ) : (
              <div className={styles.noSelection}>
                <p>Select an elder to edit its configuration</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}

/**
 * Get configuration fields based on elder type
 */
function getElderConfigFields(elderType: string) {
  const baseFields = [
    {
      name: 'enabled',
      label: 'Enabled',
      type: 'boolean' as const,
      required: true,
      help: 'Enable or disable this elder',
    },
    {
      name: 'updateInterval',
      label: 'Update Interval (ms)',
      type: 'number' as const,
      required: true,
      help: 'How often to update metrics (milliseconds)',
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
    KAIZEN: [
      {
        name: 'optimizationTarget',
        label: 'Optimization Target',
        type: 'select' as const,
        required: true,
        help: 'What to optimize for',
        options: [
          { label: 'Performance', value: 'performance' },
          { label: 'Safety', value: 'safety' },
          { label: 'Balance', value: 'balance' },
        ],
      },
      {
        name: 'maxIterations',
        label: 'Max Iterations',
        type: 'number' as const,
        required: true,
        help: 'Maximum optimization iterations',
      },
      {
        name: 'learningRate',
        label: 'Learning Rate',
        type: 'number' as const,
        required: false,
        help: 'Optimization learning rate (0-1)',
      },
    ],
    SCRY: [
      {
        name: 'predictionHorizon',
        label: 'Prediction Horizon (hours)',
        type: 'number' as const,
        required: true,
        help: 'How far ahead to predict',
      },
      {
        name: 'confidence_threshold',
        label: 'Confidence Threshold (%)',
        type: 'number' as const,
        required: true,
        help: 'Minimum confidence for predictions',
      },
      {
        name: 'dataSource',
        label: 'Data Source',
        type: 'select' as const,
        required: true,
        help: 'Where to source prediction data',
        options: [
          { label: 'On-Chain', value: 'onchain' },
          { label: 'Off-Chain', value: 'offchain' },
          { label: 'Hybrid', value: 'hybrid' },
        ],
      },
    ],
    LUMEN: [
      {
        name: 'monitoringScope',
        label: 'Monitoring Scope',
        type: 'select' as const,
        required: true,
        help: 'Scope of monitoring',
        options: [
          { label: 'Local', value: 'local' },
          { label: 'Network', value: 'network' },
          { label: 'Full', value: 'full' },
        ],
      },
      {
        name: 'alertSensitivity',
        label: 'Alert Sensitivity',
        type: 'number' as const,
        required: true,
        help: 'Sensitivity to anomalies (0-100)',
      },
      {
        name: 'notificationChannels',
        label: 'Notification Channels',
        type: 'textarea' as const,
        required: false,
        help: 'JSON array of notification channels (email, webhook, etc)',
      },
    ],
  };

  const specificFields = typeSpecificFields[elderType] || [];
  return [...baseFields, ...specificFields];
}
