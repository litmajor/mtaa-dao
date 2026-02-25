/**
 * PermissionPanel.tsx (Week 2 Governance)
 * 
 * Role and permission management with multi-sig requirements
 * Assign roles, manage access control, configure multi-sig thresholds
 */

import React, { useState, useEffect } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface RoleDefinition {
  roleId: string;
  roleName: string;
  description: string;
  currentMembers: number;
  maxMembers: number;
  permissions: string[];
  requiredMultiSigThreshold: number; // Percentage required to approve actions
}

interface PermissionFormData {
  roleId: string;
  actionType: 'assign' | 'revoke' | 'update-threshold' | 'add-permission';
  targetAddress: string;
  newThreshold?: number;
  permission?: string;
  justification: string;
  requiresMultiSig: boolean;
}

interface PermissionPanelProps {
  userId: string;
  availableRoles?: RoleDefinition[];
  currentUserRoles?: string[];
  onPermissionChanged?: (result: any) => void;
}

/**
 * PermissionPanel Component
 * Manage DAO roles, permissions, and multi-sig requirements
 */
export const PermissionPanel: React.FC<PermissionPanelProps> = ({
  userId,
  availableRoles = [],
  currentUserRoles = [],
  onPermissionChanged,
}) => {
  // Form state
  const [formData, setFormData] = useState<PermissionFormData>({
    roleId: '',
    actionType: 'assign',
    targetAddress: '',
    justification: '',
    requiresMultiSig: false,
  });

  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(
    availableRoles?.[0] || null
  );
  const [multiSigDetails, setMultiSigDetails] = useState<{
    currentSigners: number;
    requiredSigners: number;
    estimatedTime: string;
  }>({ currentSigners: 3, requiredSigners: 2, estimatedTime: '2-4 hours' });

  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);

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
      console.log('Permission change simulation successful:', result);
    },
  });

  // Update available permissions based on role
  useEffect(() => {
    if (selectedRole) {
      const basePermissions = [
        'execute_proposals',
        'modify_parameters',
        'manage_treasury',
        'create_proposals',
      ];
      setAvailablePermissions(
        basePermissions.filter((p) => !selectedRole.permissions.includes(p))
      );
    }
  }, [selectedRole]);

  // Handle preview permission change
  const handlePreviewChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRole) {
      alert('Please select a role');
      return;
    }

    if (
      (formData.actionType === 'assign' || formData.actionType === 'revoke') &&
      !formData.targetAddress.trim()
    ) {
      alert('Please enter a target address');
      return;
    }

    if (!formData.justification.trim()) {
      alert('Please provide justification');
      return;
    }

    const impactScore = calculateImpactScore();

    /**
     * Run simulation
     */
    await runSimulation(
      'GOVERNANCE_PERMISSION',
      {
        userId,
        roleId: selectedRole.roleId,
        roleName: selectedRole.roleName,
        actionType: formData.actionType,
        targetAddress: formData.targetAddress,
        newThreshold: formData.newThreshold,
        permission: formData.permission,
        justification: formData.justification,
        requiresMultiSig: formData.requiresMultiSig,
        currentMembers: selectedRole.currentMembers,
        maxMembers: selectedRole.maxMembers,
        impactScore,
        multiSigDetails: {
          currentSigners: multiSigDetails.currentSigners,
          requiredSigners: multiSigDetails.requiredSigners,
          estimatedApprovalTime: multiSigDetails.estimatedTime,
        },
      },
      userId
    );
  };

  // Calculate impact score
  const calculateImpactScore = (): number => {
    let score = 1;

    // Impact based on action type
    if (formData.actionType === 'update-threshold') score = 7;
    if (formData.actionType === 'add-permission') score = 5;
    if (formData.actionType === 'revoke') score = 4;

    // Impact based on role criticality
    if (selectedRole?.roleName.includes('Admin')) score += 3;
    if (selectedRole?.roleName.includes('Treasury')) score += 2;

    // Multi-sig increases impact
    if (formData.requiresMultiSig) score += 1;

    return Math.min(10, score);
  };

  // Handle permission change submission
  const handleSubmitChange = async () => {
    try {
      const response = await fetch('/api/governance/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          roleId: selectedRole?.roleId,
          actionType: formData.actionType,
          targetAddress: formData.targetAddress,
          newThreshold: formData.newThreshold,
          permission: formData.permission,
          justification: formData.justification,
          requiresMultiSig: formData.requiresMultiSig,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onPermissionChanged?.(result);
        resetState();
        setFormData({
          roleId: '',
          actionType: 'assign',
          targetAddress: '',
          justification: '',
          requiresMultiSig: false,
        });
      }
    } catch (error) {
      console.error('Permission change failed:', error);
    }
  };

  const isUserAuthorized = currentUserRoles.includes('admin') || currentUserRoles.includes('governance');

  if (!availableRoles || availableRoles.length === 0) {
    return (
      <div className="permission-panel">
        <div className="panel-header">
          <h3>Manage Permissions</h3>
        </div>
        <div className="empty-state">
          {isUserAuthorized
            ? 'No roles available'
            : 'You do not have permission to manage roles'}
        </div>
      </div>
    );
  }

  return (
    <div className="permission-panel">
      <div className="panel-header">
        <h3>Manage Permissions</h3>
        <div className="header-info">
          <span className="auth-status">
            {isUserAuthorized ? '✅ Authorized' : '❌ Not Authorized'}
          </span>
        </div>
      </div>

      {!isUserAuthorized && (
        <div className="warning-message">
          <span>⚠️ You do not have permission to manage roles and permissions</span>
        </div>
      )}

      {isUserAuthorized && (
        <form onSubmit={handlePreviewChange} className="permission-form">
          {/* Role Selection */}
          <div className="form-group">
            <label htmlFor="role">Select Role</label>
            <select
              id="role"
              onChange={(e) => {
                const role = availableRoles.find((r) => r.roleId === e.target.value);
                setSelectedRole(role || null);
                setFormData({ ...formData, roleId: e.target.value });
              }}
              value={selectedRole?.roleId || ''}
            >
              <option value="">Choose a role...</option>
              {availableRoles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName} ({role.currentMembers}/{role.maxMembers})
                </option>
              ))}
            </select>
          </div>

          {selectedRole && (
            <>
              {/* Role Info Card */}
              <div className="role-info-card">
                <div className="info-item">
                  <span className="label">Role</span>
                  <span className="value">{selectedRole.roleName}</span>
                </div>
                <div className="info-item">
                  <span className="label">Description</span>
                  <span className="value">{selectedRole.description}</span>
                </div>
                <div className="info-item">
                  <span className="label">Members</span>
                  <span className="value">
                    {selectedRole.currentMembers} / {selectedRole.maxMembers}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Multi-Sig Threshold</span>
                  <span className="value">{selectedRole.requiredMultiSigThreshold}%</span>
                </div>
              </div>

              {/* Current Permissions */}
              <div className="permissions-list">
                <h4>Current Permissions</h4>
                <div className="permission-items">
                  {selectedRole.permissions.map((perm) => (
                    <span key={perm} className="permission-tag">
                      ✓ {perm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Type */}
              <div className="form-group">
                <label>Action Type</label>
                <div className="action-buttons">
                  {(['assign', 'revoke', 'update-threshold', 'add-permission'] as const).map(
                    (action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => setFormData({ ...formData, actionType: action })}
                        className={`action-btn ${formData.actionType === action ? 'active' : ''}`}
                      >
                        {action === 'assign' && '➕ Assign'}
                        {action === 'revoke' && '➖ Revoke'}
                        {action === 'update-threshold' && '⚙️ Threshold'}
                        {action === 'add-permission' && '🔒 Permission'}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Conditional Fields Based on Action Type */}
              {(formData.actionType === 'assign' ||
                formData.actionType === 'revoke') && (
                <div className="form-group">
                  <label htmlFor="address">
                    {formData.actionType === 'assign'
                      ? 'Address to Assign'
                      : 'Address to Revoke'}
                  </label>
                  <input
                    id="address"
                    type="text"
                    placeholder="0x..."
                    value={formData.targetAddress}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        targetAddress: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {formData.actionType === 'update-threshold' && (
                <div className="form-group">
                  <label htmlFor="threshold">
                    New Multi-Sig Threshold: {formData.newThreshold || 50}%
                  </label>
                  <input
                    id="threshold"
                    type="range"
                    min="25"
                    max="100"
                    step="5"
                    value={formData.newThreshold || 50}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        newThreshold: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              )}

              {formData.actionType === 'add-permission' && (
                <div className="form-group">
                  <label htmlFor="permission">New Permission</label>
                  <select
                    id="permission"
                    value={formData.permission || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        permission: e.target.value,
                      })
                    }
                  >
                    <option value="">Select permission...</option>
                    {availablePermissions.map((perm) => (
                      <option key={perm} value={perm}>
                        {perm}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Justification */}
              <div className="form-group">
                <label htmlFor="justification">Justification</label>
                <textarea
                  id="justification"
                  placeholder="Explain why this change is needed..."
                  value={formData.justification}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      justification: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>

              {/* Multi-Sig Requirement */}
              <div className="form-group checkbox">
                <label htmlFor="multisig">
                  <input
                    id="multisig"
                    type="checkbox"
                    checked={formData.requiresMultiSig}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        requiresMultiSig: e.target.checked,
                      })
                    }
                  />
                  Require multi-signature approval
                </label>
              </div>

              {formData.requiresMultiSig && (
                <div className="multisig-details">
                  <div className="detail-item">
                    <span>Current Signers</span>
                    <span className="value">{multiSigDetails.currentSigners}</span>
                  </div>
                  <div className="detail-item">
                    <span>Required Signers</span>
                    <span className="value">{multiSigDetails.requiredSigners}</span>
                  </div>
                  <div className="detail-item">
                    <span>Est. Approval Time</span>
                    <span className="value">{multiSigDetails.estimatedTime}</span>
                  </div>
                </div>
              )}

              {/* Impact Warning */}
              {calculateImpactScore() >= 7 && (
                <div className="warning-message">
                  <span>⚠️ High-impact change. Ensure community alignment before execution.</span>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="error-message">
                  <span>⚠️ {error}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="form-actions">
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    !formData.justification.trim() ||
                    ((formData.actionType === 'assign' ||
                      formData.actionType === 'revoke') &&
                      !formData.targetAddress.trim())
                  }
                  className="btn btn-primary"
                >
                  {isLoading ? 'Analyzing...' : 'Preview Change'}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleSubmitChange}
        confirmButtonText="Apply Permission Change"
      />
    </div>
  );
};

export default PermissionPanel;
