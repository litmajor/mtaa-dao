/**
 * GrantDistributionPanel.tsx (Week 2 Treasury)
 * 
 * Grant distribution & token vesting strategies
 * Analyze grant disbursement schedules and vesting cliffs
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface Grant {
  recipientId: string;
  amount: number;
  vestingSchedule: 'linear' | 'cliff' | 'stepped';
  vestingPeriodMonths: number;
  cliffMonths: number;
  tickSize: number; // for stepped: how many months per tick
}

interface GrantDistributionFormData {
  totalGrantBudget: number;
  grants: Grant[];
  distributionMethod: 'immediate' | 'vested' | 'performance';
  performanceMetric?: string;
  grantTier: 'contributor' | 'developer' | 'leadership';
}

interface GrantDistributionPanelProps {
  userId: string;
  grantBudget?: number;
  onDistributionExecuted?: (result: any) => void;
}

/**
 * GrantDistributionPanel Component
 * Management and vesting of grant distributions
 */
export const GrantDistributionPanel: React.FC<GrantDistributionPanelProps> = ({
  userId,
  grantBudget = 500000,
  onDistributionExecuted,
}) => {
  // Form state
  const [formData, setFormData] = useState<GrantDistributionFormData>({
    totalGrantBudget: grantBudget,
    grants: [
      {
        recipientId: 'user_001',
        amount: 50000,
        vestingSchedule: 'cliff',
        vestingPeriodMonths: 12,
        cliffMonths: 3,
        tickSize: 1,
      },
    ],
    distributionMethod: 'vested',
    grantTier: 'contributor',
  });

  const [allocatedBudget, setAllocatedBudget] = useState<number>(0);
  const [remainingBudget, setRemainingBudget] = useState<number>(grantBudget);

  // Simulation state
  const {
    simulationResult,
    isLoading,
    isModalOpen,
    error,
    runSimulation,
    closeModal,
    resetState,
  } = useSimulationPreview({
    onSuccess: (result: SimulationResult) => {
      console.log('Grant distribution simulation successful:', result);
    },
  });

  // Calculate budget allocation
  const calculateBudgetUsage = () => {
    const allocated = formData.grants.reduce((sum, grant) => sum + grant.amount, 0);
    const remaining = formData.totalGrantBudget - allocated;

    setAllocatedBudget(allocated);
    setRemainingBudget(remaining);

    return { allocated, remaining };
  };

  // Add new grant
  const handleAddGrant = () => {
    setFormData({
      ...formData,
      grants: [
        ...formData.grants,
        {
          recipientId: `user_${formData.grants.length + 1}`,
          amount: 10000,
          vestingSchedule: 'linear',
          vestingPeriodMonths: 12,
          cliffMonths: 0,
          tickSize: 1,
        },
      ],
    });
  };

  // Remove grant
  const handleRemoveGrant = (index: number) => {
    const newGrants = formData.grants.filter((_, i) => i !== index);
    setFormData({ ...formData, grants: newGrants });
    calculateBudgetUsage();
  };

  // Update grant
  const handleUpdateGrant = (index: number, field: string, value: any) => {
    const newGrants = [...formData.grants];
    (newGrants[index] as any)[field] = value;
    setFormData({ ...formData, grants: newGrants });
    calculateBudgetUsage();
  };

  // Get vesting schedule description
  const getVestingDescription = (schedule: string, period: number, cliff: number): string => {
    switch (schedule) {
      case 'linear':
        return `Linear vesting over ${period} months (no cliff)`;
      case 'cliff':
        return `${cliff}mo cliff, then linear over ${period - cliff} months`;
      case 'stepped':
        return `${period} months total, stepped distribution`;
      default:
        return '';
    }
  };

  // Handle preview button click
  const handlePreviewDistribution = async (e: React.FormEvent) => {
    e.preventDefault();

    const { allocated, remaining } = calculateBudgetUsage();

    if (allocated > formData.totalGrantBudget) {
      alert('Allocated amount exceeds budget!');
      return;
    }

    if (formData.grants.length === 0) {
      alert('Please add at least one grant');
      return;
    }

    // Run simulation
    await runSimulation(
      'GRANT_DISTRIBUTION',
      {
        userId,
        totalBudget: formData.totalGrantBudget,
        allocatedAmount: allocated,
        remainingAmount: remaining,
        grants: formData.grants.map((g) => ({
          recipient: g.recipientId,
          amount: g.amount,
          schedule: g.vestingSchedule,
          period: g.vestingPeriodMonths,
          cliff: g.cliffMonths,
        })),
        distributionMethod: formData.distributionMethod,
        grantTier: formData.grantTier,
        grantCount: formData.grants.length,
      },
      userId
    );
  };

  // Handle distribution execution
  const handleExecuteDistribution = async () => {
    try {
      const response = await fetch('/api/treasury/distribute-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          totalBudget: formData.totalGrantBudget,
          grants: formData.grants,
          distributionMethod: formData.distributionMethod,
          grantTier: formData.grantTier,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onDistributionExecuted?.(result);
        resetState();
      }
    } catch (error) {
      console.error('Distribution execution failed:', error);
    }
  };

  const availablePercentage = remainingBudget > 0 ? ((remainingBudget / formData.totalGrantBudget) * 100).toFixed(1) : 0;
  const allocatedPercentage = allocatedBudget > 0 ? ((allocatedBudget / formData.totalGrantBudget) * 100).toFixed(1) : 0;

  return (
    <div className="grant-distribution-panel">
      <div className="panel-header">
        <h3>Grant Distribution & Vesting</h3>
        <div className="header-info">
          <span className="budget">
            Budget: ${formData.totalGrantBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <form onSubmit={handlePreviewDistribution} className="distribution-form">
        {/* Budget Overview */}
        <div className="budget-overview">
          <div className="budget-bar">
            {/* eslint-disable-next-line react/style-prop-object */}
            <div
              className="bar-allocated"
              style={{ width: `${allocatedPercentage}%` }}
            />
            {/* eslint-disable-next-line react/style-prop-object */}
            <div
              className="bar-remaining"
              style={{ width: `${availablePercentage}%` }}
            />
          </div>
          <div className="budget-stats">
            <div className="stat">
              <span>Allocated</span>
              <span className="value">${allocatedBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              <span className="percentage">{allocatedPercentage}%</span>
            </div>
            <div className="stat">
              <span>Remaining</span>
              <span className={`value ${remainingBudget >= 0 ? 'success' : 'danger'}`}>
                ${remainingBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="percentage">{availablePercentage}%</span>
            </div>
          </div>
        </div>

        {/* Distribution Method */}
        <div className="form-group">
          <label htmlFor="method">Distribution Method</label>
          <select
            id="method"
            value={formData.distributionMethod}
            onChange={(e) =>
              setFormData({
                ...formData,
                distributionMethod: e.target.value as 'immediate' | 'vested' | 'performance',
              })
            }
          >
            <option value="immediate">Immediate (Full amount immediately)</option>
            <option value="vested">Vested (Scheduled release over time)</option>
            <option value="performance">Performance-Based (Tied to milestones)</option>
          </select>
        </div>

        {/* Grant Tier */}
        <div className="form-group">
          <label htmlFor="tier">Grant Tier Recommendation</label>
          <select
            id="tier"
            value={formData.grantTier}
            onChange={(e) =>
              setFormData({
                ...formData,
                grantTier: e.target.value as 'contributor' | 'developer' | 'leadership',
              })
            }
          >
            <option value="contributor">Contributor (Community members, bounties)</option>
            <option value="developer">Developer (Full-time engineers, core team)</option>
            <option value="leadership">Leadership (C-level, board members)</option>
          </select>
        </div>

        {/* Grants List */}
        <div className="grants-section">
          <div className="section-header">
            <h4>Grants List ({formData.grants.length})</h4>
            <button
              type="button"
              onClick={handleAddGrant}
              className="btn-add-grant"
            >
              + Add Grant
            </button>
          </div>

          <div className="grants-list">
            {formData.grants.map((grant, index) => (
              <div key={index} className="grant-item">
                <div className="grant-header">
                  <input
                    type="text"
                    placeholder="Recipient ID / Address"
                    value={grant.recipientId}
                    onChange={(e) => handleUpdateGrant(index, 'recipientId', e.target.value)}
                    className="recipient-input"
                  />
                  <div className="grant-amount">
                    <label>Amount:</label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={grant.amount}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleUpdateGrant(index, 'amount', value);
                      }}
                      className="amount-input"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveGrant(index)}
                    className="btn-remove"
                  >
                    ✕
                  </button>
                </div>

                <div className="vesting-controls">
                  <div className="control">
                    <label htmlFor={`schedule-${index}`}>Vesting Schedule</label>
                    <select
                      id={`schedule-${index}`}
                      value={grant.vestingSchedule}
                      onChange={(e) =>
                        handleUpdateGrant(index, 'vestingSchedule', e.target.value)
                      }
                    >
                      <option value="linear">Linear</option>
                      <option value="cliff">Cliff</option>
                      <option value="stepped">Stepped</option>
                    </select>
                  </div>

                  <div className="control">
                    <label htmlFor={`period-${index}`}>
                      Vesting Period (months)
                    </label>
                    <input
                      id={`period-${index}`}
                      type="number"
                      step="1"
                      min="1"
                      max="60"
                      value={grant.vestingPeriodMonths}
                      onChange={(e) =>
                        handleUpdateGrant(
                          index,
                          'vestingPeriodMonths',
                          parseInt(e.target.value) || 1
                        )
                      }
                    />
                  </div>

                  {grant.vestingSchedule !== 'linear' && (
                    <div className="control">
                      <label htmlFor={`cliff-${index}`}>
                        {grant.vestingSchedule === 'cliff' ? 'Cliff (months)' : 'Tick Size'}
                      </label>
                      <input
                        id={`cliff-${index}`}
                        type="number"
                        step="1"
                        min="0"
                        max={grant.vestingPeriodMonths}
                        value={
                          grant.vestingSchedule === 'cliff'
                            ? grant.cliffMonths
                            : grant.tickSize
                        }
                        onChange={(e) => {
                          const fieldName =
                            grant.vestingSchedule === 'cliff'
                              ? 'cliffMonths'
                              : 'tickSize';
                          handleUpdateGrant(
                            index,
                            fieldName,
                            parseInt(e.target.value) || 0
                          );
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="vesting-description">
                  {getVestingDescription(
                    grant.vestingSchedule,
                    grant.vestingPeriodMonths,
                    grant.cliffMonths
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="distribution-summary">
          <div className="summary-item">
            <span>Total Recipients</span>
            <span className="value">{formData.grants.length}</span>
          </div>

          <div className="summary-item">
            <span>Average Grant</span>
            <span className="value">
              ${(allocatedBudget / Math.max(formData.grants.length, 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="summary-item">
            <span>Avg Vesting Period</span>
            <span className="value">
              {{
                medium: Math.round(
                  formData.grants.reduce((sum, g) => sum + g.vestingPeriodMonths, 0) /
                  Math.max(formData.grants.length, 1)
                ),
              }.medium || 12}mo
            </span>
          </div>

          <div className={`summary-item ${remainingBudget >= 0 ? 'success' : 'danger'}`}>
            <span>Budget Remaining</span>
            <span className="value">
              ${remainingBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {remainingBudget < 0 && (
          <div className="error-message">
            <span>⚠️ Grant amounts exceed budget by ${Math.abs(remainingBudget).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isLoading || formData.grants.length === 0 || remainingBudget < 0}
            className="btn btn-primary"
          >
            {isLoading ? 'Analyzing...' : 'Preview Distribution'}
          </button>
        </div>
      </form>

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteDistribution}
        confirmButtonText="Execute Distribution"
      />
    </div>
  );
};

export default GrantDistributionPanel;
