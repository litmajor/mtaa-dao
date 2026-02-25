import React, { useState, useEffect } from 'react';
import styles from './agents-elders.module.css';

interface Elder {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  capabilities: string[];
  stats: {
    proposalsAnalyzed?: number;
    threatsDetected?: number;
    proposalsReviewed?: number;
    [key: string]: any;
  };
  status: 'active' | 'inactive';
  uptime: number;
  color: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline';
  emoji: string;
  description: string;
  lastHeartbeat: string;
  messagesProcessed: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
}

interface TabType {
  type: 'elders' | 'agents' | 'configuration';
  label: string;
}

export default function AgentsEldersPage() {
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'elders' | 'agents' | 'configuration'>('elders');
  const [elders, setElders] = useState<Elder[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [configuration, setConfiguration] = useState<any>(null);
  const [selectedElder, setSelectedElder] = useState<Elder | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [elderDetails, setElderDetails] = useState<any>(null);
  const [agentDetails, setAgentDetails] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [selectedTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (selectedTab === 'elders') {
        const res = await fetch('/api/admin/agents-elders/elders/overview');
        const data = await res.json();
        setElders(data.elders);
      } else if (selectedTab === 'agents') {
        const res = await fetch('/api/admin/agents-elders/agents/overview');
        const data = await res.json();
        setAgents(data.agents);
      } else if (selectedTab === 'configuration') {
        const res = await fetch('/api/admin/agents-elders/configuration');
        const data = await res.json();
        setConfiguration(data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleElderClick = async (elder: Elder) => {
    setSelectedElder(elder);
    try {
      const res = await fetch(`/api/admin/agents-elders/elders/${elder.id}/details`);
      const data = await res.json();
      setElderDetails(data);
    } catch (error) {
      console.error('Failed to load elder details:', error);
    }
  };

  const handleAgentClick = async (agent: Agent) => {
    setSelectedAgent(agent);
    try {
      const res = await fetch(`/api/admin/agents-elders/agents/${agent.id}/details`);
      const data = await res.json();
      setAgentDetails(data);
    } catch (error) {
      console.error('Failed to load agent details:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🤖 Agents & Elders Management</h1>
        <button className={styles.refreshBtn} onClick={() => loadData()} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${selectedTab === 'elders' ? styles.active : ''}`}
          onClick={() => setSelectedTab('elders')}
        >
          👑 Elders (3)
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'agents' ? styles.active : ''}`}
          onClick={() => setSelectedTab('agents')}
        >
          🤖 Agents ({agents.length || 0})
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'configuration' ? styles.active : ''}`}
          onClick={() => setSelectedTab('configuration')}
        >
          ⚙️ Configuration
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Elders Tab */}
        {selectedTab === 'elders' && (
          <div className={styles.eldersView}>
            {elderDetails ? (
              <div className={styles.detailView}>
                <button className={styles.backBtn} onClick={() => { setSelectedElder(null); setElderDetails(null); }}>
                  ← Back to Elders
                </button>

                <div className={styles.detailHeader}>
                  <div className={styles.elderIcon}>{selectedElder?.emoji}</div>
                  <div className={styles.elderInfo}>
                    <h2>{elderDetails.name}</h2>
                    <p>{elderDetails.description}</p>
                  </div>
                  <div className={styles.statusBadge} style={{ background: selectedElder?.color }}>
                    {selectedElder?.status.toUpperCase()}
                  </div>
                </div>

                <div className={styles.statsGrid}>
                  {Object.entries(elderDetails.stats).map(([key, value]) => (
                    <div key={key} className={styles.statCard}>
                      <div className={styles.statLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div className={styles.statValue}>{String(value).substring(0, 20)}</div>
                    </div>
                  ))}
                </div>

                {elderDetails.recentOptimizations && (
                  <div className={styles.section}>
                    <h3>Recent Actions</h3>
                    <div className={styles.actionsList}>
                      {elderDetails.recentOptimizations.map((action: any, idx: number) => (
                        <div key={idx} className={styles.actionItem}>
                          <div className={styles.actionTitle}>{action.proposal}</div>
                          <div className={styles.actionDetails}>{action.impact}</div>
                          <div className={styles.actionDate}>
                            {new Date(action.implementedDate).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {elderDetails.recentThreats && (
                  <div className={styles.section}>
                    <h3>Recent Threats Detected</h3>
                    <div className={styles.threatsList}>
                      {elderDetails.recentThreats.map((threat: any, idx: number) => (
                        <div key={idx} className={`${styles.threatItem} ${styles[threat.severity]}`}>
                          <div className={styles.threatType}>{threat.type}</div>
                          <div className={styles.threatDesc}>{threat.description}</div>
                          <div className={styles.threatStatus}>{threat.status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {elderDetails.recentReviews && (
                  <div className={styles.section}>
                    <h3>Recent Ethics Reviews</h3>
                    <div className={styles.reviewsList}>
                      {elderDetails.recentReviews.map((review: any, idx: number) => (
                        <div key={idx} className={styles.reviewItem}>
                          <div className={styles.reviewTitle}>{review.proposal}</div>
                          <div className={styles.scoreBar}>
                            <div
                              className={styles.scoreFill}
                              style={{ width: `${review.ethicsScore * 100}%` }}
                            />
                          </div>
                          <div className={styles.reviewRec}>{review.recommendation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.eldersList}>
                {elders.map((elder) => (
                  <div
                    key={elder.id}
                    className={styles.elderCard}
                    onClick={() => handleElderClick(elder)}
                  >
                    <div className={styles.elderCardHeader}>
                      <div className={styles.elderEmoji}>{elder.emoji}</div>
                      <div className={styles.elderCardTitle}>
                        <h3>{elder.name}</h3>
                        <p>{elder.role}</p>
                      </div>
                      <div className={styles.uptimeBadge}>{(elder.uptime * 100).toFixed(1)}%</div>
                    </div>
                    <p className={styles.elderDesc}>{elder.description}</p>
                    <div className={styles.capabilities}>
                      {elder.capabilities.map((cap, idx) => (
                        <span key={idx} className={styles.capBadge}>{cap}</span>
                      ))}
                    </div>
                    <div className={styles.elderStats}>
                      {Object.entries(elder.stats).slice(0, 3).map(([key, value]) => (
                        <div key={key} className={styles.statMini}>
                          <span className={styles.label}>{key}</span>
                          <span className={styles.value}>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Agents Tab */}
        {selectedTab === 'agents' && (
          <div className={styles.agentsView}>
            {agentDetails ? (
              <div className={styles.detailView}>
                <button className={styles.backBtn} onClick={() => { setSelectedAgent(null); setAgentDetails(null); }}>
                  ← Back to Agents
                </button>

                <div className={styles.agentDetailHeader}>
                  <div className={styles.agentIcon}>{selectedAgent?.emoji}</div>
                  <div className={styles.agentInfo}>
                    <h2>{agentDetails.name}</h2>
                    <p>{agentDetails.description}</p>
                    <div className={styles.version}>v{agentDetails.version}</div>
                  </div>
                  <div className={`${styles.statusBadge} ${styles[agentDetails.status]}`}>
                    {agentDetails.status.toUpperCase()}
                  </div>
                </div>

                <div className={styles.performanceGrid}>
                  {Object.entries(agentDetails.performance).map(([key, value]) => (
                    <div key={key} className={styles.perfCard}>
                      <div className={styles.perfLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div className={styles.perfValue}>{String(value)}</div>
                    </div>
                  ))}
                </div>

                <div className={styles.section}>
                  <h3>Capabilities</h3>
                  <div className={styles.capList}>
                    {agentDetails.capabilities.map((cap: string, idx: number) => (
                      <div key={idx} className={styles.capItem}>✓ {cap}</div>
                    ))}
                  </div>
                </div>

                {agentDetails.recentActivity && (
                  <div className={styles.section}>
                    <h3>Recent Activity</h3>
                    <div className={styles.activityList}>
                      {agentDetails.recentActivity.map((activity: any, idx: number) => (
                        <div key={idx} className={styles.activityItem}>
                          <div className={styles.time}>
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </div>
                          <div className={styles.action}>{activity.action}</div>
                          <div className={`${styles.result} ${styles[activity.result]}`}>
                            {activity.result}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.agentsList}>
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={styles.agentCard}
                    onClick={() => handleAgentClick(agent)}
                  >
                    <div className={styles.agentCardHeader}>
                      <div className={styles.agentEmoji}>{agent.emoji}</div>
                      <div className={styles.agentCardTitle}>
                        <h3>{agent.name}</h3>
                        <p>{agent.type}</p>
                      </div>
                      <div className={`${styles.statusBadge} ${styles[agent.status]}`}>
                        {agent.status}
                      </div>
                    </div>
                    <p className={styles.agentDesc}>{agent.description}</p>
                    <div className={styles.agentMetrics}>
                      <div className={styles.metric}>
                        <span className={styles.label}>Messages:</span>
                        <span className={styles.value}>{agent.messagesProcessed}</span>
                      </div>
                      <div className={styles.metric}>
                        <span className={styles.label}>Avg Response:</span>
                        <span className={styles.value}>{agent.averageResponseTime}ms</span>
                      </div>
                      <div className={styles.metric}>
                        <span className={styles.label}>Error Rate:</span>
                        <span className={styles.value}>{(agent.errorRate * 100).toFixed(2)}%</span>
                      </div>
                      <div className={styles.metric}>
                        <span className={styles.label}>Uptime:</span>
                        <span className={styles.value}>{(agent.uptime * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Configuration Tab */}
        {selectedTab === 'configuration' && configuration && (
          <div className={styles.configView}>
            <h2>System Configuration</h2>

            <div className={styles.configSection}>
              <h3>Elders Configuration</h3>
              <div className={styles.configGrid}>
                {Object.entries(configuration.elders).map(([elder, config]: [string, any]) => (
                  <div key={elder} className={styles.configCard}>
                    <h4>{elder.toUpperCase()}</h4>
                    <div className={styles.configItems}>
                      {Object.entries(config).map(([key, value]: [string, any]) => (
                        <div key={key} className={styles.configItem}>
                          <span className={styles.key}>{key}</span>
                          <span className={styles.value}>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.configSection}>
              <h3>Agents Configuration</h3>
              <div className={styles.configTable}>
                {Object.entries(configuration.agents).map(([agent, config]: [string, any]) => (
                  <div key={agent} className={styles.configRow}>
                    <div className={styles.agentName}>{agent}</div>
                    {Object.entries(config).map(([key, value]: [string, any]) => (
                      <div key={key} className={styles.configValue}>
                        <strong>{key}:</strong> {String(value)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.configSection}>
              <h3>System Settings</h3>
              <div className={styles.systemConfig}>
                {Object.entries(configuration.system).map(([key, value]: [string, any]) => (
                  <div key={key} className={styles.systemItem}>
                    <span className={styles.key}>{key}</span>
                    <span className={styles.value}>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
