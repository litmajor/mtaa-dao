/**
 * Bill Split Component
 * Create and manage bill splits with support for equal, custom, and percentage splits
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Plus, Trash2, CheckCircle, Clock, X } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { authClient } from '@/utils/authClient';
import ConfirmDialog from '@/components/ConfirmDialog';

interface BillSplitParticipant {
  userId?: string;
  daoId?: string;
  walletAddress?: string;
  sharePercentage?: number;
  customAmount?: string;
  name?: string;
}

interface BillSplit {
  id: string;
  title: string;
  description?: string;
  totalAmount: string;
  currency: string;
  splitMethod: 'equal' | 'custom' | 'percentage' | 'weighted';
  status: 'active' | 'settled' | 'cancelled';
  participants: Array<BillSplitParticipant & { amountOwed: string; amountPaid: string; paidAt?: string }>;
  createdAt: string;
  settlement?: {
    totalOwed: string;
    totalPaid: string;
    outstanding: string;
    settled: boolean;
  };
}

export default function BillSplit() {
  const [billSplits, setBillSplits] = useState<BillSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSplit, setSelectedSplit] = useState<BillSplit | null>(null);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);

  const [newSplit, setNewSplit] = useState({
    title: '',
    description: '',
    totalAmount: '',
    currency: 'cUSD',
    splitMethod: 'equal' as const,
    participants: [] as BillSplitParticipant[],
  });

  const [newParticipant, setNewParticipant] = useState({
    type: 'user' as 'user' | 'dao' | 'wallet',
    id: '',
    name: '',
    customAmount: '',
    sharePercentage: '',
  });

  // Fetch bill splits
  useEffect(() => {
    fetchBillSplits();
  }, []);

  const fetchBillSplits = async () => {
    try {
      setLoading(true);
      const data = await authClient.get('/api/v1/wallets/payments/split');
      setBillSplits(data.data?.billSplits || data.data || []);
    } catch (error) {
      console.error('Error fetching bill splits:', error);
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = () => {
    if (!newParticipant.id) {
      alert('Please enter a participant ID');
      return;
    }

    const participant: BillSplitParticipant = {
      name: newParticipant.name || newParticipant.id,
    };

    if (newParticipant.type === 'user') {
      participant.userId = newParticipant.id;
    } else if (newParticipant.type === 'dao') {
      participant.daoId = newParticipant.id;
    } else {
      participant.walletAddress = newParticipant.id;
    }

    if (newSplit.splitMethod === 'custom' && newParticipant.customAmount) {
      participant.customAmount = newParticipant.customAmount;
    } else if (newSplit.splitMethod === 'percentage' && newParticipant.sharePercentage) {
      participant.sharePercentage = parseFloat(newParticipant.sharePercentage);
    }

    setNewSplit({
      ...newSplit,
      participants: [...newSplit.participants, participant],
    });

    setNewParticipant({
      type: 'user',
      id: '',
      name: '',
      customAmount: '',
      sharePercentage: '',
    });
  };

  const removeParticipant = (index: number) => {
    setNewSplit({
      ...newSplit,
      participants: newSplit.participants.filter((_, i) => i !== index),
    });
  };

  const createBillSplit = async () => {
    if (!newSplit.title || !newSplit.totalAmount || newSplit.participants.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const data = await authClient.post('/api/v1/wallets/payments/split', newSplit);
      setBillSplits([data.data?.billSplit || data.data, ...billSplits]);
      setCreateModalOpen(false);
      setNewSplit({
        title: '',
        description: '',
        totalAmount: '',
        currency: 'cUSD',
        splitMethod: 'equal',
        participants: [],
      });

      alert('Bill split created successfully!');
    } catch (error) {
      console.error('Error creating bill split:', error);
      alert('Failed to create bill split');
    }
  };

  const settleBillSplit = async (splitId: string) => {
    try {
      await authClient.post(`/api/v1/wallets/payments/split/${splitId}/settle`, {});
      fetchBillSplits();
      alert('Bill split settled successfully!');
    } catch (error) {
      console.error('Error settling bill split:', error);
      alert('Failed to settle bill split');
    }
  };

  const cancelBillSplit = async (splitId: string) => {
    setPendingCancelSplit(splitId);
    setConfirmCancelOpen(true);
  };

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [pendingCancelSplit, setPendingCancelSplit] = useState<string | null>(null);

  const confirmCancel = async () => {
    if (!pendingCancelSplit) return;
    try {
      await authClient.post(`/api/v1/wallets/payments/split/${pendingCancelSplit}/cancel`, {});
      fetchBillSplits();
      alert('Bill split cancelled successfully!');
    } catch (error) {
      console.error('Error cancelling bill split:', error);
      alert('Failed to cancel bill split');
    } finally {
      setPendingCancelSplit(null);
      setConfirmCancelOpen(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'settled':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Settled</Badge>;
      case 'active':
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" /> Active</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500"><X className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const calculatePercentagePaid = (split: BillSplit) => {
    if (!split.settlement) return 0;
    const total = parseFloat(split.settlement.totalOwed);
    const paid = parseFloat(split.settlement.totalPaid);
    return total > 0 ? Math.round((paid / total) * 100) : 0;
  };

  if (loading) {
    return <div className="p-4">Loading bill splits...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Bill Splits</h2>
          <p className="text-gray-600">Manage and track shared expenses</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Bill Split
        </Button>
      </div>

        <ConfirmDialog
          open={confirmCancelOpen}
          title="Cancel Bill Split"
          description="Are you sure you want to cancel this bill split? This action cannot be undone."
          confirmLabel="Cancel"
          cancelLabel="Keep"
            onClose={(open: boolean) => setConfirmCancelOpen(open)}
          onConfirm={confirmCancel}
        />

      {/* Bill Splits List */}
      <div className="grid gap-4">
        {billSplits.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No bill splits yet. Create one to get started!</p>
            </CardContent>
          </Card>
        ) : (
          billSplits.map((split) => (
            <Card key={split.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{split.title}</CardTitle>
                    {split.description && (
                      <CardDescription>{split.description}</CardDescription>
                    )}
                  </div>
                  {getStatusBadge(split.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Amount and Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">
                        {split.totalAmount} {split.currency}
                      </span>
                      <span className="text-sm text-gray-600">
                        {calculatePercentagePaid(split)}% paid
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${calculatePercentagePaid(split)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Settlement Info */}
                  {split.settlement && (
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-gray-600">Owed</p>
                        <p className="font-semibold">{split.settlement.totalOwed}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Paid</p>
                        <p className="font-semibold text-green-600">{split.settlement.totalPaid}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Outstanding</p>
                        <p className="font-semibold text-orange-600">{split.settlement.outstanding}</p>
                      </div>
                    </div>
                  )}

                  {/* Participants Count */}
                  <div className="text-sm text-gray-600">
                    {split.participants.length} participant{split.participants.length !== 1 ? 's' : ''}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSplit(split);
                        setViewDetailsModalOpen(true);
                      }}
                    >
                      View Details
                    </Button>

                    {split.status === 'active' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => settleBillSplit(split.id)}
                          disabled={!split.settlement?.settled}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Settle
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => cancelBillSplit(split.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Bill Split Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Bill Split</DialogTitle>
            <DialogDescription>Split an expense among multiple people or DAOs</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Team Dinner"
                  value={newSplit.title}
                  onChange={(e) => setNewSplit({ ...newSplit, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional description"
                  value={newSplit.description}
                  onChange={(e) => setNewSplit({ ...newSplit, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Total Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100.00"
                    step="0.01"
                    value={newSplit.totalAmount}
                    onChange={(e) => setNewSplit({ ...newSplit, totalAmount: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={newSplit.currency}
                    onValueChange={(value) => setNewSplit({ ...newSplit, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cUSD">cUSD</SelectItem>
                      <SelectItem value="cEUR">cEUR</SelectItem>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="ETH">ETH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="splitMethod">Split Method *</Label>
                <Select
                  value={newSplit.splitMethod}
                  onValueChange={(value: any) => setNewSplit({ ...newSplit, splitMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Equal Split</SelectItem>
                    <SelectItem value="percentage">By Percentage</SelectItem>
                    <SelectItem value="custom">Custom Amounts</SelectItem>
                    <SelectItem value="weighted">Weighted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-3">
              <h3 className="font-semibold">Participants *</h3>

              {/* Add Participant */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="participantType">Type</Label>
                    <Select
                      value={newParticipant.type}
                      onValueChange={(value: any) =>
                        setNewParticipant({ ...newParticipant, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="dao">DAO</SelectItem>
                        <SelectItem value="wallet">Wallet Address</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="participantId">ID / Address</Label>
                    <Input
                      id="participantId"
                      placeholder="User ID or wallet address"
                      value={newParticipant.id}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, id: e.target.value })
                      }
                    />
                  </div>
                </div>

                {newSplit.splitMethod === 'custom' && (
                  <div>
                    <Label htmlFor="customAmount">Custom Amount</Label>
                    <Input
                      id="customAmount"
                      type="number"
                      placeholder="Amount"
                      step="0.01"
                      value={newParticipant.customAmount}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, customAmount: e.target.value })
                      }
                    />
                  </div>
                )}

                {newSplit.splitMethod === 'percentage' && (
                  <div>
                    <Label htmlFor="sharePercentage">Percentage %</Label>
                    <Input
                      id="sharePercentage"
                      type="number"
                      placeholder="25"
                      max="100"
                      value={newParticipant.sharePercentage}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, sharePercentage: e.target.value })
                      }
                    />
                  </div>
                )}

                <Button onClick={addParticipant} className="w-full" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Participant
                </Button>
              </div>

              {/* Participants List */}
              {newSplit.participants.length > 0 && (
                <div className="space-y-2">
                  {newSplit.participants.map((participant, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-white border rounded-lg"
                    >
                      <div className="text-sm">
                        <p className="font-medium">{participant.name || participant.userId || participant.daoId || participant.walletAddress}</p>
                        {participant.customAmount && (
                          <p className="text-gray-600">{participant.customAmount} {newSplit.currency}</p>
                        )}
                        {participant.sharePercentage && (
                          <p className="text-gray-600">{participant.sharePercentage}%</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParticipant(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Button */}
            <Button onClick={createBillSplit} className="w-full" size="lg">
              Create Bill Split
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Details Modal */}
      <Dialog open={viewDetailsModalOpen} onOpenChange={setViewDetailsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedSplit?.title}</DialogTitle>
            <DialogDescription>{selectedSplit?.description}</DialogDescription>
          </DialogHeader>

          {selectedSplit && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Total</p>
                  <p className="text-xl font-bold">{selectedSplit.totalAmount} {selectedSplit.currency}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Split Method</p>
                  <p className="text-xl font-bold capitalize">{selectedSplit.splitMethod}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Status</p>
                  {getStatusBadge(selectedSplit.status)}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Participants</h3>
                <div className="space-y-2">
                  {selectedSplit.participants.map((participant, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-medium">{participant.name}</p>
                        {participant.paidAt ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        Owed: {participant.amountOwed} | Paid: {participant.amountPaid}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
