import React, { useState, useEffect } from 'react';
import styles from './risk.module.css';

interface RiskFactor {
  category: string;
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
}

interface RiskAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface ComplianceItem {
  item: string;
  status: 'compliant' | 'at-risk' | 'non-compliant';
  details: string;
}

export default function RiskAssessmentPage() {
  const [daoId, setDaoId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([]);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [compliance, setCompliance] = useState<ComplianceItem[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'factors' | 'alerts' | 'compliance' | 'audit'>('overview');

  useEffect(() => {
    // Get daoId from URL or context
    const params = new URLSearchParams(window.location.search);
    const id = params.get('daoId') || localStorage.getItem('currentDaoId') || '';
    setDaoId(id);

    if (id) {
      loadRiskData(id);
    }
  }, []);

  const loadRiskData = async (id: string) => {
    setLoading(true);
    try {
      const [scoreRes, factorsRes, alertsRes, complianceRes, auditRes] = await Promise.all([
        fetch(`/api/admin/daos/${id}/risk/score`),
        fetch(`/api/admin/daos/${id}/risk/factors`),
        fetch(`/api/admin/daos/${id}/risk/alerts`),
        fetch(`/api/admin/daos/${id}/risk/compliance`),
        fetch(`/api/admin/daos/${id}/risk/audit-trail`),
      ]);

      const score = await scoreRes.json();
      const factors = await factorsRes.json();
      const alertsList = await alertsRes.json();
      const comp = await complianceRes.json();
      const audit = await auditRes.json();

      setRiskScore(score.overallScore);
      setRiskFactors(factors.riskFactors || []);
      setAlerts(alertsList.alerts || []);
      setCompliance(comp.compliance || []);
      setAuditTrail(audit.auditTrail || []);
    } catch (error) {
      console.error('Failed to load risk data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/admin/daos/${daoId}/risk/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Acknowledged by admin' }),
      });

      if (res.ok) {
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#fbc02d';
      case 'low': return '#388e3c';
      default: return '#999';
    }
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return '#d32f2f'; // Critical
    if (score >= 60) return '#f57c00'; // High
    if (score >= 40) return '#fbc02d'; // Medium
    return '#388e3c'; // Low
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Risk Assessment Dashboard</h1>
        <button className={styles.refreshBtn} onClick={() => loadRiskData(daoId)} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Risk Score Overview */}
      <div className={styles.scoreCard}>
        <div className={styles.scoreCircle} style={{ backgroundColor: getScoreBgColor(riskScore || 0) }}>
          <div className={styles.scoreValue}>{riskScore !== null ? riskScore : '--'}</div>
          <div className={styles.scoreLabel}>Risk Score</div>
        </div>
        <div className={styles.scoreDetails}>
          <p className={styles.scoreStatus}>
            {riskScore === null ? 'Loading...' : 
             riskScore >= 80 ? '🔴 CRITICAL' :
             riskScore >= 60 ? '🟠 HIGH' :
             riskScore >= 40 ? '🟡 MEDIUM' :
             '🟢 LOW'}
          </p>
          <p className={styles.scoreText}>
            Overall organizational risk assessment based on multiple factors
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${selectedTab === 'overview' ? styles.active : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'factors' ? styles.active : ''}`}
          onClick={() => setSelectedTab('factors')}
        >
          Risk Factors ({riskFactors.length})
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'alerts' ? styles.active : ''}`}
          onClick={() => setSelectedTab('alerts')}
        >
          Alerts ({alerts.filter(a => !a.acknowledged).length})
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'compliance' ? styles.active : ''}`}
          onClick={() => setSelectedTab('compliance')}
        >
          Compliance
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'audit' ? styles.active : ''}`}
          onClick={() => setSelectedTab('audit')}
        >
          Audit Trail
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className={styles.overview}>
            <h2>Risk Assessment Summary</h2>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <h3>Critical Issues</h3>
                <p className={styles.number}>{alerts.filter(a => a.severity === 'critical').length}</p>
              </div>
              <div className={styles.summaryCard}>
                <h3>High Priority</h3>
                <p className={styles.number}>{alerts.filter(a => a.severity === 'high').length}</p>
              </div>
              <div className={styles.summaryCard}>
                <h3>Active Alerts</h3>
                <p className={styles.number}>{alerts.filter(a => !a.acknowledged).length}</p>
              </div>
              <div className={styles.summaryCard}>
                <h3>Compliance Score</h3>
                <p className={styles.number}>{compliance.filter(c => c.status === 'compliant').length}/{compliance.length}</p>
              </div>
            </div>

            <div className={styles.recommendations}>
              <h3>Recommended Actions</h3>
              <ul>
                {riskFactors.slice(0, 3).map((factor, idx) => (
                  <li key={idx}>
                    <strong>{factor.category}</strong>: {factor.mitigation}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Risk Factors Tab */}
        {selectedTab === 'factors' && (
          <div className={styles.factors}>
            <h2>Risk Factor Breakdown</h2>
            {riskFactors.length === 0 ? (
              <p className={styles.noData}>No risk factors detected</p>
            ) : (
              <div className={styles.factorsList}>
                {riskFactors.map((factor, idx) => (
                  <div key={idx} className={styles.factorCard}>
                    <div className={styles.factorHeader}>
                      <h3>{factor.category}</h3>
                      <span
                        className={styles.severityBadge}
                        style={{ backgroundColor: getSeverityColor(factor.severity) }}
                      >
                        {factor.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className={styles.factorScore}>
                      <div className={styles.scoreBar}>
                        <div
                          className={styles.scoreProgress}
                          style={{ width: `${factor.score}%`, backgroundColor: getSeverityColor(factor.severity) }}
                        />
                      </div>
                      <span>{factor.score}/100</span>
                    </div>
                    <p className={styles.description}>{factor.description}</p>
                    <p className={styles.mitigation}>
                      <strong>Recommended Action:</strong> {factor.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {selectedTab === 'alerts' && (
          <div className={styles.alerts}>
            <h2>Active Alerts</h2>
            {alerts.length === 0 ? (
              <p className={styles.noData}>No alerts</p>
            ) : (
              <div className={styles.alertsList}>
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`${styles.alertCard} ${alert.acknowledged ? styles.acknowledged : ''}`}
                  >
                    <div className={styles.alertHeader}>
                      <span
                        className={styles.severityBadge}
                        style={{ backgroundColor: getSeverityColor(alert.severity) }}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className={styles.alertType}>{alert.type}</span>
                      {alert.acknowledged && <span className={styles.acknowledgedBadge}>Acknowledged</span>}
                    </div>
                    <p className={styles.alertMessage}>{alert.message}</p>
                    <div className={styles.alertFooter}>
                      <span className={styles.timestamp}>
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                      {!alert.acknowledged && (
                        <button
                          className={styles.acknowledgeBtn}
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Compliance Tab */}
        {selectedTab === 'compliance' && (
          <div className={styles.compliance}>
            <h2>Compliance Status</h2>
            {compliance.length === 0 ? (
              <p className={styles.noData}>No compliance data</p>
            ) : (
              <div className={styles.complianceGrid}>
                {compliance.map((item, idx) => (
                  <div
                    key={idx}
                    className={`${styles.complianceCard} ${styles[item.status]}`}
                  >
                    <div className={styles.complianceHeader}>
                      <h3>{item.item}</h3>
                      <span className={styles.statusBadge}>
                        {item.status === 'compliant' ? '✓' : item.status === 'at-risk' ? '⚠' : '✗'}
                      </span>
                    </div>
                    <p className={styles.details}>{item.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Trail Tab */}
        {selectedTab === 'audit' && (
          <div className={styles.auditTrail}>
            <h2>Audit Trail</h2>
            {auditTrail.length === 0 ? (
              <p className={styles.noData}>No audit records</p>
            ) : (
              <div className={styles.auditTable}>
                <div className={styles.auditHeader}>
                  <div className={styles.col1}>Timestamp</div>
                  <div className={styles.col2}>Event</div>
                  <div className={styles.col3}>Severity</div>
                  <div className={styles.col4}>User</div>
                </div>
                {auditTrail.map((record, idx) => (
                  <div key={idx} className={styles.auditRow}>
                    <div className={styles.col1}>{new Date(record.timestamp).toLocaleString()}</div>
                    <div className={styles.col2}>{record.event}</div>
                    <div className={styles.col3}>
                      <span
                        className={styles.severityBadge}
                        style={{ backgroundColor: getSeverityColor(record.severity) }}
                      >
                        {record.severity}
                      </span>
                    </div>
                    <div className={styles.col4}>{record.userId || 'System'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
