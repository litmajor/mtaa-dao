/**
 * Agent Status Card Component
 * Day 1 Emergency Response - Power Checklist Compliance
 * 
 * POWER CHECKLIST COMPLIANCE:
 * 1. Power Classification: Clearly labeled "HIGH POWER"
 * 2. Power Gradient: Visual distinction (colors, size, prominence)
 * 3. State Clarity: Shows before state, after state, timestamp
 * 4. Authority Transparency: Shows who can control this
 * 6. Intent Confirmation: Requires explicit reason
 * 7. Reversibility: Shows reactivation button
 * 8. Post-Action Narrative: Shows activity history
 * 9. Emotional Safety: Calm colors, soft language
 * 10. Consistency: Matches other admin components
 */

'use client';

import React, { useEffect, useState } from 'react';
import styles from './AgentStatusCard.module.css';

export interface Agent {
  id: string;
  name: string;
  type: 'KAIZEN' | 'SCRY' | 'LUMEN' | 'Analyzer' | 'Defender' | 'Scout' | 'Coordinator' | 'Kwetu';
  is_active: boolean;
  circuit_breaker_triggered: boolean;
  circuit_breaker_threshold: number;
  execution_count_1h: number;
  deactivated_at?: string;
  deactivated_by?: string;
  deactivation_reason?: string;
}

interface Props {
  agent: Agent;
  onKillSwitch: (agentId: string, reason: string) => Promise<void>;
  onReactivate: (agentId: string, reason: string) => Promise<void>;
  loading?: boolean;
}

