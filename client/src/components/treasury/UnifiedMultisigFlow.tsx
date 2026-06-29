/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Unified Multisig Treasury Flow (Frontend Orchestrator)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Complete UI for multisig workflows:
 * - Create multisig (admin only)
 * - View pending approvals (all members)
 * - Sign proposals (signers)
 * - Execute after threshold (signers)
 * 
 * Uses: `/v1/daos/:daoId/treasury/multisig/*` API
 * 
 * Cartographer Pattern:
 *   STATE:   pending_approvals, multisig_config, signer_list
 *   SYSTEM:  MultisigTreasuryAPI → /v1/daos/:daoId/treasury/multisig/*
 *   SURFACE: Okedi Treasury Workspace
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/use-toast';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Alert,
  AlertDescription,
} from '../ui/alert';
import { multisigTreasuryAPI, MultisigApproval, MultisigSigner } from '../../api/multisigTreasuryAPI';
import { useFeature, LockedFeatureCard } from '@/hooks/useFeature';

// ────────────────────────────────────────────────────────────────────────────────
// COMPONENT STATE & TYPES
// ────────────────────────────────────────────────────────────────────────────────

type MultisigView = 'overview' | 'create' | 'approvals' | 'signers';

interface MultisigState {
  currentView: MultisigView;
  loading: boolean;
  error: string | null;
  approvals: MultisigApproval[];
  signers: MultisigSigner[];
  userRole: string | null;
  isAdmin: boolean;
}

interface CreateFormState {
  signers: string[];
  requiredSignatures: number;
  currentSigner: string;
  simulation: boolean;
  submitting: boolean;
}

interface ProposeFormState {
  recipient: string;
  amount: string;
  purpose: string;
  submitting: boolean;
}

// ────────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────────

export default function UnifiedMultisigTreasuryFlow() {
  const { id: daoId } = useParams<{ id: string }>();
  const { toast } = useToast();

  // ─── Main state ───
  const [state, setState] = useState<MultisigState>({
    currentView: 'overview',
    loading: true,
    error: null,
    approvals: [],
    signers: [],
    userRole: null,
    isAdmin: false,
  });

  // ─── Create multisig form ───
  const [createForm, setCreateForm] = useState<CreateFormState>({
    signers: [],
    requiredSignatures: 2,
    currentSigner: '',
    simulation: false,
    submitting: false,
  });

  // ─── Propose withdrawal form ───
  const [proposeForm, setProposeForm] = useState<ProposeFormState>({
    recipient: '',
    amount: '',
    purpose: '',
    submitting: false,
  });

  // ─── Modal states ───
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [signingApprovalId, setSigningApprovalId] = useState<string | null>(null);

  // Feature gating for multisig (frontend presentation)
  const { accessible: multisigAccessible, presentation: multisigPresentation, unlock: multisigUnlock } = useFeature('treasury.multisig');

  if (!daoId) {
    return <div className="p-4 text-red-600">Invalid DAO ID</div>;
  }

  // ─── Load initial data ───
  useEffect(() => {
    loadData();
  }, [daoId]);

  async function loadData() {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Get user role from session / auth context
      const userRole = 'admin'; // admin, founder, elder, member
      const isAdmin = ['admin', 'founder', 'elder'].includes(userRole);

      const [approvalsRes, signersRes] = await Promise.all([
        multisigTreasuryAPI.getApprovals(daoId!),
        multisigTreasuryAPI.getSigners(daoId!),
      ]);

      setState((prev) => ({
        ...prev,
        approvals: approvalsRes.approvals || [],
        signers: signersRes.signers || [],
        userRole,
        isAdmin,
        loading: false,
      }));
    } catch (error: any) {
      console.error('Load data error:', error);
      setState((prev) => ({
        ...prev,
        error: error?.message || 'Failed to load data',
        loading: false,
      }));
      toast({
        title: 'Error',
        description: error?.message || 'Failed to load multisig data',
        variant: 'destructive',
      });
    }
  }

  // ─── Create Multisig Handler ───
  async function handleCreateMultisig() {
    if (!multisigAccessible) {
      toast({ title: 'Locked', description: 'Multisig is not available for your account', variant: 'destructive' });
      return;
    }
    try {
      if (createForm.signers.length < 2) {
        toast({
          title: 'Error',
          description: 'At least 2 signers required',
          variant: 'destructive',
        });
        return;
      }

      if (
        createForm.requiredSignatures < 1 ||
        createForm.requiredSignatures > createForm.signers.length
      ) {
        toast({
          title: 'Error',
          description: 'Invalid required signatures',
          variant: 'destructive',
        });
        return;
      }

      setCreateForm((prev) => ({ ...prev, submitting: true }));

      const result = await multisigTreasuryAPI.createMultisig(daoId!, {
        signers: createForm.signers,
        requiredSignatures: createForm.requiredSignatures,
        simulation: createForm.simulation,
      });

      toast({
        title: 'Success',
        description: `Multisig created: ${result.multisigAddress}`,
      });

      setCreateModalOpen(false);
      setCreateForm({
        signers: [],
        requiredSignatures: 2,
        currentSigner: '',
        simulation: false,
        submitting: false,
      });

      // Reload data
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create multisig',
        variant: 'destructive',
      });
    } finally {
      setCreateForm((prev) => ({ ...prev, submitting: false }));
    }
  }

  // ─── Add Signer Handler ───
  function handleAddSigner() {
    const signer = createForm.currentSigner.trim();
    if (!signer) return;

    if (createForm.signers.includes(signer)) {
      toast({
        title: 'Error',
        description: 'Signer already added',
        variant: 'destructive',
      });
      return;
    }

    setCreateForm((prev) => ({
      ...prev,
      signers: [...prev.signers, signer],
      currentSigner: '',
    }));
  }

  // ─── Remove Signer Handler ───
  function handleRemoveSigner(index: number) {
    setCreateForm((prev) => ({
      ...prev,
      signers: prev.signers.filter((_, i) => i !== index),
    }));
  }

  // ─── Propose Transfer Handler ───
  async function handleProposeTransfer() {
    if (!multisigAccessible) {
      toast({ title: 'Locked', description: 'Multisig is not available for your account', variant: 'destructive' });
      return;
    }
    try {
      if (!proposeForm.recipient || !proposeForm.amount || !proposeForm.purpose) {
        toast({
          title: 'Error',
          description: 'All fields required',
          variant: 'destructive',
        });
        return;
      }

      setProposeForm((prev) => ({ ...prev, submitting: true }));

      const result = await multisigTreasuryAPI.proposeTransfer(daoId!, {
        recipient: proposeForm.recipient,
        amount: proposeForm.amount,
        purpose: proposeForm.purpose,
      });

      toast({
        title: 'Success',
        description: 'Transfer proposal created',
      });

      setProposeModalOpen(false);
      setProposeForm({
        recipient: '',
        amount: '',
        purpose: '',
        submitting: false,
      });

      // Reload data
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to propose transfer',
        variant: 'destructive',
      });
    } finally {
      setProposeForm((prev) => ({ ...prev, submitting: false }));
    }
  }

  // ─── Sign Approval Handler ───
  async function handleSignApproval(approvalId: string) {
    if (!multisigAccessible) {
      toast({ title: 'Locked', description: 'Multisig is not available for your account', variant: 'destructive' });
      return;
    }
    try {
      setSigningApprovalId(approvalId);

      await multisigTreasuryAPI.signApproval(daoId!, approvalId);

      toast({
        title: 'Success',
        description: 'Approval signed',
      });

      // Reload data
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to sign approval',
        variant: 'destructive',
      });
    } finally {
      setSigningApprovalId(null);
    }
  }

  // ─── Execute Approval Handler ───
  async function handleExecuteApproval(approvalId: string) {
    if (!multisigAccessible) {
      toast({ title: 'Locked', description: 'Multisig is not available for your account', variant: 'destructive' });
      return;
    }
    try {
      await multisigTreasuryAPI.executeApproval(daoId!, approvalId);

      toast({
        title: 'Success',
        description: 'Approval executed',
      });

      // Reload data
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to execute approval',
        variant: 'destructive',
      });
    }
  }

  // ─── Render functions ───

  function renderStatusBadge(status: string) {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      executed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  }

  function renderApprovalsView() {
    if (state.approvals.length === 0) {
      return (
        <div className="p-6 text-center text-gray-500">
          No pending approvals
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {state.approvals.map((approval) => (
          <Card key={approval.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold">{approval.purpose}</p>
                  <p className="text-sm text-gray-600">
                    To: {approval.recipient}
                  </p>
                  <p className="text-sm font-mono">
                    {approval.amount} cUSD
                  </p>
                </div>
                {renderStatusBadge(approval.status)}
              </div>

              <div className="mb-3 text-sm text-gray-600">
                Signatures: {approval.currentSignatures} of {approval.requiredSignatures}
              </div>

              <div className="flex gap-2">
                {approval.status === 'pending' && state.isAdmin && (
                  <Button
                    size="sm"
                    onClick={() => handleSignApproval(approval.id)}
                    disabled={signingApprovalId === approval.id}
                  >
                    {signingApprovalId === approval.id ? 'Signing...' : 'Sign'}
                  </Button>
                )}

                {approval.status === 'approved' && state.isAdmin && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleExecuteApproval(approval.id)}
                  >
                    Execute
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedApprovalId(approval.id)}
                >
                  Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  function renderSignersView() {
    if (state.signers.length === 0) {
      return (
        <div className="p-6 text-center text-gray-500">
          No signers configured
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {state.signers.map((signer) => (
          <Card key={signer.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{signer.name || signer.address}</p>
                  <p className="text-xs text-gray-500">{signer.address}</p>
                  <p className="text-xs text-gray-600">
                    {signer.approvalsCount || 0} approvals
                  </p>
                </div>
                <Badge variant="secondary">{signer.role}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ─── Main render ───

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Treasury Multisig Management</h2>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b">
            {['overview', 'approvals', 'signers', 'create'].map((view) => (
              <button
                key={view}
                onClick={() => setState((prev) => ({ ...prev, currentView: view as MultisigView }))}
                className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                  state.currentView === view
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="min-h-96">
            {state.currentView === 'overview' && (
              <Card>
                <CardHeader>
                  <CardTitle>Multisig Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">Total Signers</p>
                      <p className="text-2xl font-bold">{state.signers.length}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">Pending Approvals</p>
                      <p className="text-2xl font-bold">
                        {state.approvals.filter((a) => a.status === 'pending').length}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {state.isAdmin && (
                      <>
                        {multisigAccessible ? (
                          <>
                            <Button
                              onClick={() => setCreateModalOpen(true)}
                              className="w-full"
                            >
                              Create Multisig
                            </Button>
                            <Button
                              onClick={() => setProposeModalOpen(true)}
                              variant="outline"
                              className="w-full"
                            >
                              Propose Transfer
                            </Button>
                          </>
                        ) : multisigPresentation === 'locked' ? (
                          <LockedFeatureCard label="Treasury Multisig" unlock={multisigUnlock} compact />
                        ) : null}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {state.currentView === 'approvals' && renderApprovalsView()}

            {state.currentView === 'signers' && renderSignersView()}

            {state.currentView === 'create' && (
              <Card>
                <CardHeader>
                  <CardTitle>Create New Multisig</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                      onClick={() => multisigAccessible && setCreateModalOpen(true)}
                      className="w-full"
                      disabled={!multisigAccessible}
                    >
                      {multisigAccessible ? 'Open Multisig Wizard' : 'Multisig Unavailable'}
                    </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Create Multisig Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Multisig Wallet</DialogTitle>
            <DialogDescription>
              Set up a new multisig wallet for treasury approvals
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Add Signers
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Wallet address or user ID"
                  value={createForm.currentSigner}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      currentSigner: e.target.value,
                    }))
                  }
                />
                <Button
                  onClick={handleAddSigner}
                  disabled={!createForm.currentSigner.trim()}
                >
                  Add
                </Button>
              </div>

              {createForm.signers.length > 0 && (
                <div className="space-y-2">
                  {createForm.signers.map((signer, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm font-mono">{signer}</span>
                      <button
                        onClick={() => handleRemoveSigner(idx)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Required Signatures
              </label>
              <Input
                type="number"
                min="1"
                max={createForm.signers.length}
                value={createForm.requiredSignatures}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    requiredSignatures: parseInt(e.target.value),
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createForm.simulation}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    simulation: e.target.checked,
                  }))
                }
              />
              <label className="text-sm">Simulation mode (test only)</label>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="ghost"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateMultisig}
                disabled={
                  createForm.submitting ||
                  createForm.signers.length < 2
                }
              >
                {createForm.submitting ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Propose Transfer Modal */}
      <Dialog open={proposeModalOpen} onOpenChange={setProposeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose Transfer</DialogTitle>
            <DialogDescription>
              Create a new transfer proposal
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Recipient Address
              </label>
              <Input
                placeholder="0x..."
                value={proposeForm.recipient}
                onChange={(e) =>
                  setProposeForm((prev) => ({
                    ...prev,
                    recipient: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Amount (cUSD)
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={proposeForm.amount}
                onChange={(e) =>
                  setProposeForm((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Purpose
              </label>
              <Textarea
                placeholder="Why is this transfer needed?"
                value={proposeForm.purpose}
                onChange={(e) =>
                  setProposeForm((prev) => ({
                    ...prev,
                    purpose: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="ghost"
                onClick={() => setProposeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleProposeTransfer}
                disabled={proposeForm.submitting}
              >
                {proposeForm.submitting ? 'Proposing...' : 'Propose'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
