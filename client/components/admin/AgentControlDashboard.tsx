import React, { useState, useEffect } from 'react';
import AgentStatusCard, { Agent } from './AgentStatusCard';
import ProposalQueueCard from './ProposalQueueCard';
import ProposalHistory from './ProposalHistory';
import styles from './AgentControlDashboard.module.css';

interface Proposal {
  id: string;
  agent_id: string;
  action_type: string;
  proposed_args: Record<string, any>;
  risk_score: number;
  risk_category: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string;
  created_at: Date;
  expires_at: Date;
  rejection_reason?: string;
}

interface HistoryEntry {
  id: string;
  timestamp: Date;
  action: string;
  status: string;
  reason?: string;
  actor?: string;
}

interface AgentControlDashboardProps {
  agents: Agent[];
  onAuthorized?: (context: any) => void;
}

const AgentControlDashboard: React.FC<AgentControlDashboardProps> = ({ agents, onAuthorized }) => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(agents[0] || null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalAgents: agents.length,
    activeAgents: agents.filter((a) => a.is_active).length,
    pendingProposals: 0,
  });

  // Fetch proposals when agent changes
  useEffect(() => {
    if (selectedAgent) {
      fetchProposals();
    }
  }, [selectedAgent]);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/proposals?status=PENDING');
      const data = await response.json();
      const agentProposals = data.proposals.filter((p: Proposal) => p.agent_id === selectedAgent?.id);
      setProposals(agentProposals);
      setStats((prev) => ({ ...prev, pendingProposals: data.pendingCount }));
    } catch (error) {
      console.error('Error fetching proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!selectedAgent) return;
    try {
      const response = await fetch(`/api/admin/proposals?agentId=${selectedAgent.id}`);
      const data = await response.json();
      const historyData: HistoryEntry[] = data.proposals.map((p: Proposal) => ({
        id: p.id,
        timestamp: new Date(p.created_at),
        action: p.status.toUpperCase(),
        status: p.status,
        reason: p.rejection_reason || undefined,
      }));
      setHistory(historyData);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleApproveProposal = async (proposalId: string, reason: string) => {
    try {
      const response = await fetch(`/api/admin/proposals/${proposalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve proposal');
      }

      await fetchProposals();
      await fetchHistory();
    } catch (error) {
      throw error;
    }
  };

  const handleRejectProposal = async (proposalId: string, reason: string) => {
    try {
      const response = await fetch(`/api/admin/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reject proposal');
      }

      await fetchProposals();
      await fetchHistory();
    } catch (error) {
      throw error;
    }
  };

  const handleKillSwitch = async (reason: string) => {
    if (!selectedAgent) return;
    try {
      const response = await fetch(`/api/admin/agents/${selectedAgent.id}/kill-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to activate kill-switch');
      }

      // Refresh agent state
      window.location.reload();
    } catch (error) {
      throw error;
    }
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1>🎛️ Agent Control Dashboard</h1>
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Agents</span>
            <span className={styles.statValue}>{stats.totalAgents}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Active</span>
            <span className={`${styles.statValue} ${styles.activeValue}`}>
              {stats.activeAgents}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Pending Proposals</span>
            <span className={`${styles.statValue} ${styles.pendingValue}`}>
              {stats.pendingProposals}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* Sidebar: Agent List */}
        <div className={styles.sidebar}>
          <h3>Agents</h3>
          <div className={styles.agentList}>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`${styles.agentItem} ${selectedAgent?.id === agent.id ? styles.active : ''}`}
                onClick={() => setSelectedAgent(agent)}
              >
                <span className={styles.agentName}>{agent.name}</span>
                <span
                  className={`${styles.agentStatus} ${agent.is_active ? styles.active : styles.paused}`}
                >
                  {agent.is_active ? '🟢' : '🔴'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.main}>
          {selectedAgent ? (
            <>
              {/* Agent Status */}
              <div className={styles.section}>
                <AgentStatusCard
                  agent={selectedAgent}
                  onKillSwitch={handleKillSwitch}
                  onReactivate={async () => {
                    window.location.reload();
                  }}
                />
              </div>

              {/* Proposals */}
              <div className={styles.section}>
                <ProposalQueueCard
                  proposals={proposals}
                  onApprove={handleApproveProposal}
                  onReject={handleRejectProposal}
                  onRefresh={fetchProposals}
                />
              </div>

              {/* History */}
              <div className={styles.section}>
                <ProposalHistory history={history} isLoading={loading} />
              </div>

              {/* Load history button */}
              <button className={styles.loadHistoryBtn} onClick={fetchHistory} disabled={loading}>
                {loading ? '⏳ Loading...' : '📜 Load Full History'}
              </button>
            </>
          ) : (
            <div className={styles.noSelection}>
              <p>Select an agent to view control options</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentControlDashboard;
