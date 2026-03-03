/**
 * Treasury Management Component
 * 
 * PHASE 2 Treasury Controls Dashboard
 * - Recipient whitelist management (admin only)
 * - Treasury limits configuration (admin only)
 * - Multisig approval workflows (admins can sign, elders can view)
 * 
 * Permissions:
 * - Admin/Creator: Full read/write access
 * - Elder: Read-only access to whitelist, limits, and pending approvals
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DollarSign } from 'lucide-react';
import { AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { treasuryAPI, TreasuryWhitelistEntry, TreasuryLimits, PendingApproval } from '@/api/treasuryAPI';

interface TreasuryManagementProps {
  daoId: string;
  userRole: 'admin' | 'creator' | 'elder' | 'member';
}

interface Signer {
  userId: string;
  role: string;
  hasSigned: boolean;
}

export default function TreasuryManagement({ daoId, userRole }: TreasuryManagementProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Whitelist state
  const [whitelist, setWhitelist] = useState<TreasuryWhitelistEntry[]>([]);
  const [showWhitelistForm, setShowWhitelistForm] = useState(false);
  const [newEntryForm, setNewEntryForm] = useState<{
    walletAddress: string;
    recipientName: string;
    category: 'charity' | 'payments' | 'team' | 'disbursements' | 'other';
    description: string;
  }>({
    walletAddress: '',
    recipientName: '',
    category: 'charity',
    description: '',
  });

  // Limits state
  const [limits, setLimits] = useState<TreasuryLimits | null>(null);
  const [editingLimits, setEditingLimits] = useState(false);
  const [newLimits, setNewLimits] = useState<Partial<TreasuryLimits>>({});

  // Multisig approvals state
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [signingApprovalId, setSigningApprovalId] = useState<string | null>(null);
  const [rejectingApprovalId, setRejectingApprovalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isAdmin = ['admin', 'creator'].includes(userRole);
  const isElder = userRole === 'elder';
  const canEdit = isAdmin;
  const canRead = isAdmin || isElder;

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, [daoId]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [whitelistData, limitsData, approvalsData] = await Promise.all([
        treasuryAPI.getWhitelistEntries(daoId),
        treasuryAPI.getTreasuryLimits(daoId),
        treasuryAPI.getPendingApprovals(daoId),
      ]);

      setWhitelist(whitelistData);
      setLimits(limitsData);
      setPendingApprovals(approvalsData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWhitelistEntry = async () => {
    if (!newEntryForm.walletAddress || !newEntryForm.recipientName) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setError(null);
      const result = await treasuryAPI.requestWhitelistApproval(
        daoId,
        newEntryForm.walletAddress,
        newEntryForm.recipientName,
        newEntryForm.category,
        newEntryForm.description
      );

      setWhitelist([...whitelist, result]);
      setNewEntryForm({ walletAddress: '', recipientName: '', category: 'charity', description: '' });
      setShowWhitelistForm(false);
      setSuccess('Whitelist request submitted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleApproveWhitelist = async (entryId: string) => {
    if (!isAdmin) {
      setError('Only admins can approve whitelist entries');
      return;
    }

    try {
      setError(null);
      await treasuryAPI.approveWhitelistEntry(daoId, entryId);
      
      setWhitelist(whitelist.map(entry =>
        entry.id === entryId ? { ...entry, status: 'approved' } : entry
      ));
      setSuccess('Whitelist entry approved');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateLimits = async () => {
    if (!isAdmin) {
      setError('Only admins can update treasury limits');
      return;
    }

    try {
      setError(null);
      const updated = await treasuryAPI.updateTreasuryLimits(daoId, newLimits);
      setLimits(updated);
      setEditingLimits(false);
      setSuccess('Treasury limits updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubmitSignature = async (approvalId: string) => {
    if (!isAdmin) {
      setError('Only admins can sign multisig approvals');
      return;
    }

    try {
      setError(null);
      // In production, this would use ethers.js to create actual cryptographic signature
      // For now, creating a placeholder signature
      const signature = 'placeholder_signature_' + Date.now();
      
      await treasuryAPI.submitMultisigSignature(daoId, approvalId, signature);
      
      setPendingApprovals(pendingApprovals.map(approval =>
        approval.id === approvalId
          ? {
              ...approval,
              currentSignatures: approval.currentSignatures + 1,
              signers: approval.signers.map((signer: Signer) =>
                // In real implementation, check if current user signed
                signer
              ),
            }
          : approval
      ));
      
      setSigningApprovalId(null);
      setSuccess('Signature submitted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRejectApproval = async (approvalId: string) => {
    if (!isAdmin) {
      setError('Only admins can reject multisig approvals');
      return;
    }

    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    try {
      setError(null);
      await treasuryAPI.rejectMultisigApproval(daoId, approvalId, rejectReason);
      
      setPendingApprovals(pendingApprovals.map(approval =>
        approval.id === approvalId ? { ...approval, status: 'rejected' } : approval
      ));
      
      setRejectingApprovalId(null);
      setRejectReason('');
      setSuccess('Approval rejected');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!canRead) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>You don't have permission to view treasury settings</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Loading treasury settings...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="whitelist" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="whitelist" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Whitelist
          </TabsTrigger>
          <TabsTrigger value="limits" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Limits
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Approvals
          </TabsTrigger>
        </TabsList>

        {/* WHITELIST TAB */}
        <TabsContent value="whitelist" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recipient Whitelist</CardTitle>
              {isAdmin && (
                <Dialog open={showWhitelistForm} onOpenChange={setShowWhitelistForm}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="w-4 h-4" />
                      Request Approval
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Whitelist Approval</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Ethereum Address *</label>
                        <Input
                          placeholder="0x..."
                          value={newEntryForm.walletAddress}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewEntryForm({
                              ...newEntryForm,
                              walletAddress: e.target.value,
                            })
                          }
                        />
                        {newEntryForm.walletAddress && !newEntryForm.walletAddress.match(/^0x[a-fA-F0-9]{40}$/) && (
                          <p className="text-sm text-red-600 mt-1">Invalid Ethereum address</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Recipient Name *</label>
                        <Input
                          placeholder="e.g., Red Cross Kenya"
                          value={newEntryForm.recipientName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewEntryForm({
                              ...newEntryForm,
                              recipientName: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label htmlFor="category" className="block text-sm font-medium mb-1">
                          Category *
                        </label>
                        <select
                          id="category"
                          value={newEntryForm.category}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            setNewEntryForm({
                              ...newEntryForm,
                              category: e.target.value as 'charity' | 'payments' | 'team' | 'disbursements' | 'other',
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="charity">Charity</option>
                          <option value="payments">Payments</option>
                          <option value="team">Team</option>
                          <option value="disbursements">Disbursements</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                        <textarea
                          placeholder="Additional context about this recipient..."
                          value={newEntryForm.description}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setNewEntryForm({
                              ...newEntryForm,
                              description: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg min-h-[100px]"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setShowWhitelistForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleRequestWhitelistEntry}>Submit</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {whitelist.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No whitelisted recipients yet
                </div>
              ) : (
                <div className="space-y-3">
                  {whitelist.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{entry.recipientName}</p>
                        <p className="text-sm text-gray-600 font-mono">{entry.walletAddress}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">{entry.category}</Badge>
                          <Badge
                            variant={
                              entry.status === 'approved'
                                ? 'default'
                                : entry.status === 'rejected'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {entry.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {entry.status}
                          </Badge>
                        </div>
                        {entry.description && (
                          <p className="text-xs text-gray-500 mt-2">{entry.description}</p>
                        )}
                      </div>
                      {isAdmin && entry.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApproveWhitelist(entry.id)}
                          className="gap-1"
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Whitelist Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">Charity:</span> Non-profits, foundations</div>
                <div><span className="font-medium">Payments:</span> Service providers, contractors</div>
                <div><span className="font-medium">Team:</span> Internal team members</div>
                <div><span className="font-medium">Disbursements:</span> Member payouts, dividends</div>
                <div><span className="font-medium">Other:</span> Miscellaneous recipients</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIMITS TAB */}
        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Treasury Limits</CardTitle>
              {isAdmin && !editingLimits && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingLimits(true);
                    if (limits) {
                      setNewLimits({
                        dailyCapPercentage: limits.dailyCapPercentage,
                        singleTransferMaxPercentage: limits.singleTransferMaxPercentage,
                        multisigThresholdUSD: limits.multisigThresholdUSD,
                        multisigRequiredSignatures: limits.multisigRequiredSignatures,
                      });
                    }
                  }}
                  className="gap-1"
                >
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {limits && (
                <div className="space-y-4">
                  {editingLimits ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Daily Cap Percentage (%)
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={newLimits.dailyCapPercentage || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewLimits({
                              ...newLimits,
                              dailyCapPercentage: parseFloat(e.target.value),
                            })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Maximum percentage of treasury that can be withdrawn per day
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Single Transfer Max (%)
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={newLimits.singleTransferMaxPercentage || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewLimits({
                              ...newLimits,
                              singleTransferMaxPercentage: parseFloat(e.target.value),
                            })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Maximum percentage per single transfer
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Multisig Threshold (USD)
                        </label>
                        <Input
                          type="number"
                          value={newLimits.multisigThresholdUSD || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewLimits({
                              ...newLimits,
                              multisigThresholdUSD: parseFloat(e.target.value),
                            })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Transfers above this amount require multisig approval
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Required Signatures
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          value={newLimits.multisigRequiredSignatures || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewLimits({
                              ...newLimits,
                              multisigRequiredSignatures: parseInt(e.target.value),
                            })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Number of signatures required for large transfers
                        </p>
                      </div>

                      <div className="flex gap-2 justify-end pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setEditingLimits(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleUpdateLimits}>Save Changes</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Daily Cap</p>
                          <p className="text-2xl font-bold">{limits.dailyCapPercentage}%</p>
                          <p className="text-xs text-gray-500 mt-1">Of treasury per day</p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Single Transfer Max</p>
                          <p className="text-2xl font-bold">{limits.singleTransferMaxPercentage}%</p>
                          <p className="text-xs text-gray-500 mt-1">Per transaction</p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Multisig Threshold</p>
                          <p className="text-2xl font-bold">${limits.multisigThresholdUSD}</p>
                          <p className="text-xs text-gray-500 mt-1">USD amount triggers multisig</p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Required Signatures</p>
                          <p className="text-2xl font-bold">{limits.multisigRequiredSignatures}</p>
                          <p className="text-xs text-gray-500 mt-1">For large transfers</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPROVALS TAB */}
        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Multisig Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No pending approvals
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApprovals.map((approval) => (
                    <div key={approval.id} className="p-4 border rounded-lg space-y-3">
                      <div>
                        <p className="font-medium">{approval.description}</p>
                        <p className="text-sm text-gray-600 font-mono">
                          {approval.recipientAddress}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Amount:</span>
                          <p className="font-medium">{approval.amount} (${approval.amountUSD})</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <Badge className="ml-2">{approval.status}</Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          Signatures: {approval.currentSignatures} / {approval.requiredSignatures}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {approval.signers.map((signer: Signer, idx: number) => (
                            <Badge
                              key={idx}
                              variant={signer.hasSigned ? 'default' : 'outline'}
                              className="gap-1"
                            >
                              {signer.hasSigned ? '✓' : '○'}
                              {signer.role}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        Expires: {new Date(approval.expiresAt).toLocaleDateString()}
                      </div>

                      {isAdmin && approval.currentSignatures < approval.requiredSignatures && (
                        <div className="flex gap-2 pt-2">
                          <Dialog
                            open={signingApprovalId === approval.id}
                            onOpenChange={(open: boolean) =>
                              setSigningApprovalId(open ? approval.id : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button size="sm" className="gap-1">
                                Sign
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Sign Multisig Approval</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-gray-600">
                                Transfer: {approval.amount} to {approval.recipientAddress}
                              </p>
                              <div className="py-4 text-sm">
                                <p>
                                  By signing, you confirm this transfer is authorized and meets all
                                  treasury compliance requirements.
                                </p>
                              </div>
                              <Button
                                onClick={() => handleSubmitSignature(approval.id)}
                                className="w-full"
                              >
                                Sign & Submit
                              </Button>
                            </DialogContent>
                          </Dialog>

                          {isAdmin && (
                            <Dialog
                              open={rejectingApprovalId === approval.id}
                              onOpenChange={(open: boolean) =>
                                setRejectingApprovalId(open ? approval.id : null)
                              }
                            >
                              <DialogTrigger asChild>
                                <Button size="sm" variant="destructive" className="gap-1">
                                  Reject
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reject Approval</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <p className="text-sm text-gray-600">
                                    This action will cancel the pending transfer and notify the DAO.
                                  </p>
                                  <div>
                                    <label className="block text-sm font-medium mb-2">
                                      Reason for Rejection *
                                    </label>
                                    <textarea
                                      value={rejectReason}
                                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectReason(e.target.value)}
                                      placeholder="Explain why this transfer is being rejected..."
                                      className="w-full px-3 py-2 border rounded-lg min-h-[100px]"
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      variant="outline"
                                      onClick={() => setRejectingApprovalId(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() =>
                                        handleRejectApproval(approval.id)
                                      }
                                    >
                                      Reject Transfer
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      )}

                      {approval.status === 'approved' && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Ready to Execute
                        </Badge>
                      )}

                      {approval.status === 'rejected' && (
                        <Badge variant="destructive" className="gap-1">
                          ✕ Rejected
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