export const AgentStatusCard: React.FC<Props> = ({
  agent,
  onKillSwitch,
  onReactivate,
  loading = false
}) => {
  const [showKillSwitchModal, setShowKillSwitchModal] = useState(false);
  const [killSwitchReason, setKillSwitchReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Determine agent status
  const isActive = agent.is_active && !agent.circuit_breaker_triggered;
  const isPaused = !agent.is_active;
  const isCircuitBreakerTriggered = agent.circuit_breaker_triggered;
  
  // Status badge color (Checklist #2: Power Gradient)
  const getStatusColor = () => {
    if (isPaused) return '#FFA500'; // ORANGE: Paused (recoverable)
    if (isCircuitBreakerTriggered) return '#FF6B6B'; // RED: Auto-paused (unsafe)
    if (agent.execution_count_1h > agent.circuit_breaker_threshold * 0.8) {
      return '#FFD700'; // YELLOW: Near threshold
    }
    return '#10B981'; // GREEN: Healthy
  };
  
  const statusColor = getStatusColor();
  const percentageUsed = Math.min(
    (agent.execution_count_1h / agent.circuit_breaker_threshold) * 100,
    100
  );
  
  return (
    <div className={styles.card}>
      {/* Checklist #1: Power Classification Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <span className={styles.powerBadge}>HIGH POWER</span>
          <h3 className={styles.title}>{agent.name}</h3>
          <span className={styles.type}>({agent.type})</span>
        </div>
      </div>
      
      {/* Checklist #3: State Clarity - CURRENT STATE */}
      <div className={styles.stateClarity}>
        <div className={`${styles.statusIndicator} ${isCircuitBreakerTriggered ? styles.error : isPaused ? styles.warning : styles.success}`}>
          <span className={styles.statusLabel}>
            {isActive && '🟢 ACTIVE'}
            {isPaused && '🟠 PAUSED'}
            {isCircuitBreakerTriggered && '🔴 CIRCUIT BREAKER'}
          </span>
        </div>
        
        <div className={styles.stateDetails}>
          <div className={styles.metric}>
            <label>Executions (last hour):</label>
            <span className={styles.value}>
              {agent.execution_count_1h} / {agent.circuit_breaker_threshold}
            </span>
            <div className={styles.progressBar}>
              {/* CSS variable used for dynamic width percentage */}
              {/* eslint-disable-next-line react/style-prop-object */}
              <div 
                className={`${styles.progress} ${isCircuitBreakerTriggered ? styles.errorProgress : isPaused ? styles.warningProgress : styles.successProgress}`}
                style={{ '--progress-width': `${percentageUsed}%` } as React.CSSProperties}
              />
            </div>
            <span className={styles.percentage}>{percentageUsed.toFixed(0)}%</span>
          </div>
          
          {isPaused && agent.deactivated_at && (
            <div className={styles.metric}>
              <label>Paused since:</label>
              <span className={styles.value}>
                {new Date(agent.deactivated_at).toLocaleString()}
              </span>
              {agent.deactivation_reason && (
                <span className={styles.reason}>
                  📝 Reason: {agent.deactivation_reason}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Checklist #4: Authority Transparency */}
      <details className={styles.authorityDetails}>
        <summary className={styles.authoritySummary}>
          👥 Who can control this? (Authority Transparency)
        </summary>
        <div className={styles.authorityContent}>
          <p><strong>✅ Can Activate Kill-Switch:</strong> Superuser (with reason)</p>
          <p><strong>✅ Can Reactivate:</strong> Superuser (after safety review)</p>
          <p><strong>📍 Scope:</strong> Affects this agent only</p>
          <p><strong>⏱️ Duration:</strong> Until manually reactivated (no deadline)</p>
          <p><strong>↩️ Reversible:</strong> YES - can reactivate anytime</p>
        </div>
      </details>
      
      {/* Checklist #6: Intent Confirmation Dialog */}
      {showKillSwitchModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h4>Confirm Kill-Switch Activation</h4>
            <p className={styles.warning}>
              ⚠️ This will pause agent <strong>{agent.name}</strong>
            </p>
            
            {/* Checklist #6: Named Action */}
            <div className={styles.formGroup}>
              <label htmlFor="reason">
                Why are you pausing this agent? <span className={styles.required}>(required, min 10 chars)</span>
              </label>
              <textarea
                id="reason"
                className={styles.textarea}
                value={killSwitchReason}
                onChange={(e) => setKillSwitchReason(e.target.value)}
                placeholder="Example: Circuit breaker triggered. Agent exceeded 25 actions/hour."
                minLength={10}
                disabled={submitting}
              />
              <span className={styles.charCount}>
                {killSwitchReason.length}/10 {killSwitchReason.length >= 10 ? '✅' : ''}
              </span>
            </div>
            
            {/* Checklist #8: Post-Action Narrative Preview */}
            <div className={styles.preview}>
              <h5>What will happen:</h5>
              <ul>
                <li>✅ Agent execution will stop immediately</li>
                <li>✅ All pending actions will be cancelled</li>
                <li>✅ Action logged to audit trail</li>
                <li>✅ Security team will be notified</li>
                <li>✅ Can be reactivated anytime (no deadline)</li>
              </ul>
            </div>
            
            {/* Checklist #9: Clear Decline Button + Reassurance */}
            <div className={styles.buttonGroup}>
              <button
                className={styles.declineBtn}
                onClick={() => {
                  setShowKillSwitchModal(false);
                  setKillSwitchReason('');
                }}
                disabled={submitting}
              >
                Cancel (Go back)
              </button>
              <button
                className={styles.confirmBtn}
                disabled={killSwitchReason.length < 10 || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await onKillSwitch(agent.id, killSwitchReason);
                    setShowKillSwitchModal(false);
                    setKillSwitchReason('');
                  } catch (error) {
                    console.error('Kill-switch error:', error);
                    alert('Failed to pause agent. Please try again.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? 'Pausing...' : 'Confirm: Pause Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Checklist #7: Reversibility - Clear Action Buttons */}
      <div className={styles.actions}>
        {isActive && (
          <button
            className={styles.killSwitchBtn}
            onClick={() => setShowKillSwitchModal(true)}
            disabled={loading}
            title="Immediately pause this agent (reversible)"
          >
            🛑 Pause Agent (Kill-Switch)
          </button>
        )}
        
        {(isPaused || isCircuitBreakerTriggered) && (
          <button
            className={styles.reactivateBtn}
            onClick={async () => {
              const reason = prompt(
                `Confirm ${agent.name} has been reviewed. Enter your notes (min 10 chars):`
              );
              if (reason && reason.length >= 10) {
                try {
                  await onReactivate(agent.id, reason);
                } catch (error) {
                  console.error('Reactivation error:', error);
                  alert('Failed to reactivate agent. Please try again.');
                }
              }
            }}
            disabled={loading}
            title="Resume the agent after review"
          >
            ✅ Reactivate Agent
          </button>
        )}
        
        <a 
          href={`/admin/agents/${agent.id}/activity`}
          className={styles.viewActivityBtn}
          title="See all actions by this agent"
        >
          📋 View Activity Log
        </a>
      </div>
    </div>
  );
};

export default AgentStatusCard;
